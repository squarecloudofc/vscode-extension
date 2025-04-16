import type { Command } from "@/structures/command";
import { Logger } from "@/structures/logger";
import * as vscode from "vscode";
import * as commands from "../commands";
import type { SquareEasyExtension } from "./extension";

export class CommandsManager {
	private readonly logger = new Logger("Square Cloud Easy");

	constructor(private readonly extension: SquareEasyExtension) {
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
