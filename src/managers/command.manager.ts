import * as vscode from "vscode";
import { getDirectoryFiles } from "../helpers/files.helper";
import { SquareCloud } from "../squarecloud";
import { Command } from "../structures/command";

class CommandManager {
  private commands: Command[] = [];

  registerCommands(command: Command) {
    this.commands.push(command);
  }

  loadCommands(instance: SquareCloud) {
    const files = getDirectoryFiles("commands");
    files.map(require);

    for (const { name, execute } of this.commands) {
      const disposable = vscode.commands.registerCommand(name, (...args) => {
        execute(...args);
      });
      instance.context.subscriptions.push(disposable);
    }
  }
}

export default new CommandManager();
