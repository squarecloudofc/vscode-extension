import CacheManager from '../managers/CacheManager';
import { Application } from '@squarecloud/api';
import * as pretty from 'pretty-ms';
import * as vscode from 'vscode';
import * as path from 'path';

export class AppsProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | void
  > = new vscode.EventEmitter<TreeItem | undefined | void>();

  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  protected websiteOnly?: boolean;

  constructor(private cache: CacheManager) {
    cache.refreshApps();

    cache.on('refreshApps', () => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ApplicationItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (
      element?.contextValue === 'application' &&
      element instanceof ApplicationItem
    ) {
      const { status } = element;

      return [
        new GenericTreeItem(
          'Uptime',
          0,
          'uptime',
          pretty(Date.now() - status.uptimeTimestamp, { compact: true })
        ),

        new GenericTreeItem('CPU', 0, 'cpu', status.cpuUsage),
        new GenericTreeItem('RAM', 0, 'ram', status.ramUsage + 'MB'),
        new GenericTreeItem('Network', 0, 'network', status.network.now),
        new GenericTreeItem('Storage', 0, 'storage', status.storageUsage),
      ];
    }

    let { applications } = this.cache;

    if (!applications?.length) {
      if (!this.cache.api) {
        return [new GenericTreeItem('No API key provided.', 0, 'error')];
      }

      return [new GenericTreeItem('Loading...', 0, 'ripple')];
    }

    applications = applications.filter(({ isWebsite }) => {
      return this.websiteOnly ? isWebsite : !isWebsite;
    });

    return await Promise.all(
      applications.map(
        async (app) => new ApplicationItem(app, await app.getStatus())
      )
    );
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

export class ApplicationItem extends vscode.TreeItem {
  constructor(
    public readonly app: Application,
    public readonly status: ThenArg<ReturnType<Application['getStatus']>>,
    public readonly command?: vscode.Command
  ) {
    super(
      app.tag,
      status.running
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.tooltip = `${app.id}`;
  }

  iconPath = {
    light: path.join(
      __dirname,
      '..',
      '..',
      'resources',
      'light',
      this.status.running ? 'app-online.svg' : 'app-offline.svg'
    ),
    dark: path.join(
      __dirname,
      '..',
      '..',
      'resources',
      'dark',
      this.status.running ? 'app-online.svg' : 'app-offline.svg'
    ),
  };

  contextValue = 'application';
}

type TreeItem = ApplicationItem | GenericTreeItem;

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
