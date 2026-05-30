import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";

import { BaseTreeViewProvider } from "../base";
import { emptyOrLoading } from "../empty-state";
import { GenericTreeItem } from "../items/generic";
import { WorkspaceTreeItem, type WorkspaceTreeNode } from "./item";

export class WorkspacesTreeViewProvider extends BaseTreeViewProvider<WorkspaceTreeNode> {
  constructor(private readonly extension: SquareCloudExtension) {
    super();
  }

  async getChildren(
    element?: WorkspaceTreeNode,
  ): Promise<WorkspaceTreeNode[] | null | undefined> {
    if (element instanceof WorkspaceTreeItem) {
      const ws = element.workspace;
      const items: GenericTreeItem[] = [
        new GenericTreeItem("ID", "id", ws.id),
        new GenericTreeItem(t("workspace.owner"), "username", ws.owner),
        new GenericTreeItem(
          t("workspace.createdAt"),
          "calendar",
          ws.createdAt.toLocaleDateString(),
        ),
      ];
      for (const member of ws.memberList) {
        items.push(new GenericTreeItem(member.name, "username", member.group));
      }
      for (const app of ws.applicationList) {
        items.push(
          new GenericTreeItem(app.name, "online", `${app.lang} · ${app.ram}MB`),
        );
      }
      return items;
    }

    const { workspaces } = this.extension.store.value;
    if (workspaces.length === 0) {
      return emptyOrLoading(this.extension, () => [
        new GenericTreeItem(
          t("workspace.empty"),
          "plan",
          t("workspace.emptyHint"),
        ),
      ]);
    }
    return workspaces.map((ws) => new WorkspaceTreeItem(ws));
  }
}
