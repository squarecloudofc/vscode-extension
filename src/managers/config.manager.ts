import * as vscode from 'vscode';
import cacheManager from './cache.manager';

class ConfigManager {
  constructor() {
    this.listenApiKeyChange();
  }

  listenApiKeyChange() {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('squarecloud.apiKey') || !this.apiKey) {
        return;
      }
      cacheManager.refreshData(true);
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
