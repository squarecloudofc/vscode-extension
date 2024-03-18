import { BaseTreeViewProvider } from "../base";
import { ApplicationTreeItem, SquareTreeItem } from "./item";
import { GenericTreeItem } from "../items/generic";
import { t } from "vscode-ext-localisation";
import applications from "../../store/applications";
import { coreConfig } from "../../config/core";

export type GenericTreeItemData = ConstructorParameters<typeof GenericTreeItem>;

export class ApplicationsTreeViewProvider extends BaseTreeViewProvider<SquareTreeItem> {
  async getChildren(element?: SquareTreeItem | undefined): Promise<SquareTreeItem[] | null | undefined> {
    const contextValue = element && "contextValue" in element ? element.contextValue : undefined;

    if (contextValue?.includes("application") && element instanceof ApplicationTreeItem) {
      if (!element.status) {
        return [];
      }

      const treeItemsData: GenericTreeItemData[] = [
        ["CPU", "cpu", element.status.usage.cpu],
        ["RAM", "ram", element.status.usage.ram],
      ];

      return treeItemsData.map((parameters) => new GenericTreeItem(...parameters));
    }

    if (!applications.get().applications.length) {
      if (!coreConfig.apiKey) {
        return [];
      }

      return [new GenericTreeItem(t("generic.loading"), "loading", undefined, "loading")];
    }

    return applications.get().applications.map((app) => new ApplicationTreeItem(app));
  }
}
