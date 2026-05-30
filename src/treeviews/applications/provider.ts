import { Uri } from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import type { ApplicationStatus } from "@/structures/application/status";
import { formatTime } from "@/lib/utils/format";
import { getLocale } from "@/lib/utils/locale";

import { BaseTreeViewProvider } from "../base";
import { emptyOrLoading } from "../empty-state";
import { CustomTreeItem } from "../items/custom";
import { GenericTreeItem } from "../items/generic";
import { ApplicationTreeItem, type SquareTreeItem } from "./item";

export type GenericTreeItemData = ConstructorParameters<typeof GenericTreeItem>;

export class ApplicationsTreeViewProvider extends BaseTreeViewProvider<SquareTreeItem> {
  // Tracks apps whose full status is in flight to avoid stacking fetches when
  // VSCode calls getChildren repeatedly while the user expands/collapses.
  private readonly fullStatusInFlight = new Set<string>();

  constructor(private readonly extension: SquareCloudExtension) {
    super();
  }

  async getChildren(
    element?: SquareTreeItem | undefined,
  ): Promise<SquareTreeItem[] | null | undefined> {
    if (element instanceof ApplicationTreeItem) {
      return this.getApplicationChildren(element);
    }

    if (!this.extension.store.value.applications.size) {
      return this.getEmptyState();
    }

    return Array.from(this.extension.store.value.applications.values())
      .sort(
        (a, b) =>
          (this.extension.store.actions.isFavorited(b.id) ? 1 : 0) -
          (this.extension.store.actions.isFavorited(a.id) ? 1 : 0),
      )
      .map((app) => new ApplicationTreeItem(this.extension, app));
  }

  private async getApplicationChildren(
    element: ApplicationTreeItem,
  ): Promise<SquareTreeItem[]> {
    if (!element.status) return [];

    const status = this.extension.store.actions.getStatus(
      element.application.id,
    );

    if (!status?.isFull()) {
      this.ensureFullStatus(element.application.id);
    }

    const treeItemsData: GenericTreeItemData[] = [
      ["CPU", "cpu", element.status.usage?.cpu],
      ["RAM", "ram", element.status.usage?.ram],
    ];

    if (status?.isFull()) {
      // TS doesn't propagate the `Full = true` narrowing from the type guard
      // through the generic class param — assert here so we keep the typed
      // `network` / `storage` access without a wider refactor of the wrapper.
      const fullStatus = status as ApplicationStatus<true>;
      const uptime = fullStatus.uptimeTimestamp
        ? formatTime(Date.now() - fullStatus.uptimeTimestamp)
        : "Offline";

      treeItemsData.push(
        ["Uptime", "uptime", uptime],
        [t("generic.network"), "network", fullStatus.usage.network.now],
        [t("generic.storage"), "storage", fullStatus.usage.storage],
      );
    } else {
      treeItemsData.push([t("generic.loading"), "loading"]);
    }

    return treeItemsData.map(
      (parameters) => new GenericTreeItem(...parameters),
    );
  }

  private getEmptyState(): Promise<SquareTreeItem[]> {
    return emptyOrLoading(this.extension, () => {
      const locale = getLocale();
      return [
        new GenericTreeItem(
          t("apps.noApps.message"),
          "plan",
          t("apps.noApps.description"),
        ),
        new CustomTreeItem(
          t("apps.noApps.upgrade"),
          {
            command: "vscode.open",
            title: t("apps.noApps.upgrade"),
            arguments: [Uri.parse(`https://squarecloud.app/${locale}/pricing`)],
          },
          "open",
        ),
      ];
    });
  }

  /**
   * Triggers a one-time refresh of the full status for an app. Subsequent
   * calls while the same fetch is in flight are no-ops so we don't queue up
   * duplicate work when the user expands/collapses rapidly.
   */
  private ensureFullStatus(appId: string): void {
    if (this.fullStatusInFlight.has(appId)) return;
    this.fullStatusInFlight.add(appId);
    void this.extension.api
      .refreshStatus(appId)
      .finally(() => this.fullStatusInFlight.delete(appId));
  }
}
