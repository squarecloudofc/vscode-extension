import type { BaseApplication } from "@squarecloud/api";
import { window } from "vscode";

import type { SquareCloudExtension } from "@/managers/extension";
import { ExtensionID } from "@/lib/constants";
import { describeError } from "@/lib/utils/errors";

import { Logger } from "../logger";

/**
 * All these commands ever read off their argument is the application, which is
 * why the dashboard can drive them with a plain object.
 */
export interface ApplicationTarget {
  application: BaseApplication;
}

export type CommandExecute = (
  extension: SquareCloudExtension,
  target: ApplicationTarget,
  ...args: any[]
) => unknown | Promise<unknown>;

const logger = new Logger("AppCommand");

/**
 * Variant of `Command` for tree-item-bound actions. Identical error handling
 * to the base command — wrapped so we never let a rejected promise become a
 * silent failure in the UI.
 */
export class ApplicationCommand {
  public readonly name: string;

  constructor(
    name: string,
    private readonly handler: CommandExecute,
  ) {
    this.name = `${ExtensionID}.${name}`;
  }

  async execute(
    extension: SquareCloudExtension,
    target: ApplicationTarget,
    ...args: any[]
  ): Promise<void> {
    try {
      await this.handler(extension, target, ...args);
    } catch (error) {
      logger.error(`Command ${this.name} failed`, error);
      window.showErrorMessage(describeError(error));
    }
  }
}
