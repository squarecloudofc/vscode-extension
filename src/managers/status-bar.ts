import {
  type Disposable,
  MarkdownString,
  StatusBarAlignment,
  type StatusBarItem,
  ThemeColor,
  window,
} from "vscode";
import { t } from "vscode-ext-localisation";

import { ExtensionID, LINKS } from "@/lib/constants";
import { type ExtensionStore, selectAndSubscribe } from "@/lib/store";
import { describeCode } from "@/lib/utils/errors";
import { serviceSummary } from "@/lib/utils/service-status";

import type { SquareCloudExtension } from "./extension";

const REFRESH = `${ExtensionID}.refreshCache`;
const SERVICE = `${ExtensionID}.showServiceStatus`;
const CONNECT = `${ExtensionID}.setApiKey`;

/**
 * Lightweight status bar item that surfaces extension state at a glance —
 * loading, sign in, offline, rate-limited, maintenance or degraded service,
 * or how many apps are online — with the detail and the next step in its
 * tooltip. The service has three looks: online (the app count), a warning
 * (maintenance or degraded), or unknown ("couldn't check" in the tooltip,
 * never an error look).
 *
 * Subscribes per slice so the render only runs when something it actually
 * displays changed.
 */
export class StatusBarManager implements Disposable {
  private readonly item: StatusBarItem;
  private readonly disposables: Disposable[] = [];

  constructor(private readonly extension: SquareCloudExtension) {
    this.item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    this.item.name = "Square Cloud";
    this.item.show();
    this.disposables.push(this.item);

    const onChange = () => this.render();
    this.disposables.push(
      selectAndSubscribe((s) => s.applications, onChange),
      selectAndSubscribe((s) => s.statuses, onChange),
      selectAndSubscribe((s) => s.user, onChange),
      selectAndSubscribe((s) => s.appsLoaded, onChange),
      selectAndSubscribe((s) => s.serviceStatus, onChange),
      selectAndSubscribe((s) => s.problem, onChange),
    );
  }

  private render(): void {
    const state = this.extension.store.value;
    const { appsLoaded, serviceStatus, user, problem } = state;
    const summary = serviceSummary(serviceStatus);

    this.item.command = REFRESH;
    this.item.backgroundColor = undefined;
    this.item.tooltip = this.tooltip(state);

    if (!user && !appsLoaded) {
      this.item.text = "$(sync~spin) Square Cloud";
    } else if (problem?.kind === "offline") {
      this.item.text = "$(debug-disconnect) Square Cloud";
    } else if (problem?.kind === "rateLimit") {
      this.item.text = "$(watch) Square Cloud";
    } else if (!user && !problem) {
      this.item.text = `$(key) ${t("statusBar.signIn")}`;
      this.item.backgroundColor = new ThemeColor(
        "statusBarItem.warningBackground",
      );
      this.item.command = CONNECT;
    } else if (!user) {
      this.item.text = "$(warning) Square Cloud";
    } else if (summary === "maintenance" || summary === "degraded") {
      // The count stays; the tooltip says what the status page lists.
      this.item.text = `$(warning) ${online(state)}/${state.applications.size}`;
      this.item.backgroundColor = new ThemeColor(
        "statusBarItem.warningBackground",
      );
      this.item.command = SERVICE;
    } else {
      this.item.text = `$(cloud) ${online(state)}/${state.applications.size}`;
    }
  }

  /** Who is connected, what runs, how the platform is, and what to do next. */
  private tooltip(state: ExtensionStore): MarkdownString {
    const { appsLoaded, serviceStatus, user, problem } = state;
    const md = new MarkdownString("**Square Cloud**\n\n", true);
    md.isTrusted = { enabledCommands: [REFRESH, SERVICE, CONNECT] };

    if (!user && !appsLoaded) return md.appendText(t("generic.loading"));
    if (!user && !problem) return md.appendMarkdown(t("view.welcome"));

    const line = (icon: string, text: string) =>
      md.appendMarkdown(`$(${icon}) `).appendText(text).appendMarkdown("  \n");

    if (user) {
      line("account", `${user.name} · ${user.plan.name}`);
      line(
        "vm-running",
        t("statusBar.online", {
          ONLINE: String(online(state)),
          TOTAL: String(state.applications.size),
        }),
      );
    }
    const summary = serviceSummary(serviceStatus);
    line(SUMMARY_ICON[summary], SUMMARY[summary]());
    for (const incident of serviceStatus?.incidents ?? []) {
      line("dash", `${incident.title} · ${incidentStatus(incident.status)}`);
    }
    if (problem) {
      const icon =
        problem.kind === "offline"
          ? "debug-disconnect"
          : problem.kind === "rateLimit"
            ? "watch"
            : "error";
      line(icon, describeCode(problem.code));
    }

    return md.appendMarkdown(
      [
        `\n[$(refresh) ${t("command.refresh")}](command:${REFRESH})`,
        `[$(pulse) ${t("serviceStatus.title")}](command:${SERVICE})`,
        `[$(link-external) ${t("upload.openDashboard")}](${LINKS.dashboard})`,
      ].join(" · "),
    );
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}

const SUMMARY = {
  online: () => t("serviceStatus.summary.online"),
  maintenance: () => t("serviceStatus.summary.maintenance"),
  degraded: () => t("serviceStatus.summary.degraded"),
  unknown: () => t("serviceStatus.summary.unknown"),
};

const SUMMARY_ICON = {
  online: "pass",
  maintenance: "warning",
  degraded: "warning",
  unknown: "question",
};

function incidentStatus(status: string): string {
  switch (status) {
    case "maintenance":
      return t("serviceStatus.maintenance");
    case "degraded":
      return t("serviceStatus.degraded");
    case "outage":
      return t("serviceStatus.outage");
    case "operational":
      return t("serviceStatus.online");
    default:
      return t("serviceStatus.unknown");
  }
}

/** Own apps only: a workspace app's status can sit in the store too. */
function online(state: ExtensionStore): number {
  return Array.from(state.applications.keys()).filter(
    (id) => state.statuses.get(id)?.running,
  ).length;
}
