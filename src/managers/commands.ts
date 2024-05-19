import { getAllFiles } from "@/lib/utils/files";
import type { Command } from "@/structures/command";
import { Logger } from "@/structures/logger";
import { commands } from "vscode";
import type { SquareEasyExtension } from "./extension";

export class CommandsManager {
	private readonly logger = new Logger("Square Cloud Easy");

	constructor(private readonly extension: SquareEasyExtension) {
		this.loadCommands();
	}

	async loadCommands() {
		const commandFiles = getAllFiles("commands");
		let commandCounter = 0;

		for (const file of commandFiles) {
			const command: Command = (await import(file)).default;
			if (!command) continue;

			const disposable = commands.registerCommand(command.name, (...args) =>
				command.execute(this.extension, ...args),
			);

			this.extension.context.subscriptions.push(disposable);
			commandCounter++;
		}

		this.logger.log(`Loaded ${commandCounter} commands.`);
	}
}
