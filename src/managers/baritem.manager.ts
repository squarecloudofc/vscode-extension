import * as vscode from 'vscode';

class BarItemManager {
  loadBarItem(context: vscode.ExtensionContext) {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    statusBarItem.text = '$(cloud-upload) Square Cloud';
    statusBarItem.command = 'squarecloud.statusBarItem';

    if (this.available) {
      statusBarItem.show();
    }

    this.listenWorkspaceFolderChange(statusBarItem);
    context.subscriptions.push(statusBarItem);
  }

  listenWorkspaceFolderChange(statusBarItem: vscode.StatusBarItem) {
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (this.available) {
        statusBarItem.show();
      } else {
        statusBarItem.hide();
      }
    });
  }

  get available() {
    return vscode.workspace.workspaceFolders?.length === 1;
  }
}

export default new BarItemManager();
