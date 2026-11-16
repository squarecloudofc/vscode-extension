import { type SquareCloudAPI, SquareCloudAPIError } from "@squarecloud/api";
import { SquareCloudBlobError } from "@squarecloud/blob";
import {
  type Disposable,
  Uri,
  ViewColumn,
  type Webview,
  type WebviewPanel,
  window,
  workspace,
} from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import { describeError, isApiError } from "@/lib/utils/errors";
import { FILES_SCHEME } from "@/webview/lib/files";
import {
  type HostMessage,
  isPanelInit,
  isViewMessage,
  type PanelInit,
  RESOURCE_KINDS,
  type ResourceKind,
  type RpcErrorBody,
  SIGNED_OUT,
  type ViewName,
} from "@/webview/protocol";

import { APP_STRINGS, appPanel, stopAllStreams } from "./app";
import { BLOB_STRINGS, blobPanel } from "./blob";
import { DATABASE_STRINGS, databasePanel } from "./database";
import { renderShell, shellOptions } from "./html";
import { WORKSPACE_STRINGS, workspacePanel } from "./workspace";

/** A view's RPC methods, called by `call(method, params)` in the webview. */
export type Handlers = Record<string, (params: unknown) => Promise<unknown>>;

/** What a panel's handlers get: the resource it shows and a way to talk. */
export type PanelContext = {
  extension: SquareCloudExtension;
  kind: ResourceKind;
  id: string;
  panel: WebviewPanel;
  /** Sends state, merged shallowly into the view's. Held until it's ready. */
  post(state: unknown): void;
  /** Sends an event (never merged), e.g. a batch of log lines. */
  emit(name: string, data: unknown): void;
  /**
   * The API client. Without a key the call fails quietly as SIGNED_OUT
   * (polls run in the background): only the panel's "Connect account"
   * button (`reconnect`) opens sign-in.
   */
  client(): Promise<SquareCloudAPI>;
};

/** Each kind's handlers, built once per open panel, and the strings its webview reads. */
const PANELS: Record<
  ResourceKind,
  { handlers: (context: PanelContext) => Handlers; strings: readonly string[] }
> = {
  app: { handlers: appPanel, strings: APP_STRINGS },
  database: { handlers: databasePanel, strings: DATABASE_STRINGS },
  workspace: { handlers: workspacePanel, strings: WORKSPACE_STRINGS },
  blob: { handlers: blobPanel, strings: BLOB_STRINGS },
};

const viewType = (kind: ResourceKind) => `squarecloud.${kind}`;

function toRpcError(error: unknown): RpcErrorBody {
  const known = isApiError(error) || error instanceof SquareCloudBlobError;
  return {
    status: known ? error.status : 0,
    code: known ? error.code : "UNKNOWN",
    message: describeError(error),
  };
}

/**
 * Connects a webview rendered by `renderShell` to its handlers: answers its
 * RPC calls and delivers state once it says it's ready. Panels and the
 * sidebar view both go through here. `handlers` is read on every call, so it
 * may be filled in after binding.
 */
export function bindWebview(
  webview: Webview,
  view: ViewName,
  handlers: Handlers,
): {
  post(state: unknown): void;
  emit(name: string, data: unknown): void;
  /** The page is loading again: hold messages until it says it's ready. */
  reset(): void;
  dispose(): void;
} {
  let ready = false;
  let queued: HostMessage[] = [];
  const send = (message: HostMessage) => void webview.postMessage(message);
  const deliver = (message: HostMessage) =>
    ready ? send(message) : queued.push(message);

  const subscription = webview.onDidReceiveMessage(async (message: unknown) => {
    if (!isViewMessage(message)) return;
    if (message.type === "ready") {
      ready = true;
      for (const queuedMessage of queued) send(queuedMessage);
      queued = [];
      return;
    }
    // Own keys only: "constructor" or "__proto__" are not methods.
    const handler = Object.hasOwn(handlers, message.method)
      ? handlers[message.method]
      : undefined;
    if (!handler) {
      send({
        type: "rpc-result",
        id: message.id,
        error: {
          status: 0,
          code: "UNKNOWN_METHOD",
          message: `Unknown method: ${message.method}`,
        },
      });
      return;
    }
    try {
      const result = await handler(message.params);
      send({ type: "rpc-result", id: message.id, result });
    } catch (error) {
      send({ type: "rpc-result", id: message.id, error: toRpcError(error) });
    }
  });

  return {
    post: (state) => deliver({ type: "state", view, state }),
    emit: (name, data) => deliver({ type: "event", view, name, data }),
    reset: () => {
      ready = false;
    },
    dispose: () => subscription.dispose(),
  };
}

/**
 * One editor panel per resource (app, database, workspace, Blob), reused
 * when it's already open and restored after a reload.
 */
