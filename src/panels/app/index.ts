import { join } from "node:path";
import { commands, env, Uri, window, workspace } from "vscode";
import { t } from "vscode-ext-localisation";

import {
  pickCommitSource,
  zipForCommit,
} from "@/commands/applications/tools/commit";
import {
  afterDelete,
  deleteWithRecovery,
} from "@/commands/applications/tools/delete";
import { ExtensionID, LINKS } from "@/lib/constants";
import { isApiError } from "@/lib/utils/errors";
import { shellQuote } from "@/lib/utils/format";
import { ENV_KEY } from "@/webview/lib/env";
import {
  type AppInfo,
  type AppLive,
  type LogBatch,
  type LogLine,
  SIGNED_OUT,
  type StreamState,
} from "@/webview/protocol";

import type { Handlers, PanelContext } from "../panel-manager";
import { resourceHandlers } from "../resource";
import { defaultDir, filesHandlers } from "./files";
import { liveFromFrame, liveFromStats, printableLine } from "./live";
import { networkHandlers } from "./network";

export { APP_STRINGS } from "./strings";

/** Without a stream the stats come from `apps.status`, this often. */
const STATUS_POLL_MS = 15_000;
/** With one, only what frames lack (a restore running) is read, slower. */
const STATUS_POLL_LIVE_MS = 60_000;
/** A stream closed by its 10-minute limit opens again after this. */
const RECONNECT_MS = 3_000;
/** One that ends sooner was refused (a stopped app, the account's limit). */
const MIN_HEALTHY_MS = 5_000;
/** A refused stream is tried again at most this often, once the app runs. */
const RETRY_STREAM_MS = 30_000;
/** Live log lines go to the webview in batches. */
const LOG_FLUSH_MS = 150;
/** A .env file bigger than this is not one. */
const ENV_FILE_MAX = 512 * 1024;
const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;

/** Every open stream, so deactivation can stop them all. */
const streams = new Set<AbortController>();

/** Stops every app panel's realtime stream (the extension is going away). */
export function stopAllStreams(): void {
  for (const controller of streams) controller.abort();
}

/** A variables answer as the webview gets it: the names alone. */
const keysOf = (envs: Record<string, string>): string[] => Object.keys(envs);

const field = (params: unknown, key: string): unknown =>
  typeof params === "object" && params !== null
    ? (params as Record<string, unknown>)[key]
    : undefined;

/**
 * The app panel's host side: its RPC methods (`AppMethod` in
 * src/webview/protocol.ts) and its live readings. While the panel is
 * visible it follows the realtime stream (log lines as `logs` events,
 * status frames as `live` state) and polls `apps.status` for what the
 * stream lacks, or for everything when there is no stream. Hidden or
 * closed, both stop: an account has 5 streams.
 */
