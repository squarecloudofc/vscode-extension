import * as vscode from "vscode";

import type { Command } from "@/structures/command";
import { Logger } from "@/structures/logger";

import type { SquareCloudExtension } from "./extension";
import * as commands from "../commands";

export class CommandsManager {
  private readonly logger = new Logger("Square Cloud");

  constructor(private readonly extension: SquareCloudExtension) {
    this.loadCommands();
  }

  async loadCommands() {
    let commandCounter = 0;

    for (const command of Object.values(commands) as Command[]) {
      const disposable = vscode.commands.registerCommand(
        command.name,
        (...args) => command.execute(this.extension, ...args),
      );

      this.extension.context.subscriptions.push(disposable);
      commandCounter++;
    }

    this.logger.log(`Loaded ${commandCounter} commands.`);
  }
}
