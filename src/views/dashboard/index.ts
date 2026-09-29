import type { AppSummary } from "@squarecloud/api";
import {
  commands,
  type Disposable,
  env,
  Uri,
  type WebviewView,
  type WebviewViewProvider,
} from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import { ExtensionID, LINKS } from "@/lib/constants";
import { type ExtensionStore, selectAndSubscribe } from "@/lib/store";
import { type PickEntry, pickOne } from "@/lib/utils/dialogs";
import { getLocale, isSingular } from "@/lib/utils/locale";
import { isServiceHealthy } from "@/lib/utils/service-status";
import { hasMetrics, isWebsite } from "@/structures/application/command";

import { renderDashboard } from "./html";

type MenuKind = "app" | "database" | "workspace";

/** One action in the overflow menu, with its codicon. */
type MenuItem = { command: string; label: string; icon: string };

/** A menu section: its heading, then the commands under it. */
type MenuGroup = {
  group: string;
  items: MenuItem[];
  /**
   * Offering an action the API will refuse is worse than not offering it — the
   * user learns the answer from an error toast. Groups the extension can rule
   * out from what it already knows are dropped instead.
   */
  requires?: (application: AppSummary) => boolean;
};

/**
 * The per-application menu, grouped by what the user is trying to do rather
 * than by one flat list of fifteen. Every command here is an existing
 * `ApplicationCommand`, and they all destructure `{ application }` — so a
 * plain `{ application }` object drives them exactly like a tree item did.
 */
const APP_MENU: MenuGroup[] = [
  {
    group: "dashboard.group.app",
    items: [
      { command: "openEntry", label: "command.open", icon: "link-external" },
      { command: "logsEntry", label: "command.logsEntry", icon: "output" },
      { command: "copyIdEntry", label: "command.copyId", icon: "copy" },
    ],
  },
  {
    group: "dashboard.group.deploy",
    items: [
      { command: "commitEntry", label: "command.commit", icon: "git-commit" },
      { command: "snapshotEntry", label: "command.snapshot", icon: "archive" },
      {
        command: "snapshotRestoreEntry",
        label: "command.snapshotRestore",
        icon: "history",
      },
    ],
  },
  {
    group: "dashboard.group.settings",
    items: [
      { command: "envsEntry", label: "command.envs", icon: "symbol-variable" },
      {
        command: "linkGithubAppEntry",
        label: "command.linkGithub",
        icon: "github",
      },
      {
        command: "unlinkGithubAppEntry",
        label: "command.unlinkGithub",
        icon: "github",
      },
    ],
  },
  {
    group: "dashboard.group.monitoring",
    items: [
      { command: "realtimeEntry", label: "command.realtime", icon: "pulse" },
    ],
  },
  {
    group: "dashboard.group.metrics",
    items: [
      { command: "metricsEntry", label: "command.metrics", icon: "graph" },
    ],
    requires: hasMetrics,
  },
  {
    group: "dashboard.group.edge",
    items: [
      {
        command: "networkLogsEntry",
        label: "command.networkLogs",
        icon: "globe",
      },
      {
        command: "networkErrorsEntry",
        label: "command.networkErrors",
        icon: "warning",
      },
      {
        command: "networkPerformanceEntry",
        label: "command.networkPerformance",
        icon: "dashboard",
      },
      {
        command: "purgeCacheEntry",
        label: "command.purgeCache",
        icon: "clear-all",
      },
    ],
    requires: isWebsite,
  },
  {
    group: "dashboard.group.danger",
    items: [{ command: "deleteEntry", label: "command.delete", icon: "trash" }],
  },
];

const DATABASE_MENU: MenuGroup[] = [
  {
    group: "dashboard.group.control",
    items: [
      {
        command: "startDatabase",
        label: "command.startDatabase",
        icon: "play",
      },
      {
        command: "stopDatabase",
        label: "command.stopDatabase",
        icon: "debug-stop",
      },
    ],
  },
  {
    group: "dashboard.group.credentials",
    items: [
      {
        command: "downloadDatabaseCertificate",
        label: "command.downloadDatabaseCertificate",
        icon: "key",
      },
    ],
  },
  {
    group: "dashboard.group.danger",
    items: [
      {
        command: "deleteDatabase",
        label: "command.deleteDatabase",
        icon: "trash",
      },
    ],
  },
];

