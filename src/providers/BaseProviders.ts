import CacheManager from '../managers/CacheManager';
import { Application } from '@squarecloud/api';
import getIconPath from '../utils/getIconPath';
import * as vscode from 'vscode';

export class BaseProvider<
  TreeItemType extends vscode.TreeItem = vscode.TreeItem
> implements vscode.TreeDataProvider<TreeItemType>
{
  protected _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItemType | undefined | void
  >();

  readonly onDidChangeTreeData: vscode.Event<TreeItemType | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(protected cache: CacheManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItemType) {
    return element;
  }

  async getChildren(element?: TreeItemType): Promise<TreeItemType[]> {
    return [];
  }
}

export class CustomTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly command: vscode.Command,
    public readonly iconName?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
  }

  iconPath = getIconPath(`${this.iconName}.svg`);
}

export class GenericTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly iconName?: string,
    public readonly description?: string,
    public readonly contextValue: string = 'generic'
  ) {
    super(label, 0);
    this.description = description;
  }

  iconPath = getIconPath(`${this.iconName}.svg`);

  command: vscode.Command = {
    command: 'squarecloud.copyText',
    title: 'Copy',
  };
}

export class ApplicationItem extends vscode.TreeItem {
  constructor(public readonly app: Application, public cache: CacheManager) {
    super(app.tag);

    this.tooltip = app.id;

    if (!this.status) {
      cache.refreshStatus(app.id, true);
    }
  }

  get status() {
    return this.cache.status.get(this.app.id);
  }

  collapsibleState = this.status ? 1 : 0;

  iconPath = getIconPath(
    this.status
      ? this.status.running
        ? 'app-online.svg'
        : 'app-offline.svg'
      : 'ripple.svg'
  );

  contextValue = this.app.isWebsite ? 'square-site' : 'square-bot';
}

export type TreeItem = ApplicationItem | GenericTreeItem | CustomTreeItem;
