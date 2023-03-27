import * as vscode from 'vscode';
import { SquareCloud } from './SquareCloud';

export class UtilBarItem {
  constructor(public ctx: SquareCloud, public barItem: vscode.StatusBarItem) {
    this.barItem.text = 'Square Cloud';
    this.barItem.command = 'squarecloud.workspaceApp';

    if (this.available) {
      barItem.show();
    }

    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (this.available) {
        barItem.show();
      } else {
        barItem.hide();
      }
    });
  }

  get available() {
    return vscode.workspace.workspaceFolders?.length === 1;
  }

  getWorkspaceApp() {
    if (!this.available) {
      return;
    }

    const appId = this.ctx.config.get('workspaceAppId');
    const app = this.ctx.cache.applications.find((app) => app.id === appId);

    return app;
  }
}
