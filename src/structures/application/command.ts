import { ExtensionID } from "@/lib/constants";
import type { SquareEasyExtension } from "@/managers/extension";
import type { ApplicationTreeItem } from "@/treeviews/applications/item";

export type CommandExecute = (
	extension: SquareEasyExtension,
	treeItem: ApplicationTreeItem,
	...args: any[]
) => void;

export class ApplicationCommand {
	/**
	 * Constructs a new instance of the class.
	 *
	 * @param name - The name of the command.
	 * @param execute - The function to execute when the command is triggered.
	 */
	constructor(
		public name: string,
		public execute: CommandExecute,
	) {
		this.name = `${ExtensionID}.${this.name}`;
	}
}
