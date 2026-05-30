import { window } from "vscode";

import type { SquareCloudExtension } from "@/managers/extension";
import type { ApplicationTreeItem } from "@/treeviews/applications/item";
import { ExtensionID } from "@/lib/constants";
import { describeError } from "@/lib/utils/errors";

import { Logger } from "../logger";

export type CommandExecute = (
  extension: SquareCloudExtension,
  treeItem: ApplicationTreeItem,
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
    treeItem: ApplicationTreeItem,
    ...args: any[]
  ): Promise<void> {
    try {
      await this.handler(extension, treeItem, ...args);
    } catch (error) {
      logger.error(`Command ${this.name} failed`, error);
      window.showErrorMessage(describeError(error));
    }
  }
}
