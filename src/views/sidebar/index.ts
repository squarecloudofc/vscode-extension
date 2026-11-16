import type { AppSummary, StatusListItem, Workspace } from "@squarecloud/api";
import { SquareCloudBlob, SquareCloudBlobError } from "@squarecloud/blob";
import {
  commands,
  type Disposable,
  env,
  Uri,
  type WebviewView,
  type WebviewViewProvider,
} from "vscode";
import { t } from "vscode-ext-localisation";

import type { AppStatus, ExtensionStore } from "@/lib/store";
import type { SquareCloudExtension } from "@/managers/extension";
import type {
  SidebarItem,
  SidebarMethod,
  SidebarState,
} from "@/webview/protocol";
import { docsUrl, ExtensionID, LINKS } from "@/lib/constants";
import { selectAndSubscribe } from "@/lib/store";
import { serviceSummary } from "@/lib/utils/service-status";
import { renderShell, shellOptions } from "@/panels/html";
import { bindWebview } from "@/panels/panel-manager";
import { isWebsite } from "@/structures/application/command";

import { SignIn } from "./sign-in";

/** True while a key is stored: the palette and the view's title bar read it. */
const CONNECTED = "squarecloud.connected";
/** The workspace the sidebar shows, kept across reloads (null: Personal). */
const WORKSPACE_KEY = "sidebar.workspace";

/**
 * The commands `run` may execute, and the target each one takes: an app, a
 * database, a workspace, or nothing. The webview names a command and an id;
 * the host finds the object, so nothing else crosses the boundary.
 */
const RUNNABLE: Record<string, "app" | "database" | "workspace" | null> = {
  startEntry: "app",
  stopEntry: "app",
  restartEntry: "app",
  copyIdEntry: "app",
  openEntry: "app",
  favoriteEntry: "app",
  unfavoriteEntry: "app",
  deleteEntry: "app",
  startDatabase: "database",
  stopDatabase: "database",
  databaseMetrics: "database",
  downloadDatabaseCertificate: "database",
  deleteDatabase: "database",
  leaveWorkspace: "workspace",
  deleteWorkspace: "workspace",
  uploadApplication: null,
  createDatabase: null,
  createWorkspace: null,
  generateInviteCode: null,
  getStarted: null,
  setApiKey: null,
  showServiceStatus: null,
};

/**
 * Every string the webview reads. `check-strings` fails when a key read in
 * src/webview is missing here, since the webview only gets what is sent.
 */
const STRINGS = [
  "auth.copy",
  "auth.newHere",
  "auth.preparing",
  "auth.scopes.footer",
  "auth.tour",
  "auth.warning.openSecurity",
  "command.copyId",
  "command.createDatabase",
  "command.createWorkspace",
  "command.delete",
  "database.delete",
  "command.deleteWorkspace",
  "database.certDownload",
  "command.favoriteEntry",
  "command.leaveWorkspace",
  "command.open",
  "command.restart",
  "command.setApiKey",
  "command.start",
  "command.stop",
  "command.unfavoriteEntry",
  "dashboard.empty.upload",
  "dashboard.more",
  "dashboard.nextPage",
  "dashboard.noDatabases",
  "dashboard.offline",
  "dashboard.online",
  "dashboard.page",
  "dashboard.pending.restart",
  "dashboard.pending.start",
  "dashboard.pending.stop",
  "dashboard.plan.title",
  "dashboard.prevPage",
  "dashboard.ramUnavailable",
  "dashboard.ramUsed",
  "dashboard.stale",
  "generic.loading",
  "panel.tab.deploys",
  "panel.tab.files",
  "panel.tab.logs",
  "panel.tab.metrics",
  "panel.tab.network",
  "panel.tab.snapshots",
  "panel.tab.variables",
  "problem.error.body",
  "problem.error.title",
  "problem.offline.body",
  "problem.offline.title",
  "problem.outage.body",
  "problem.outage.title",
  "problem.plan.action",
  "problem.rateLimit.body",
  "problem.rateLimit.retryIn",
  "problem.rateLimit.title",
  "problem.session.body",
  "problem.session.title",
  "serviceStatus.degraded",
  "serviceStatus.maintenance",
  "serviceStatus.online",
  "serviceStatus.openPage",
  "serviceStatus.outage",
  "serviceStatus.summary.degraded",
  "serviceStatus.summary.maintenance",
  "serviceStatus.summary.online",
  "serviceStatus.summary.unknown",
  "serviceStatus.title",
  "serviceStatus.unknown",
  "setApiKey.connect.codeDetail",
  "setApiKey.connect.label",
  "setApiKey.connect.open",
  "setApiKey.panel.cancel",
  "setApiKey.panel.codeLabel",
  "setApiKey.panel.retry",
  "setApiKey.panel.waitingHint",
  "sidebar.blob.object",
  "sidebar.blob.objects",
  "sidebar.empty.body",
  "sidebar.empty.title",
  "sidebar.filter",
  "sidebar.links.dashboard",
  "sidebar.links.docs",
  "sidebar.links.label",
  "sidebar.links.support",
  "sidebar.mcp.action",
  "sidebar.signIn.scopes.mcp",
  "sidebar.workspace.open",
  "panel.dismiss",
  "sidebar.noApps",
  "sidebar.noMatch",
  "sidebar.plan.body",
  "sidebar.signIn.expires",
  "sidebar.signIn.lede",
  "sidebar.signIn.paste",
  "sidebar.signIn.scopes.control",
  "sidebar.signIn.scopes.files",
  "sidebar.signIn.scopes.read",
  "sidebar.signIn.scopes.workspaces",
  "sidebar.signIn.scopesTitle",
  "sidebar.signIn.title",
  "sidebar.workspace.invite",
  "sidebar.workspace.label",
  "sidebar.workspace.personal",
  "sidebar.workspaceEmpty.body",
  "sidebar.workspaceEmpty.title",
  "view.apps.title",
  "view.databases.title",
];

