import * as vscode from "vscode";
import { getIconPaths } from "../helpers/files.helper";
import cacheManager from "../managers/cache.manager";
import { Application } from "../structures/application";

export default class ApplicationTreeItem extends vscode.TreeItem {
  tooltip = this.application.id;
  collapsibleState = this.status?.running
    ? vscode.TreeItemCollapsibleState.Collapsed
    : vscode.TreeItemCollapsibleState.None;

  contextValue = cacheManager.isFavorited(this.application.id)
    ? "square-favorite"
    : this.application.isWebsite
      ? "square-site"
      : "square-bot";

  iconPath = getIconPaths(this.status ? (this.status.running ? "app-online.svg" : "app-offline.svg") : "ripple.svg");

  constructor(public readonly application: Application) {
    super(application.tag);

    if (!this.status) {
      cacheManager.refreshStatus(application.id, true);
    }
  }

  get status() {
    return cacheManager.status.get(this.application.id);
  }
}
