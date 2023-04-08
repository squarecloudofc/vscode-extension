import * as vscode from 'vscode';
import cacheManager from './cache.manager';

class ConfigManager {
  private readonly defaultConfig =
    vscode.workspace.getConfiguration('squarecloud');

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

  get apiKey() {
    return <string | undefined>this.defaultConfig.get('apiKey');
  }
}

export default new ConfigManager();
