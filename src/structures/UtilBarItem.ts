import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { SquareCloud } from './SquareCloud';

export class UtilBarItem {
  constructor(public ctx: SquareCloud, public barItem: vscode.StatusBarItem) {
    this.setText(t('generic.loading'));

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

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        !event.affectsConfiguration(
          'squarecloud',
          vscode.workspace.workspaceFolders?.[0]
        )
      ) {
        return;
      }

      this.update();
    });

    ctx.cache.on('refresh', () => this.update());
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

  setCommand(command?: string) {
    this.barItem.command = command;
  }

  setText(text: string) {
    this.barItem.text = `$(cloud-upload) ${text}`;
  }

  update() {
    const workspaceApp = this.getWorkspaceApp();

    if (!workspaceApp) {
      this.setCommand('squarecloud.setWorkspaceApp');
    } else {
      this.setCommand('squarecloud.commitWorkspace');
    }

    this.setText(workspaceApp ? t('utilBarItem.commit') : t('utilBarItem.noApp'));
  }
}
