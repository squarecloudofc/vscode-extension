import { BaseTreeViewProvider } from "../base";
import { ApplicationTreeItem, SquareTreeItem } from "./item";
import { GenericTreeItem } from "../items/generic";
import { t } from "vscode-ext-localisation";
import applications from "../../store/applications";
import { configCore } from "../../config/core";

export class ApplicationsTreeViewProvider extends BaseTreeViewProvider<SquareTreeItem> {
  async getChildren(element?: SquareTreeItem | undefined): Promise<SquareTreeItem[] | null | undefined> {
    const contextValue = element && "contextValue" in element ? element.contextValue : undefined;

    if (contextValue?.includes("application") && element instanceof ApplicationTreeItem) {
      if (!element.status) {
        return [];
      }

      const treeItemsData: { label: string; iconName: string; description: string }[] = [];

      return treeItemsData.map((data) => new GenericTreeItem(data.label, data.iconName, data.description));
    }

    if (!applications.get().applications.length) {
      if (!configCore.apiKey) {
        return [];
      }

      return [new GenericTreeItem(t("generic.loading"), "loading", undefined, "loading")];
    }

    return applications.get().applications.map((app) => new ApplicationTreeItem(app));
  }
}