// The invite code is the user's own, not a workspace's, so it lives in the
// sidebar's ... menu next to Create workspace.
const WORKSPACE_MENU: MenuGroup[] = [
  {
    group: "dashboard.group.danger",
    items: [
      {
        command: "leaveWorkspace",
        label: "command.leaveWorkspace",
        icon: "sign-out",
      },
      {
        command: "deleteWorkspace",
        label: "command.deleteWorkspace",
        icon: "trash",
      },
    ],
  },
];

const GLOBAL_COMMANDS = new Set([
  "uploadApplication",
  "getStarted",
  "refreshCache",
  "createDatabase",
  "createWorkspace",
  "setApiKey",
]);

/** What a row's own buttons run; everything else goes through the ⋯ menu. */
const ROW_COMMANDS = new Set([
  "startEntry",
  "stopEntry",
  "restartEntry",
  "logsEntry",
  "favoriteEntry",
  "unfavoriteEntry",
]);

export class DashboardViewProvider implements WebviewViewProvider, Disposable {
  public static readonly viewId = "dashboard-view";

  private view?: WebviewView;
  private pushQueued = false;
  private readonly disposables: Disposable[] = [];

  constructor(private readonly extension: SquareCloudExtension) {
    // Repaint only on the slices the dashboard actually draws.
    const push = () => this.push();
    const slices: Array<(state: ExtensionStore) => unknown> = [
      (s) => s.applications,
      (s) => s.statuses,
      (s) => s.user,
      (s) => s.databases,
      (s) => s.workspaces,
      (s) => s.appsLoaded,
      // Without this the star toggles in the store and the list never repaints,
      // so favouriting looked like it did nothing.
      (s) => s.favorited,
      (s) => s.serviceStatus,
      (s) => s.problem,
      (s) => s.lastUpdated,
    ];
    for (const select of slices) {
      this.disposables.push(selectAndSubscribe(select, push));
    }
  }

  resolveWebviewView(view: WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = renderDashboard(getLocale());
    view.webview.onDidReceiveMessage((message) => this.onMessage(message));
    view.onDidDispose(() => {
      if (this.view === view) this.view = undefined;
    });
  }

  private onMessage(message: {
    type?: string;
    id?: string;
    command?: string;
    kind?: MenuKind;
    key?: string;
  }): void {
    switch (message.type) {
      case "ready":
        this.extension.api.forgetInspected();
        this.push();
        return;
      case "command":
        // Allow-listed like "global": the row's own buttons, nothing else.
        if (
          message.command &&
          message.id &&
          ROW_COMMANDS.has(message.command)
        ) {
          this.run(message.command, message.id);
        }
        return;
      case "menu":
        if (message.id) void this.showMenu(message.kind ?? "app", message.id);
        return;
      case "inspect":
      case "collapse":
        if (message.id) {
          this.extension.api.inspect(message.id, message.type === "inspect");
        }
        return;
      case "service":
        commands.executeCommand(`${ExtensionID}.showServiceStatus`);
        return;
      case "global":
        // App-less commands the empty state and footer offer. Allow-listed so
        // the webview can't run arbitrary commands.
        if (message.command && GLOBAL_COMMANDS.has(message.command)) {
          commands.executeCommand(`${ExtensionID}.${message.command}`);
        }
        return;
      case "open":
        // The webview names a page; the URL never comes from it.
        if (message.key === "pricing" || message.key === "status") {
          env.openExternal(Uri.parse(LINKS[message.key]));
        }
        return;
    }
  }

  private run(command: string, applicationId: string): void {
    const application =
      this.extension.store.value.applications.get(applicationId);
    if (!application) return;
    commands.executeCommand(`${ExtensionID}.${command}`, { application });
  }