export function appPanel({
  extension,
  id,
  panel,
  post,
  emit,
  client,
}: PanelContext): Handlers {
  panel.title = extension.store.value.applications.get(id)?.name ?? id;

  let info: AppInfo | undefined;
  /** The webview asked for live readings (`live.start`). */
  let wanted = false;
  let disposed = false;
  let controller: AbortController | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let lastAttempt = 0;
  let live: AppLive = {};
  let stream: StreamState = { state: "off" };
  let lines: LogLine[] = [];
  /** The next batch opens a connection: the stream replays recent lines. */
  let replay = false;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  const active = () => wanted && panel.visible && !disposed;

  const setLive = (next: AppLive) => {
    live = next;
    post({ live });
  };
  const setStream = (next: StreamState) => {
    if (next.state === stream.state && next.code === stream.code) return;
    stream = next;
    post({ stream });
  };
  const queueLine = (text: string, stderr: boolean) => {
    lines.push({ text, stderr: stderr || undefined, at: Date.now() });
    flushTimer ??= setTimeout(() => {
      flushTimer = undefined;
      const batch: LogBatch = { lines, replay };
      emit("logs", batch);
      lines = [];
      replay = false;
    }, LOG_FLUSH_MS);
  };

  async function openStream(): Promise<void> {
    if (controller || !active()) return;
    const api = await extension.api.getClient();
    if (!api || controller || !active()) return;
    const own = new AbortController();
    controller = own;
    streams.add(own);
    lastAttempt = Date.now();
    replay = true;
    setStream({ state: "connecting" });
    let code: string | undefined;
    try {
      for await (const event of api.apps.realtime(id, { signal: own.signal })) {
        if (event.event === "status")
          setLive(liveFromFrame(live, event.status, Date.now()));
        const line = printableLine(event);
        if (line !== undefined)
          queueLine(line, event.event === "logs" && event.stream === "stderr");
        if (event.event === "status" || event.event === "logs")
          setStream({ state: "live" });
      }
    } catch (error) {
      if (!own.signal.aborted)
        code = isApiError(error) ? error.code : "NETWORK_ERROR";
    } finally {
      streams.delete(own);
      if (controller === own) controller = undefined;
    }
    const healthy = !code && Date.now() - lastAttempt >= MIN_HEALTHY_MS;
    setStream({ state: "off", code });
    if (!active()) return;
    // A clean close is the 10-minute limit: it opens again, as does an
    // abort while still wanted. A refusal waits for the poll to see the app
    // running.
    if (healthy || own.signal.aborted)
      setTimeout(() => void openStream(), RECONNECT_MS);
    schedulePoll(0);
  }

  async function poll(): Promise<void> {
    clearTimeout(pollTimer);
    pollTimer = undefined;
    if (!active()) return;
    try {
      const stats = await (await client()).apps.status(id, { raw: true });
      setLive(liveFromStats(live, stats, Date.now()));
    } catch (error) {
      // Signed out: nothing to poll for (and no sign-in from here).
      if (isApiError(error) && error.code === SIGNED_OUT) return;
      // Otherwise the last readings stay on screen; the next poll tries again.
    }
    if (!active()) return;
    if (
      !controller &&
      live.running &&
      Date.now() - lastAttempt > RETRY_STREAM_MS
    )
      void openStream();
    schedulePoll(
      stream.state === "live" ? STATUS_POLL_LIVE_MS : STATUS_POLL_MS,
    );
  }

  function schedulePoll(ms: number): void {
    clearTimeout(pollTimer);
    if (active()) pollTimer = setTimeout(() => void poll(), ms);
  }

  const pause = () => {
    controller?.abort();
    clearTimeout(pollTimer);
  };
  const resume = () => {
    if (!active()) return;
    void poll();
    void openStream();
  };

  const viewState = panel.onDidChangeViewState(() =>
    panel.visible ? resume() : pause(),
  );
  panel.onDidDispose(() => {
    disposed = true;
    viewState.dispose();
    pause();
    clearTimeout(flushTimer);
  });

  return {
    ...resourceHandlers(id, client, (api) => api.apps),
    ...filesHandlers(extension, id, () => info?.name ?? panel.title),
    ...networkHandlers(id, client),

    info: async (): Promise<AppInfo> => {
      const app = await (await client()).apps.get(id);
      const { user } = extension.store.value;
      panel.title = app.name;
      info = {
        id,
        name: app.name,
        desc: app.desc,
        lang: app.language,
        ram: app.ram,
        cluster: app.cluster,
        domain: app.custom ?? app.domain ?? null,
        subdomain: app.domain ?? null,
        custom: app.custom ?? null,
        createdAt: app.created_at,
        // Someone else's app (a workspace's) has its owner's plan, unknown
        // here: the answer tells (a 24-hour one).
        week:
          app.ram < 512
            ? "small"
            : user &&
                app.owner === user.id &&
                !/^(pro|enterprise)-/.test(user.plan.name)
              ? "plan"
              : "on",
      };
      return info;
    },

    "live.start": async () => {
      wanted = true;
      resume();
    },

    /** Start, stop or restart; answers once the status is read again. */
    action: async (params) => {
      const action = field(params, "action");
      if (action !== "start" && action !== "stop" && action !== "restart")
        return;
      const api = await client();
      try {
        await api.apps[action](id);
      } finally {
        // Also after a refusal ("already running"): the screen was stale.
        void extension.api.trackStatusChange(id);
        lastAttempt = 0;
        await poll();
      }
    },

    /** The site, the web dashboard or the plans; never the webview's URL. */
    open: async (params) => {
      const target = field(params, "target");
      const host = field(params, "host");
      if (target === "site" && info?.domain)
        await env.openExternal(
          Uri.parse(
            `https://${host === info.subdomain || host === info.custom ? host : info.domain}`,
          ),
        );
      else if (target === "pricing")
        await env.openExternal(Uri.parse(LINKS.pricing));
      else if (target === "dashboard")
        await commands.executeCommand(`${ExtensionID}.openEntry`, {
          application: { id },
        });
    },

    copy: async (params) => {
      const text = field(params, "text");
      if (typeof text === "string") await env.clipboard.writeText(text);
    },

    reconnect: () => extension.views.sidebar.signIn(),

    logs: async () => (await client()).apps.logs(id),

    /** Saves the given text where the user picks; false when canceled. */
    "logs.save": async (params) => {
      const text = field(params, "text");
      if (typeof text !== "string") return false;
      const name = (info?.name ?? id).replace(/[^\w.-]/g, "_");
      const uri = await window.showSaveDialog({
        defaultUri: Uri.file(join(defaultDir(), `${name}-logs.txt`)),
      });
      if (!uri) return false;
      await workspace.fs.writeFile(uri, Buffer.from(text, "utf8"));
      return true;
    },

    // Variables reach the webview as names only, like the database
    // password: a value leaves the host on `envs.reveal` (shown on
    // request, or opened to edit) and never on `envs.copy`.
    envs: async () => keysOf(await (await client()).apps.envs.get(id)),

    /** One variable's value, read again; null when it's gone. */
    "envs.reveal": async (params) => {
      const key = field(params, "key");
      const envs = await (await client()).apps.envs.get(id);
      return typeof key === "string" && Object.hasOwn(envs, key)
        ? envs[key]
        : null;
    },

    /** One variable's value onto the clipboard, without sending it. */
    "envs.copy": async (params) => {
      const key = field(params, "key");
      const envs = await (await client()).apps.envs.get(id);
      if (typeof key === "string" && Object.hasOwn(envs, key))
        await env.clipboard.writeText(envs[key]);
    },

    /** Adds or overwrites; quoted like the CLI does. Answers all the names. */
    "envs.set": async (params) => {
      const envs = field(params, "envs");
      const entries = Object.entries(
        typeof envs === "object" && envs !== null ? envs : {},
      ).filter(
        (entry): entry is [string, string] =>
          ENV_KEY.test(entry[0]) && typeof entry[1] === "string",
      );
      const api = await client();
      if (!entries.length) return keysOf(await api.apps.envs.get(id));
      return keysOf(
        await api.apps.envs.set(
          id,
          Object.fromEntries(entries.map(([k, v]) => [k, shellQuote(v)])),
        ),
      );
    },

    "envs.delete": async (params) => {
      const keys = field(params, "keys");
      const list = Array.isArray(keys)
        ? keys.filter((k): k is string => typeof k === "string")
        : [];
      return keysOf(await (await client()).apps.envs.delete(id, list));
    },

    /** A local .env file's text, for the paste dialog; null when canceled. */
    "envs.import": async () => {
      const [uri] =
        (await window.showOpenDialog({
          canSelectMany: false,
          defaultUri: Uri.file(defaultDir()),
          openLabel: t("app.envs.import"),
        })) ?? [];
      if (!uri) return null;
      if ((await workspace.fs.stat(uri)).size > ENV_FILE_MAX)
        throw new Error(t("app.envs.tooLarge"));
      return new TextDecoder().decode(await workspace.fs.readFile(uri));
    },

    /** The GitHub link or webhook, and one timeline per deploy. */
    deploys: async () => {
      const api = await client();
      const [current, history] = await Promise.all([
        api.apps.deploys.current(id),
        api.apps.deploys.list(id),
      ]);
      return { current, history };
    },

    "deploys.link": async (params) => {
      const repository = field(params, "repository");
      const branch = field(params, "branch");
      if (
        typeof repository !== "string" ||
        !REPOSITORY.test(repository) ||
        typeof branch !== "string" ||
        !branch.trim()
      )
        return;
      return (await client()).apps.deploys.linkGithubApp(
        id,
        repository,
        branch.trim(),
      );
    },

    "deploys.unlink": async () =>
      (await client()).apps.deploys.unlinkGithubApp(id),

    /** A token sets the webhook and answers its URL; `@` removes it. */
    "deploys.webhook": async (params) => {
      const token = field(params, "token");
      if (typeof token !== "string" || !token.trim()) return "";
      return (await client()).apps.deploys.setWebhook(id, token.trim());
    },

    /** Files or a folder the user picks; false when canceled. */
    commit: async (params) => {
      const kind = field(params, "kind");
      if (kind !== "file" && kind !== "folder") return false;
      const uris = await pickCommitSource(kind, info?.name ?? id);
      if (!uris) return false;
      const buffer = await zipForCommit(kind, uris);
      if (!buffer) return false;
      const api = await client();
      await api.apps.commit(id, buffer, { filename: `${id}.zip` });
      if (field(params, "restart") === true) await api.apps.restart(id);
      extension.api.scheduleStatusRefresh(id);
      return true;
    },

    /**
     * Recovery snapshot, then delete. `{pending: true}` leaves the app as
     * it is (the snapshot is still generating); otherwise the panel closes
     * and one notification offers the snapshot.
     */
    delete: async () => {
      const url = await deleteWithRecovery(await client(), id);
      if (!url) return { pending: true };
      // After this answer is sent.
      setTimeout(() => panel.dispose(), 0);
      void afterDelete(extension, url);
      return { pending: false };
    },
  };
}
