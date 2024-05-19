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

			this.extension.context.subscriptions.push(
				commands.registerCommand(command.name, command.execute),
			);
			commandCounter++;
		}

		this.logger.log(`Loaded ${commandCounter} commands.`);
	}
}
