import { env, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { DatabaseInfo, DatabaseStatus } from "@/webview/protocol";
import { writeCertificate } from "@/commands/databases";
import {
  connection,
  isDatabaseName,
  memoryProblem,
  minRam,
} from "@/webview/lib/database";

import type { Handlers, PanelContext } from "./panel-manager";
import { PANEL_STRINGS } from "./app/strings";
import { resourceHandlers } from "./resource";

const field = (params: unknown, key: string): unknown =>
  typeof params === "object" && params !== null
    ? (params as Record<string, unknown>)[key]
    : undefined;

/**
 * The database panel's host side. Besides `info`, `status` and the
 * lifecycle, it shares `metrics` and `snapshots*` with the app panel
 * (src/panels/resource.ts). A password just reset stays here, never logged
 * and never sent until the user reveals or copies it (`secret`).
 */
export function databasePanel({
  extension,
  id,
  panel,
  post,
  client,
}: PanelContext): Handlers {
  panel.title = extension.store.value.databases.get(id)?.name ?? id;

  let info: DatabaseInfo | undefined;
  let fresh: string | undefined;
  /** Where the certificate was saved last, for "Open folder". */
  let savedTo: string | undefined;
  // The webview polls the status only while the panel is on screen; it
  // keeps running hidden (retainContextWhenHidden), so it's told.
  const viewState = panel.onDidChangeViewState(() =>
    post({ visible: panel.visible }),
  );
  panel.onDidDispose(() => {
    viewState.dispose();
    fresh = undefined;
  });

  // The sidebar's list and statuses follow a change made here.
  const refreshList = () => void extension.api.refresh();

  return {
    ...resourceHandlers(id, client, (api) => api.databases),

    info: async (): Promise<DatabaseInfo> => {
      const db = await (await client()).databases.get(id);
      const { user } = extension.store.value;
      panel.title = db.name;
      info = {
        id,
        name: db.name,
        type: db.type,
        ram: db.ram,
        port: db.port,
        cluster: db.cluster,
        createdAt: db.created_at,
        ...connection(db.type, id, db.port),
        // A database is always its owner's: the plan alone decides.
        week:
          user && !/^(pro|enterprise)-/.test(user.plan.name) ? "plan" : "on",
        ramMin: minRam(db.type),
        ramMax: user ? user.plan.memory.available + db.ram : null,
      };
      return info;
    },

    status: async (): Promise<DatabaseStatus> => {
      const stats = await (await client()).databases.status(id, { raw: true });
      return {
        running: stats.running,
        restoring: stats.restoring,
        cpu: stats.cpu,
        ram: stats.ram,
        storage: stats.storage,
        network: stats.network.now,
        uptime: stats.uptime,
      };
    },

    /**
     * Start or stop. The API has no database restart: `stop-start` (after a
     * password reset) is a stop, a pause and a start, and says so.
     */
    action: async (params) => {
      const action = field(params, "action");
      const api = await client();
      try {
        if (action === "start" || action === "stop")
          await api.databases[action](id);
        else if (action === "stop-start") {
          // As the site does: a stop that fails (already stopped) is no matter.
          await api.databases.stop(id).catch(() => undefined);
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          await api.databases.start(id);
        }
      } finally {
        refreshList();
      }
    },

    /** Copies what the webview shows (the ID, the host, the URL without the password). */
    copy: async (params) => {
      const text = field(params, "text");
      if (typeof text === "string") await env.clipboard.writeText(text);
    },

    reconnect: () => extension.views.sidebar.signIn(),

    /** The TLS certificate into a folder the user picks; what went where, or null. */
    certificate: async () => {
      const [folder] =
        (await window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          openLabel: t("database.certSave"),
          title: `${t("database.certDownload")} - ${info?.name ?? id}`,
        })) ?? [];
      if (!folder) return null;
      const files = await writeCertificate(
        folder.fsPath,
        id,
        await (await client()).databases.certificate(id),
      );
      savedTo = folder.fsPath;
      return { folder: folder.fsPath, files };
    },

    "certificate.open": async () => {
      if (savedTo) await env.openExternal(Uri.file(savedTo));
    },

    /** Rotates the password (kept for `secret`) or the certificate. */
    reset: async (params) => {
      const kind = field(params, "kind");
      if (kind !== "password" && kind !== "certificate") return;
      const result = await (await client()).databases.resetCredentials(
        id,
        kind,
      );
      if (kind === "password") fresh = result || undefined;
    },

    /**
     * The fresh password, or the URL with it: `reveal` answers it, `copy`
     * puts it on the clipboard without sending it, `forget` drops it.
     */
    secret: async (params) => {
      const mode = field(params, "mode");
      if (mode === "forget") {
        fresh = undefined;
        return null;
      }
      if (!fresh || !info) return null;
      const value =
        field(params, "what") === "url"
          ? connection(info.type, id, info.port, encodeURIComponent(fresh)).url
          : fresh;
      if (mode !== "copy") return value;
      await env.clipboard.writeText(value);
      return null;
    },

    rename: async (params) => {
      const name = field(params, "name");
      if (typeof name !== "string" || !isDatabaseName(name.trim()))
        throw new Error(t("database.panel.nameInvalid"));
      await (await client()).databases.update(id, { name: name.trim() });
      panel.title = name.trim();
      refreshList();
    },

    memory: async (params) => {
      const ram = field(params, "ram");
      if (
        !info ||
        typeof ram !== "string" ||
        memoryProblem(ram, info.ramMin, info.ramMax)
      )
        throw new Error(t("database.panel.memoryInvalid"));
      await (await client()).databases.update(id, { ram: Number(ram.trim()) });
      refreshList();
    },

    /** Deletes it, then the panel closes. */
    delete: async () => {
      await (await client()).databases.delete(id);
      refreshList();
      // After this answer is sent.
      setTimeout(() => panel.dispose(), 0);
    },
  };
}

