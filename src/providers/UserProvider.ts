import CacheManager from '../managers/CacheManager';
import * as vscode from 'vscode';
import * as path from 'path';

export class AppsProvider implements vscode.TreeDataProvider<GenericTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    GenericTreeItem | undefined | void
  > = new vscode.EventEmitter<GenericTreeItem | undefined | void>();

  readonly onDidChangeTreeData: vscode.Event<
    GenericTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  protected websiteOnly?: boolean;

  constructor(private cache: CacheManager) {
    cache.refreshUser();

    cache.on('refreshUser', () => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GenericTreeItem): GenericTreeItem {
    return element;
  }

  async getChildren(element?: GenericTreeItem): Promise<GenericTreeItem[]> {
    const { user } = this.cache;

    console.log(user);

    return [];
  }
}

export class GenericTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = 0,
    public readonly iconName?: string,
    public readonly description?: string
  ) {
    super(label, collapsibleState);
    this.description = description;
  }

  iconPath = {
    light: path.join(
      __dirname,
      '..',
      '..',
      'resources',
      'light',
      `${this.iconName}.svg`
    ),
    dark: path.join(
      __dirname,
      '..',
      '..',
      'resources',
      'dark',
      `${this.iconName}.svg`
    ),
  };
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
