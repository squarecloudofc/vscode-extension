import * as vscode from "vscode";
import type { BaseApplication } from "@squarecloud/api";
import applications from "../../store/applications";
import { getIcons } from "../../util/icons";
import { CustomTreeItem } from "../items/custom";
import { GenericTreeItem } from "../items/generic";

export type SquareTreeItem = ApplicationTreeItem | CustomTreeItem | GenericTreeItem;

export class ApplicationTreeItem extends vscode.TreeItem {
  tooltip = this.application.id;

  collapsibleState = this.status?.running
    ? vscode.TreeItemCollapsibleState.Collapsed
    : vscode.TreeItemCollapsibleState.None;

  iconPath = getIcons(this.status ? (this.status.running ? "online.svg" : "offline.svg") : "loading.svg");

  contextValue = this.favorited ? "application-fav" : "application";

  constructor(public readonly application: BaseApplication) {
    super(application.tag);
  }

  get favorited() {
    return applications.get().isFavorited(this.application.id);
  }

  get status() {
    return applications.get().getStatus(this.application.id);
  }
}