/** Every string the database panel's webview reads (`check-strings` holds it to this). */
export const DATABASE_STRINGS = [
  ...PANEL_STRINGS,
  "app.copied",
  "app.envs.save",
  "app.info.created",
  "app.info.started",
  "app.logs.saved",
  "app.settings.deletePrompt",
  "app.settings.deleteTitle",
  "app.stat.ofLimit",
  "app.stat.stopped",
  "app.usage",
  "command.copyId",
  "command.delete",
  "database.delete",
  "database.certDownload",
  "command.start",
  "command.stop",
  "dashboard.more",
  "dashboard.offline",
  "dashboard.online",
  "dashboard.pending.start",
  "dashboard.pending.stop",
  "dashboard.unknown",
  "database.openFolder",
  "database.panel.actionFailed",
  "database.panel.alreadyStarted",
  "database.panel.alreadyStopped",
  "database.panel.certBody",
  "database.panel.certReset",
  "database.panel.certResetBody",
  "database.panel.certResetDone",
  "database.panel.certSaved",
  "database.panel.certTitle",
  "database.panel.cluster",
  "database.panel.connection",
  "database.panel.connectionHint",
  "database.panel.copyPassword",
  "database.panel.copyUrl",
  "database.panel.credentials",
  "database.panel.deleteBody",
  "database.panel.deleteConfirm",
  "database.panel.engine",
  "database.panel.hide",
  "database.panel.host",
  "database.panel.loadError",
  "database.panel.memory",
  "database.panel.memoryBody",
  "database.panel.memoryHigh",
  "database.panel.memoryInteger",
  "database.panel.memoryLow",
  "database.panel.memoryRange",
  "database.panel.name",
  "database.panel.nameBody",
  "database.panel.nameInvalid",
  "database.panel.newPassword",
  "database.panel.newPasswordBody",
  "database.panel.passwordAck",
  "database.panel.passwordBody",
  "database.panel.passwordReset",
  "database.panel.passwordResetBody",
  "database.panel.passwordTitle",
  "database.panel.port",
  "database.panel.stopStart",
  "database.panel.stopStartFailed",
  "database.panel.stopStartForced",
  "database.panel.stopStarted",
  "database.panel.stopStarting",
  "database.panel.restoring",
  "database.panel.reveal",
  "database.panel.url",
  "database.panel.user",
  "panel.metrics.cpu",
  "panel.metrics.network",
  "panel.metrics.ram",
  "panel.metrics.storage",
  "panel.snapshots.restoring",
  "panel.tab.metrics",
  "panel.tab.overview",
  "panel.tab.settings",
  "panel.tab.snapshots",
  "panel.tabs",
];
