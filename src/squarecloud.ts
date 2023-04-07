import * as vscode from 'vscode';
import commandManager from './managers/command.manager';
import squareApiManager from './managers/squarecloud-api.manager';

export class SquareCloud {
  constructor(public readonly context: vscode.ExtensionContext) {
    commandManager.loadCommands(this);
  }

  setApiKey(key: string) {
    squareApiManager.setApiKey(key);
    return this;
  }
}
