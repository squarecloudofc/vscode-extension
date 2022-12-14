import { getVscodeLang, loadTranslations } from 'vscode-ext-localisation';
import { getAllFiles } from '../getAllFiles';
import { Command } from './Command';
import * as vscode from 'vscode';
import { join } from 'path';

export class SquareCloud {
  public config = vscode.workspace.getConfiguration('squarecloud');

  constructor(public context: vscode.ExtensionContext) {}

  loadCommands() {
    const files = getAllFiles(join(__dirname, 'commands'));

    for (const file of files) {
      const command: Command = require(file).default;

      console.log(command);

      const disposable: vscode.Disposable = vscode.commands.registerCommand(
        command.name,
        () => command.execute(this)
      );

      this.context.subscriptions.push(disposable);
    }
  }

  loadTranslations() {
    loadTranslations(
      getVscodeLang(process.env.VSCODE_NLS_CONFIG),
      this.context.extensionPath
    );
  }
}
