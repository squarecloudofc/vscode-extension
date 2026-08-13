import {
  type Disposable,
  StatusBarAlignment,
  type StatusBarItem,
  ThemeColor,
  window,
} from "vscode";

import { selectAndSubscribe } from "@/lib/store";
import { isServiceHealthy } from "@/lib/utils/service-status";

import type { SquareCloudExtension } from "./extension";

/**
 * Lightweight status bar item that surfaces extension state at a glance:
 * - Loading while the first refresh runs
 * - Count of online/total apps once loaded
 * - Service status warning when Square Cloud reports degraded health
 *
 * Subscribes per slice (apps, statuses, user, appsLoaded, serviceStatus) so
 * the render only runs when something it actually displays changed.
 */
export class StatusBarManager implements Disposable {
  private readonly item: StatusBarItem;
  private readonly disposables: Disposable[] = [];

  constructor(private readonly extension: SquareCloudExtension) {
    this.item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    this.item.tooltip = "Square Cloud — click to refresh";
    this.item.show();
    this.disposables.push(this.item);

    const onChange = () => this.render();
    this.disposables.push(
      selectAndSubscribe((s) => s.applications, onChange),
      selectAndSubscribe((s) => s.statuses, onChange),
      selectAndSubscribe((s) => s.user, onChange),
      selectAndSubscribe((s) => s.appsLoaded, onChange),
      selectAndSubscribe((s) => s.serviceStatus, onChange),
    );
  }

  private render(): void {
    const { appsLoaded, applications, statuses, serviceStatus, user } =
      this.extension.store.value;

    if (!user && !appsLoaded) {
      this.item.text = "$(sync~spin) Square Cloud";
      this.item.backgroundColor = undefined;
      this.item.command = "squarecloud.refreshCache";
      return;
    }

    if (!user) {
      this.item.text = "$(key) Square Cloud: sign in";
      this.item.backgroundColor = new ThemeColor(
        "statusBarItem.warningBackground",
      );
      this.item.command = "squarecloud.setApiKey";
      return;
    }

    this.item.command = "squarecloud.refreshCache";

    if (!isServiceHealthy(serviceStatus)) {
      this.item.text = `$(warning) Square Cloud — ${serviceStatus?.status}`;
      this.item.tooltip = serviceStatus?.message ?? this.item.tooltip;
      this.item.backgroundColor = new ThemeColor(
        "statusBarItem.warningBackground",
      );
      return;
    }

    const total = applications.size;
    const online = Array.from(statuses.values()).filter(
      (s) => s.running,
    ).length;

    this.item.text = `$(cloud) ${online}/${total}`;
    this.item.backgroundColor = undefined;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
