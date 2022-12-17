import { Application } from '@squarecloud/api';
import CacheManager from './CacheManager';
import * as vscode from 'vscode';
import { once } from 'events';
import * as path from 'path';

export class AppsProvider
  implements vscode.TreeDataProvider<ApplicationItem | vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ApplicationItem | undefined | void
  > = new vscode.EventEmitter<ApplicationItem | undefined | void>();

  readonly onDidChangeTreeData: vscode.Event<
    ApplicationItem | undefined | void
  > = this._onDidChangeTreeData.event;

  protected websiteOnly?: boolean;

  constructor(private cache: CacheManager) {
    this.refresh();

    cache.on('refresh', () => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ApplicationItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: ApplicationItem
  ): Promise<ApplicationItem[] | vscode.TreeItem[]> {
    let { applications } = this.cache;

    if (!applications?.length) {
      if (!this.cache.api) {
        return [
          new vscode.TreeItem(
            'No API key provided.',
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }

      return [
        new vscode.TreeItem('Loading...', vscode.TreeItemCollapsibleState.None),
      ];
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

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
