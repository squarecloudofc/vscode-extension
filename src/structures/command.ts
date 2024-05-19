import { ExtensionID } from "@/lib/constants";
import type { SquareEasyExtension } from "@/managers/extension";

export type CommandExecute = (
	extension: SquareEasyExtension,
	...args: any[]
) => void;

export class Command {
	constructor(
		public name: string,
		public execute: CommandExecute,
	) {
		this.name = `${ExtensionID}.${this.name}`;
	}
}
