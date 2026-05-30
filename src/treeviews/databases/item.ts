import type { Database } from "@squarecloud/api";
import { TreeItem, TreeItemCollapsibleState } from "vscode";

import { getIcons } from "@/lib/utils/icons";

import type { GenericTreeItem } from "../items/generic";

export type DatabaseTreeNode = DatabaseTreeItem | GenericTreeItem;

export class DatabaseTreeItem extends TreeItem {
  collapsibleState = TreeItemCollapsibleState.Collapsed;
  iconPath = getIcons("storage.svg");
  contextValue = "database";

  constructor(public readonly database: Database) {
    super(database.name);
    this.tooltip = `${database.id} (${database.type})`;
    this.description = `${database.type} · ${database.ram}MB`;
  }
}
