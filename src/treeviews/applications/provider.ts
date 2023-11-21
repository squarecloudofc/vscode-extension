import { ProviderResult } from "vscode";
import { BaseTreeViewProvider } from "../base";
import { ApplicationTreeItem, SquareTreeItem } from "./item";
import { GenericTreeItem } from "../items/generic";

export class ApplicationsTreeViewProvider extends BaseTreeViewProvider<SquareTreeItem> {
  async getChildren(element?: SquareTreeItem | undefined): ProviderResult<SquareTreeItem[]> {
    const { contextValue } = element || {};

    if (contextValue?.includes("application") && element instanceof ApplicationTreeItem) {
      if (!element.status) {
        return [];
      }

      const treeItemsData: { label: string; iconName: string; description: string }[] = [];

      return treeItemsData.map((data) => new GenericTreeItem(data.label, data.iconName, data.description));
    }

    return [];
  }
}
