import * as vscode from 'vscode';
import type { Command } from '../structures/command';
import { getDirectoryFiles } from '../helpers/files.helper';
import { SquareCloud } from '../squarecloud';

class CommandManager {
  private commands: Command[] = [];

  registerCommands(command: Command) {
    this.commands.push(command);
  }

  loadCommands(instance: SquareCloud) {
    const files = getDirectoryFiles('commands');
    files.map(require);

    for (const { name, execute } of this.commands) {
      const disposable = vscode.commands.registerCommand(name, (...args) => {
        execute(instance, ...args);
      });
      instance.context.subscriptions.push(disposable);
    }
  }
}

export default new CommandManager();
