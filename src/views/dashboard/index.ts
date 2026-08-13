import type { BaseApplication } from "@squarecloud/api";
import {
  commands,
  type Disposable,
  type WebviewView,
  type WebviewViewProvider,
} from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import { ExtensionID } from "@/lib/constants";
import { type ExtensionStore, selectAndSubscribe } from "@/lib/store";
import { type PickEntry, pickOne } from "@/lib/utils/dialogs";
import { isServiceHealthy } from "@/lib/utils/service-status";

import { renderDashboard } from "./html";

type MenuKind = "app" | "database" | "workspace";

/** A menu section: its heading, then the commands under it. */
type MenuGroup = {
  group: string;
  items: Array<{ command: string; label: string }>;
  /**
   * Offering an action the API will refuse is worse than not offering it — the
   * user learns the answer from an error toast. Groups the extension can rule
   * out from what it already knows are dropped instead.
   */
  requires?: (application: BaseApplication) => boolean;
};

/** Edge routes exist only for applications that serve a domain. */
const isWebsite = (application: BaseApplication) =>
  Boolean(application.custom ?? application.domain);
/** The metrics endpoint answers METRICS_NOT_SUPPORTED below 512 MB. */
const hasMetrics = (application: BaseApplication) => application.ram >= 512;

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
      { command: "openEntry", label: "command.open" },
      { command: "logsEntry", label: "command.logsEntry" },
      { command: "copyIdEntry", label: "command.copyId" },
    ],
  },
  {
    group: "dashboard.group.deploy",
    items: [
      { command: "commitEntry", label: "command.commit" },
      { command: "snapshotEntry", label: "command.snapshot" },
      { command: "snapshotRestoreEntry", label: "command.snapshotRestore" },
    ],
  },
  {
    group: "dashboard.group.settings",
    items: [
      { command: "envsEntry", label: "command.envs" },
      { command: "linkGithubAppEntry", label: "command.linkGithub" },
      { command: "unlinkGithubAppEntry", label: "command.unlinkGithub" },
    ],
  },
  {
    group: "dashboard.group.monitoring",
    items: [{ command: "realtimeEntry", label: "command.realtime" }],
  },
  {
    group: "dashboard.group.metrics",
    items: [{ command: "metricsEntry", label: "command.metrics" }],
    requires: hasMetrics,
  },
  {
    group: "dashboard.group.edge",
    items: [
      { command: "networkLogsEntry", label: "command.networkLogs" },
      { command: "networkErrorsEntry", label: "command.networkErrors" },
      {
        command: "networkPerformanceEntry",
        label: "command.networkPerformance",
      },
      { command: "purgeCacheEntry", label: "command.purgeCache" },
    ],
    requires: isWebsite,
  },
  {
    group: "dashboard.group.danger",
    items: [{ command: "deleteEntry", label: "command.delete" }],
  },
];

const DATABASE_MENU: MenuGroup[] = [
  {
    group: "dashboard.group.control",
    items: [
      { command: "startDatabase", label: "command.startDatabase" },
      { command: "stopDatabase", label: "command.stopDatabase" },
    ],
  },
  {
    group: "dashboard.group.credentials",
    items: [
      {
        command: "downloadDatabaseCertificate",
        label: "command.downloadDatabaseCertificate",
      },
    ],
  },
  {
    group: "dashboard.group.danger",
    items: [{ command: "deleteDatabase", label: "command.deleteDatabase" }],
  },
];

const WORKSPACE_MENU: MenuGroup[] = [
  {
    group: "dashboard.group.members",
    items: [
      { command: "generateInviteCode", label: "command.generateInviteCode" },
    ],
  },
  {
    group: "dashboard.group.danger",
    items: [
      { command: "leaveWorkspace", label: "command.leaveWorkspace" },
      { command: "deleteWorkspace", label: "command.deleteWorkspace" },
    ],
  },
];

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
    ];
    for (const select of slices) {
      this.disposables.push(selectAndSubscribe(select, push));
    }
  }

  resolveWebviewView(view: WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = renderDashboard();
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
  }): void {
    switch (message.type) {
      case "ready":
        this.push();
        return;
      case "command":
        if (message.command && message.id) {
          this.run(message.command, message.id);
        }
        return;
      case "menu":
        if (message.id) void this.showMenu(message.kind ?? "app", message.id);
        return;
      case "inspect":
        // Opening a row asks for the full status (uptime, storage, network),
        // which the list endpoint doesn't carry.
        if (message.id) void this.extension.api.refreshStatus(message.id);
        return;
      case "service":
        commands.executeCommand(`${ExtensionID}.showServiceStatus`);
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
      const application = target as BaseApplication;
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
                    ? { command: "startEntry", label: "command.start" }
                    : { command: "stopEntry", label: "command.stop" },
                  ...(running
                    ? [{ command: "restartEntry", label: "command.restart" }]
                    : []),
                  ...section.items,
                  favorited
                    ? {
                        command: "unfavoriteEntry",
                        label: "command.unfavorite",
                      }
                    : { command: "favoriteEntry", label: "command.favorite" },
                ],
              }
            : section,
        );
    }

    const entries: Array<PickEntry<string>> = groups.flatMap((section) => [
      { separator: t(section.group) },
      ...section.items.map((item) => ({
        id: item.command,
        label: t(item.label),
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
          language: application.language,
          cluster: application.cluster,
          ram: application.ram,
          domain: application.custom ?? application.domain,
          favorited: isFavorited(application.id),
          running: status?.running,
          cpu: status?.usage?.cpu,
          ramUsage: status?.usage?.ram,
          uptime: status?.isFull()
            ? status.uptime?.toLocaleString()
            : undefined,
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
      workspaces: state.workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        members: t("dashboard.members", {
          COUNT: String(workspace.memberList.length),
        }),
        apps: t("dashboard.apps", {
          COUNT: String(workspace.applicationList.length),
        }),
      })),
    });
  }

  dispose(): void {
    for (const disposable of this.disposables) disposable.dispose();
  }
}
