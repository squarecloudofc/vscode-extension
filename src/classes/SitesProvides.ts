import { AxiosStatic } from 'axios';
import * as vscode from 'vscode';
import * as path from 'path';

const axios: AxiosStatic = require('axios');

export class SitesProvider implements vscode.TreeDataProvider<ApplicationItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ApplicationItem | undefined | void
  > = new vscode.EventEmitter<ApplicationItem | undefined | void>();

  readonly onDidChangeTreeData: vscode.Event<
    ApplicationItem | undefined | void
  > = this._onDidChangeTreeData.event;

  constructor(private apiKey: string | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ApplicationItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ApplicationItem): Promise<ApplicationItem[]> {
    if (!this.apiKey) {
      return [];
    }

    const applications = await this.getApplications();

    if (!applications) {
      return [];
    }

    return applications
      .filter((app) => app.isWebsite)
      .map(
        (app) =>
          new ApplicationItem(app, vscode.TreeItemCollapsibleState.Collapsed)
      );
  }

  async getApplications(): Promise<Application[] | undefined> {
    const data = await axios
      .get('https://api.squarecloud.app/v1/public/user', {
        headers: { authorization: this.apiKey },
      })
      .then((r) => r.data)
      .catch(() => null);

    if (!data) {
      return;
    }

    if (data.status === 'error') {
      vscode.window.showErrorMessage(
        'Error while trying to load applications.'
      );

      return;
    }

    return data.response.applications;
  }
}

export class ApplicationItem extends vscode.TreeItem {
  constructor(
    public readonly app: Application,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(app.tag, collapsibleState);

    this.tooltip = `${app.id}`;
  }

  iconPath = {
    light: path.join(
      __dirname,
      '..',
      '..',
      'resources',
      'light',
      'squarecloud.svg'
    ),
    dark: path.join(
      __dirname,
      '..',
      '..',
      'resources',
      'dark',
      'squarecloud.svg'
    ),
  };

  contextValue = 'application';
}

interface Application {
  id: string;
  tag: string;
  ram: number;
  lang: 'javascript' | 'typescript' | 'python' | 'java';
  type: 'free' | 'paid';
  avatar: string;
  cluster: string;
  isWebsite: boolean;
}