/**
 * The one sidebar view: sign-in while no key is stored (or while
 * reconnecting), otherwise the account's index. Its webview is the shared
 * Preact bundle (`renderShell`); it gets the whole `SidebarState` on every
 * change and calls back through the `SidebarMethod` handlers below.
 */
export class SidebarViewProvider implements WebviewViewProvider, Disposable {
  public static readonly viewId = "squarecloud.sidebar";

  private view?: WebviewView;
  private binding?: { post(state: unknown): void; dispose(): void };
  /** Undefined until the stored key has been read. */
  private connected?: boolean;
  /** A key is stored, and the user asked to connect again. */
  private reconnecting = false;
  /** `apps.statusAll({ workspaceId })` of the workspace on screen. */
  private workspaceStatuses = new Map<string, StatusListItem>();
  private blob: SidebarState["blob"] = null;
  /** The stored key has the `mcp` scope (read on every key change). */
  private mcpReady = false;
  /** The key Blob refused (no scope, no plan): not asked again until it changes. */
  private blobRefused?: string;
  private pushQueued = false;
  private readonly disposables: Disposable[] = [];

  private readonly signInFlow = new SignIn(
    this.extension,
    () => this.push(),
    () => void this.finishSignIn(),
  );

  private readonly handlers: Record<
    SidebarMethod,
    (params: unknown) => Promise<unknown>
  > = {
    "signIn.connect": () => this.signInFlow.connect(),
    "signIn.paste": () => this.signInFlow.paste(),
    "signIn.cancel": async () => this.signInFlow.cancel(),
    "signIn.copy": () => this.signInFlow.copy(),
    "signIn.open": () => this.signInFlow.open(),
    "signIn.security": async () => this.signInFlow.security(),
    refresh: () =>
      Promise.all([
        this.extension.api.refresh(),
        this.extension.api.refreshServiceStatus(),
      ]),
    open: async (params) => {
      const { kind, id, tab } = (params ?? {}) as {
        kind?: unknown;
        id?: unknown;
        tab?: unknown;
      };
      if (typeof id !== "string" || !id) return;
      // The panel checks the tab; an unknown one is its first.
      if (
        kind === "app" ||
        kind === "database" ||
        kind === "workspace" ||
        kind === "blob"
      )
        this.extension.panels.openResource(
          kind,
          id,
          typeof tab === "string" ? tab : undefined,
        );
    },
    run: (params) => this.run(params),
    workspace: async (params) => {
      const { id } = (params ?? {}) as { id?: unknown };
      const workspace = this.extension.store.value.workspaces.find(
        (w) => w.id === id,
      );
      await this.extension.context.globalState.update(
        WORKSPACE_KEY,
        workspace?.id,
      );
      this.workspaceStatuses = new Map();
      this.push();
      await this.refreshExtras();
    },
    link: async (params) => {
      const { key } = (params ?? {}) as { key?: unknown };
      // The webview names a page; the URL never comes from it.
      if (key === "docs")
        await env.openExternal(Uri.parse(docsUrl(env.language)));
      else if (
        key === "status" ||
        key === "pricing" ||
        key === "dashboard" ||
        key === "support"
      )
        await env.openExternal(Uri.parse(LINKS[key]));
    },
  };

