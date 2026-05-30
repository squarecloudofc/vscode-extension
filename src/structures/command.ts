import { window } from "vscode";

import type { SquareCloudExtension } from "@/managers/extension";
import { ExtensionID } from "@/lib/constants";
import { describeError } from "@/lib/utils/errors";

import { Logger } from "./logger";

export type CommandExecute = (
  extension: SquareCloudExtension,
  ...args: any[]
) => unknown | Promise<unknown>;

const logger = new Logger("Command");

/**
 * Wraps the user-supplied handler so:
 * - unhandled rejections are caught, logged, and surfaced as a friendly toast,
 * - the command id is registered with the extension's namespace,
 * - synchronous handlers and promise-returning handlers are both supported.
 */
export class Command {
  public readonly name: string;

  constructor(
    name: string,
    private readonly handler: CommandExecute,
  ) {
    this.name = `${ExtensionID}.${name}`;
  }

  async execute(
    extension: SquareCloudExtension,
    ...args: any[]
  ): Promise<void> {
    try {
      await this.handler(extension, ...args);
    } catch (error) {
      logger.error(`Command ${this.name} failed`, error);
      window.showErrorMessage(describeError(error));
    }
  }
}
