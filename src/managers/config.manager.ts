import * as vscode from 'vscode';
import apiService from '../services/api.service';

class ConfigManager {
  private readonly defaultConfig =
    vscode.workspace.getConfiguration('squarecloud');

  constructor() {
    this.onChangeApiKey();
  }

  onChangeApiKey() {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('squarecloud.apiKey') || !this.apiKey) {
        return;
      }
      apiService.setApiKey(this.apiKey);
    });
  }

  get apiKey() {
    return <string | undefined>this.defaultConfig.get('apiKey');
  }
}

export default ConfigManager;