  /**
   * A webview can't raise a native context menu, so the overflow opens a
   * QuickPick instead — same actions, and it stays keyboard reachable.
   */
  private async showMenu(kind: MenuKind, id: string): Promise<void> {
    const state = this.extension.store.value;

    const target =
      kind === "app"
        ? state.applications.get(id)
        : kind === "database"
          ? state.databases.get(id)
          : state.workspaces.find((workspace) => workspace.id === id);

    if (!target) return;

    let groups =
      kind === "app"
        ? APP_MENU
        : kind === "database"
          ? DATABASE_MENU
          : WORKSPACE_MENU;

    if (kind === "app") {
      const application = target as AppSummary;
      const favorited = this.extension.store.actions.isFavorited(id);
      const running = this.extension.store.actions.getStatus(id)?.running;

      groups = groups
        .filter((section) => section.requires?.(application) ?? true)
        .map((section) =>
          section.group === "dashboard.group.app"
            ? {
                ...section,
                items: [
                  // Lifecycle belongs here too, and only the half that can
                  // actually run: a stopped app has nothing to stop.
                  running === false
                    ? {
                        command: "startEntry",
                        label: "command.start",
                        icon: "play",
                      }
                    : {
                        command: "stopEntry",
                        label: "command.stop",
                        icon: "debug-stop",
                      },
                  ...(running
                    ? [
                        {
                          command: "restartEntry",
                          label: "command.restart",
                          icon: "debug-restart",
                        },
                      ]
                    : []),
                  ...section.items,
                  favorited
                    ? {
                        command: "unfavoriteEntry",
                        label: "command.unfavorite",
                        icon: "star-full",
                      }
                    : {
                        command: "favoriteEntry",
                        label: "command.favorite",
                        icon: "star-empty",
                      },
                ],
              }
            : section,
        );
    }

    const entries: Array<PickEntry<string>> = groups.flatMap((section) => [
      { separator: t(section.group) },
      ...section.items.map((item) => ({
        id: item.command,
        label: `$(${item.icon}) ${t(item.label)}`,
      })),
    ]);

    const picked = await pickOne(entries, { title: target.name });
    if (!picked) return;

    // Every one of these commands reads a single named field off its argument,
    // which is exactly what a tree item gave them.
    const argument =
      kind === "app"
        ? { application: target }
        : kind === "database"
          ? { database: target }
          : { workspace: target };

    commands.executeCommand(`${ExtensionID}.${picked}`, argument);
  }

  /**
   * One refresh writes six slices, which used to mean six full repaints in a
   * row — that burst is what read as flicker. Collapse them into one frame.
   */
  private push(): void {
    if (this.pushQueued) return;
    this.pushQueued = true;
    setTimeout(() => {
      this.pushQueued = false;
      this.send();
    }, 16);
  }

  private send(): void {
    if (!this.view) return;

    const state = this.extension.store.value;
    const { getStatus, isFavorited } = this.extension.store.actions;

    const apps = Array.from(state.applications.values())
      .sort(
        (a, b) =>
          (isFavorited(b.id) ? 1 : 0) - (isFavorited(a.id) ? 1 : 0) ||
          a.name.localeCompare(b.name),
      )
      .map((application) => {
        const status = getStatus(application.id);
        return {
          id: application.id,
          name: application.name,
          language: application.lang,
          cluster: application.cluster,
          ram: application.ram,
          domain: application.custom ?? application.domain,
          favorited: isFavorited(application.id),
          running: status?.running,
          cpu: status?.cpu,
          ramUsage: status?.ram,
          // Start timestamp (ms), only in the full status of an opened row.
          // The webview formats it, in the user's own timezone.
          uptime: status?.uptime,
        };
      });

    this.view.webview.postMessage({
      loading: !state.appsLoaded,
      user: state.user && {
        name: state.user.name,
        email: state.user.email,
        plan: {
          name: state.user.plan.name,
          memory: state.user.plan.memory,
        },
      },
      apps,
      databases: Array.from(state.databases.values()).map((database) => ({
        id: database.id,
        name: database.name,
        type: database.type,
        ram: database.ram,
      })),
      service: state.serviceStatus && {
        message: state.serviceStatus.message,
        operational: isServiceHealthy(state.serviceStatus),
      },
      // `at` changes on every failed retry, so the problem card repaints and
      // "Try again" comes back even when the answer is the same.
      problem: state.problem && {
        kind: state.problem.kind,
        at: state.problem.at,
        retryAt: state.problem.retryAt,
      },
      updatedAt: state.lastUpdated,
      workspaces: state.workspaces.map((workspace) => {
        const members = workspace.members.length;
        const apps = workspace.applications.length;
        return {
          id: workspace.id,
          name: workspace.name,
          // Two t() calls, not t(ternary): check-strings only sees literal keys.
          members: isSingular(members)
            ? t("dashboard.member", { COUNT: String(members) })
            : t("dashboard.members", { COUNT: String(members) }),
          apps: isSingular(apps)
            ? t("dashboard.app", { COUNT: String(apps) })
            : t("dashboard.apps", { COUNT: String(apps) }),
        };
      }),
    });
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
  }
}
