import { t } from 'vscode-ext-localisation';
import { Command } from './classes/Command';
import * as vscode from 'vscode';

class CommandManager {
  commands: vscode.Disposable[] = [];

  registerCommand(command: Command) {
    this.commands.push(
      vscode.commands.registerCommand(command.name, () =>
        command.execute(vscode)
      )
    );
  }
}

export default new CommandManager();
