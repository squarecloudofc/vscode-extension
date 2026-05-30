import type { Workspace } from "@squarecloud/api";
import { TreeItem, TreeItemCollapsibleState } from "vscode";

import { getIcons } from "@/lib/utils/icons";

import type { GenericTreeItem } from "../items/generic";

export type WorkspaceTreeNode = WorkspaceTreeItem | GenericTreeItem;

export class WorkspaceTreeItem extends TreeItem {
  collapsibleState = TreeItemCollapsibleState.Collapsed;
  iconPath = getIcons("plan.svg");
  contextValue = "workspace";

  constructor(public readonly workspace: Workspace) {
    super(workspace.name);
    this.tooltip = `${workspace.id} (${workspace.memberList.length} members, ${workspace.applicationList.length} apps)`;
    this.description = `${workspace.memberList.length}m · ${workspace.applicationList.length}a`;
  }
}