  constructor(private readonly extension: SquareCloudExtension) {
    const push = () => this.push();
    const slices: Array<(state: ExtensionStore) => unknown> = [
      (s) => s.applications,
      (s) => s.statuses,
      (s) => s.user,
      (s) => s.databases,
      (s) => s.databaseStatuses,
      (s) => s.workspaces,
      (s) => s.appsLoaded,
      (s) => s.favorited,
      (s) => s.serviceStatus,
      (s) => s.problem,
    ];
    for (const select of slices)
      this.disposables.push(selectAndSubscribe(select, push));
    // Each refresh that works also re-reads what the account call lacks.
    this.disposables.push(
      selectAndSubscribe(
        (s) => s.lastUpdated,
        (at) => {
          if (at) void this.refreshExtras();
          push();
        },
      ),
    );
  }

  resolveWebviewView(view: WebviewView): void {
    this.view = view;
    view.webview.options = shellOptions();
    this.binding?.dispose();
    this.binding = bindWebview(view.webview, "sidebar", this.handlers);
    view.webview.html = renderShell(
      view.webview,
      "sidebar",
      Object.fromEntries(STRINGS.map((key) => [key, t(key)])),
      this.state(),
    );
    view.onDidDispose(() => {
      if (this.view !== view) return;
      this.view = undefined;
      this.binding?.dispose();
      this.binding = undefined;
      // Someone who opened this to switch accounts and walked away must not
      // come back to a sidebar stuck on sign-in.
      if (this.reconnecting) void this.finishSignIn();
    });
  }

  /**
   * Re-reads the stored key: sign-in or the account. Called on startup and
   * whenever the key appears or disappears.
   */
  async sync(): Promise<void> {
    const connected = Boolean(await this.extension.config.apiKey.get());
    if (connected !== this.connected) {
      this.blob = null;
      this.blobRefused = undefined;
    }
    this.connected = connected;
    // Every sign-in, sign-out and key change comes through here.
    this.mcpReady = await this.extension.mcp.ready();
    this.extension.mcp.refresh();
    await commands.executeCommand("setContext", CONNECTED, connected);
    this.push();
  }

  /** Shows sign-in, even when a key is already stored (to reconnect). */
  async signIn(): Promise<void> {
    this.reconnecting = Boolean(await this.extension.config.apiKey.get());
    this.signInFlow.reset(this.reconnecting);
    await this.sync();
    await commands.executeCommand(`${SidebarViewProvider.viewId}.focus`);
  }

  /** Hands the sidebar back to the account. */
  private async finishSignIn(): Promise<void> {
    this.reconnecting = false;
    this.signInFlow.reset(false);
    await this.sync();
  }

  private async run(params: unknown): Promise<void> {
    const { command, id } = (params ?? {}) as {
      command?: unknown;
      id?: unknown;
    };
    if (typeof command !== "string" || !Object.hasOwn(RUNNABLE, command))
      return;
    const kind = RUNNABLE[command];
    const target = kind ? this.target(kind, id) : undefined;
    if (kind && !target) return;
    // Every command takes one named field, which is what a tree item gave.
    await commands.executeCommand(`${ExtensionID}.${command}`, target);
  }

  private target(
    kind: "app" | "database" | "workspace",
    id: unknown,
  ): object | undefined {
    if (typeof id !== "string") return undefined;
    const state = this.extension.store.value;
    if (kind === "database") {
      const database = state.databases.get(id);
      return database && { database };
    }
    if (kind === "workspace") {
      const workspace = state.workspaces.find((w) => w.id === id);
      return workspace && { workspace };
    }
    const application = state.applications.get(id) ?? sharedApp(state, id);
    return application && { application };
  }

  private selectedWorkspace(): Workspace | undefined {
    const id = this.extension.context.globalState.get<string>(WORKSPACE_KEY);
    return id
      ? this.extension.store.value.workspaces.find((w) => w.id === id)
      : undefined;
  }

  /** What the account call lacks: a workspace's statuses and Blob usage. */
  private async refreshExtras(): Promise<void> {
    const api = await this.extension.api.getClient();
    if (!api) return;
    const workspace = this.selectedWorkspace();
    const [statuses, blob] = await Promise.allSettled([
      workspace
        ? api.apps.statusAll({ workspaceId: workspace.id })
        : Promise.resolve([]),
      this.blobUsage(),
    ]);
    if (statuses.status === "fulfilled")
      this.workspaceStatuses = new Map(statuses.value.map((s) => [s.id, s]));
    // A failed read (network, 429) keeps what was on screen.
    if (blob.status === "fulfilled") this.blob = blob.value;
    this.push();
  }

