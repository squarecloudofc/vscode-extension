import * as vscode from 'vscode';
import { set } from '../helpers/config.helper';
import cacheManager from './cache.manager';

class ConfigManager {
  setUpListeners() {
    this.listenApiKeyChange();
    this.listenWorkspaceAppChange();
  }

  listenApiKeyChange() {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('squarecloud.apiKey') || !this.apiKey) {
        return;
      }
      cacheManager.refreshData(true);
    });
  }

  listenWorkspaceAppChange() {
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!event.affectsConfiguration('squarecloud.workspaceAppId')) {
        return;
      }

      const path = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!path) {
        return;
      }

      const appId = this.defaultConfig.get('workspaceAppId');

      set(path, { ID: appId });
    });
  }

  setApiKey(key: string) {
    return this.defaultConfig.update('apiKey', key, true);
  }

  get defaultConfig() {
    return vscode.workspace.getConfiguration('squarecloud');
  }

  get apiKey() {
    return <string | undefined>this.defaultConfig.get('apiKey');
  }
}

export default new ConfigManager();
