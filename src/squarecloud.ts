import * as vscode from 'vscode';
import commandManager from './managers/command.manager';

export class SquareCloud {
  constructor(public readonly context: vscode.ExtensionContext) {
    commandManager.loadCommands(this);
  }
}
