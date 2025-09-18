import type { SquareCloudExtension } from "@/managers/extension";
import { ExtensionID } from "@/lib/constants";

export type CommandExecute = (
  extension: SquareCloudExtension,
  ...args: any[]
) => void;

export class Command {
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