export class PanelManager implements Disposable {
  private readonly open = new Map<
    string,
    { panel: WebviewPanel; post(state: unknown): void; reload(): void }
  >();
  private readonly disposables: Disposable[] = [];
  /**
   * The stored account's id when the key last changed (or at startup): a
   * new key for the same account is a reconnect, not a switch.
   */
  private account: Promise<string | undefined>;

  constructor(private readonly extension: SquareCloudExtension) {
    this.account = extension.config.apiKey.getAccount().then(
      (a) => a?.id,
      () => undefined,
    );
    for (const kind of RESOURCE_KINDS) {
      this.disposables.push(
        window.registerWebviewPanelSerializer(viewType(kind), {
          // `state` is what the webview persisted: its PanelInit.
          deserializeWebviewPanel: async (panel, state) => {
            if (isPanelInit(state)) this.attach(panel, kind, state);
            else panel.dispose();
          },
        }),
      );
    }
  }

  /** Opens the resource's panel, or reveals it (on `tab`, if given). */
  openResource(kind: ResourceKind, id: string, tab?: string): void {
    const existing = this.open.get(`${kind}:${id}`);
    if (existing) {
      existing.panel.reveal();
      if (tab) existing.post({ tab });
      return;
    }
    const panel = window.createWebviewPanel(
      viewType(kind),
      id,
      ViewColumn.Active,
      // Logs and live stats keep running in a background tab.
      { ...shellOptions(), retainContextWhenHidden: true },
    );
    this.attach(panel, kind, { id, tab });
  }

  private attach(panel: WebviewPanel, kind: ResourceKind, init: PanelInit) {
    const key = `${kind}:${init.id}`;
    const resources = Uri.joinPath(
      this.extension.context.extensionUri,
      "resources",
    );
    panel.webview.options = shellOptions();
    panel.iconPath = {
      light: Uri.joinPath(resources, "light", "squarecloud.svg"),
      dark: Uri.joinPath(resources, "dark", "squarecloud.svg"),
    };

    const handlers: Handlers = {};
    const binding = bindWebview(panel.webview, kind, handlers);
    Object.assign(
      handlers,
      PANELS[kind].handlers({
        extension: this.extension,
        kind,
        id: init.id,
        panel,
        post: binding.post,
        emit: binding.emit,
        client: async () => {
          const api = await this.extension.api.getClient();
          if (api) return api;
          throw new SquareCloudAPIError(401, SIGNED_OUT, undefined, "", "");
        },
      }),
    );
    const render = () => {
      // The page keeps its tab across this: it's persisted in the webview.
      panel.webview.html = renderShell(
        panel.webview,
        kind,
        Object.fromEntries(PANELS[kind].strings.map((key) => [key, t(key)])),
        init,
      );
    };
    render();

    this.open.set(key, {
      panel,
      post: binding.post,
      // Every fetch runs again, with whatever client is current.
      reload: () => {
        binding.reset();
        render();
      },
    });
    panel.onDidDispose(() => {
      binding.dispose();
      this.open.delete(key);
    });
  }

  /**
   * The stored key changed. The same account under a new key (Reconnect,
   * more scopes): panels and `squarecloud:` editors stay and read again
   * with it. Signed out, or another account (or one this can't tell, such
   * as a pasted key's): every panel closes, and with it its polls, streams
   * and what it held (logs, variables, listings, a fresh database
   * password), and so do the app files' editor tabs. A tab with unsaved
   * changes is left open, so nothing typed is lost.
   */
  async keyChanged(): Promise<void> {
    const before = await this.account;
    const { apiKey } = this.extension.config;
    // An account that can't be read counts as another one: panels close.
    const [key, account] = await Promise.all([
      apiKey.get(),
      apiKey.getAccount().catch(() => undefined),
    ]);
    const now = key ? account?.id : undefined;
    this.account = Promise.resolve(now);
    const tabs = window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter(
        (tab) => (tab.input as { uri?: Uri })?.uri?.scheme === FILES_SCHEME,
      );

    if (now && now === before) {
      // The streams hold the old client: they open again with the new one.
      stopAllStreams();
      for (const { reload } of this.open.values()) reload();
      this.extension.files.reset([
        ...tabs.map((tab) => (tab.input as { uri: Uri }).uri),
        ...(workspace.workspaceFolders ?? [])
          .filter((folder) => folder.uri.scheme === FILES_SCHEME)
          .map((folder) => folder.uri),
      ]);
      return;
    }
    for (const { panel } of [...this.open.values()]) panel.dispose();
    this.extension.files.reset([]);
    await window.tabGroups.close(tabs.filter((tab) => !tab.isDirty));
  }

  // Panels are left open: VS Code restores them on the next start.
  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