  /**
   * Blob usage, or null when this key can't have it: a key from the
   * authorize flow lists its scopes (one from 5.x has no `blob:*`), and a
   * refusal (no scope, no plan) is remembered for the key instead of asked
   * again every minute.
   */
  private async blobUsage(): Promise<SidebarState["blob"]> {
    const [key, account] = await Promise.all([
      this.extension.config.apiKey.get(),
      this.extension.config.apiKey.getAccount(),
    ]);
    if (!key || key === this.blobRefused) return null;
    if (account?.scopes && !account.scopes.includes("blob:read")) return null;
    try {
      const { usage } = await new SquareCloudBlob(key).stats();
      return { storage: usage.storage, objects: usage.objects };
    } catch (error) {
      const status = error instanceof SquareCloudBlobError ? error.status : 0;
      if (status >= 400 && status < 500 && status !== 429) {
        this.blobRefused = key;
        return null;
      }
      throw error;
    }
  }

  /** One refresh writes many slices; they go out as one message. */
  private push(): void {
    if (this.pushQueued) return;
    this.pushQueued = true;
    setTimeout(() => {
      this.pushQueued = false;
      this.binding?.post(this.state());
    }, 16);
  }

  private state(): SidebarState {
    const empty: SidebarState = {
      workspaces: [],
      workspace: null,
      apps: [],
      databases: [],
      blob: null,
    };
    if (this.connected === undefined) return empty;
    if (!this.connected || this.reconnecting)
      return { ...empty, signIn: this.signInFlow.state };

    const s = this.extension.store.value;
    const { user } = s;
    const workspace = this.selectedWorkspace();
    const item = (
      id: string,
      name: string,
      type: string,
      status: StatusListItem | AppStatus | undefined,
      website?: boolean,
    ): SidebarItem => ({
      id,
      name,
      type,
      status: !status ? "unknown" : status.running ? "online" : "offline",
      cpu: status?.running ? status.cpu : undefined,
      ram: status?.running ? status.ram : undefined,
      favorite: s.favorited.has(id) || undefined,
      website: website || undefined,
    });

    const apps = workspace
      ? workspace.applications.map((app) => {
          const id = s.applications.has(app.id)
            ? app.id
            : `${app.id}-${workspace.id}`;
          return item(
            id,
            app.name,
            app.lang,
            s.statuses.get(id) ?? this.workspaceStatuses.get(app.id),
            Boolean(app.custom ?? app.domain),
          );
        })
      : Array.from(s.applications.values(), (app) =>
          item(
            app.id,
            app.name,
            app.lang,
            s.statuses.get(app.id),
            isWebsite(app),
          ),
        );
    apps.sort(
      (a, b) =>
        Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) ||
        a.name.localeCompare(b.name),
    );

    const databases = workspace
      ? []
      : Array.from(s.databases.values(), (db) =>
          item(db.id, db.name, db.type, s.databaseStatuses.get(db.id)),
        ).sort((a, b) => a.name.localeCompare(b.name));

    // A refresh that ended with no account and no reason is still a failure.
    const problem =
      s.problem ??
      (s.appsLoaded && !user ? { kind: "error", at: 0 } : undefined);

    return {
      account: user && {
        name: user.name,
        plan: user.plan.name === "free" ? null : user.plan.name.split("-")[0],
        ramUsed: user.plan.memory.used,
        ramLimit: user.plan.memory.limit,
      },
      workspaces: s.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        owner: w.owner === user?.id,
      })),
      workspace: workspace?.id ?? null,
      apps,
      databases,
      blob: workspace ? null : this.blob,
      // MCP needs a plan: without one, reconnecting wouldn't help.
      mcpReconnect:
        !this.mcpReady && Boolean(user && user.plan.name !== "free"),
      service: {
        summary: serviceSummary(s.serviceStatus),
        incidents: (s.serviceStatus?.incidents ?? []).map((incident) => ({
          title: incident.title,
          status: incident.status,
        })),
      },
      problem: problem && {
        kind: problem.kind,
        at: problem.at,
        retryAt: "retryAt" in problem ? problem.retryAt : undefined,
      },
      updatedAt: s.lastUpdated,
    };
  }

  dispose(): void {
    this.signInFlow.dispose();
    this.binding?.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

/**
 * An app shared through a workspace, addressed as `<appId>-<workspaceId>`
 * (what the API takes for it). The commands read its id, name and domain.
 */
function sharedApp(state: ExtensionStore, id: string): AppSummary | undefined {
  for (const workspace of state.workspaces) {
    const app = workspace.applications.find(
      (a) => `${a.id}-${workspace.id}` === id,
    );
    if (app)
      return {
        ...app,
        id,
        desc: app.desc ?? undefined,
        cluster: "",
        created_at: workspace.createdAt,
      };
  }
  return undefined;
}
