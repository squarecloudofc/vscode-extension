import * as vscode from 'vscode';
import { getIconPaths } from '../helpers/files.helper';
import cacheManager from '../managers/cache.manager';
import { Application } from '../structures/application';

export default class ApplicationTreeItem extends vscode.TreeItem {
  contextValue = this.application.isWebsite ? 'square-site' : 'square-bot';
  collapsibleState = this.status
    ? vscode.TreeItemCollapsibleState.Collapsed
    : vscode.TreeItemCollapsibleState.None;
  iconPath = getIconPaths(
    this.status
      ? this.status.running
        ? 'app-online.svg'
        : 'app-offline.svg'
      : 'ripple.svg'
  );

  constructor(public readonly application: Application) {
    super(application.tag);

    this.tooltip = application.id;

    if (!this.status) {
      cacheManager.refreshStatus(application.id, true);
    }
  }

  get status() {
    return cacheManager.status.get(this.application.id);
  }
}
