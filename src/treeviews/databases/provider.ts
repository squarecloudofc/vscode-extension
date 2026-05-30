import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";

import { BaseTreeViewProvider } from "../base";
import { emptyOrLoading } from "../empty-state";
import { GenericTreeItem } from "../items/generic";
import { DatabaseTreeItem, type DatabaseTreeNode } from "./item";

export class DatabasesTreeViewProvider extends BaseTreeViewProvider<DatabaseTreeNode> {
  constructor(private readonly extension: SquareCloudExtension) {
    super();
  }

  async getChildren(
    element?: DatabaseTreeNode,
  ): Promise<DatabaseTreeNode[] | null | undefined> {
    if (element instanceof DatabaseTreeItem) {
      const db = element.database;
      return [
        new GenericTreeItem("ID", "id", db.id),
        new GenericTreeItem(t("database.engine"), "engine", db.type),
        new GenericTreeItem("RAM", "ram", `${db.ram}MB`),
        ...(db.port !== undefined
          ? [
              new GenericTreeItem(
                t("database.port"),
                "network",
                String(db.port),
              ),
            ]
          : []),
        new GenericTreeItem(t("database.cluster"), "cpu", db.cluster),
        new GenericTreeItem(
          t("database.createdAt"),
          "calendar",
          db.createdAt.toLocaleDateString(),
        ),
      ];
    }

    const { databases } = this.extension.store.value;
    if (databases.size === 0) {
      return emptyOrLoading(this.extension, () => [
        new GenericTreeItem(
          t("database.empty"),
          "plan",
          t("database.emptyHint"),
        ),
      ]);
    }
    return Array.from(databases.values()).map((db) => new DatabaseTreeItem(db));
  }
}
