import { ApplicationTreeItem } from "../items";
import commandManager from "../managers/command.manager";

export type ExecuteApplicationCommand = (element: ApplicationTreeItem, ...args: any[]) => any;

export class ApplicationCommand {
  public name: string;

  constructor(
    name: string,
    public execute: ExecuteApplicationCommand,
  ) {
    this.name = "squarecloud." + name;

    commandManager.registerCommands(this);
  }
}
