import commandManager from '../managers/command.manager';
import { ApplicationTreeItem } from '../items';

export type ExecuteApplicationCommand = (
  element: ApplicationTreeItem,
  ...args: any[]
) => any;

export class ApplicationCommand {
  public name: string;

  constructor(name: string, public execute: ExecuteApplicationCommand) {
    this.name = 'squarecloud.' + name;

    commandManager.registerCommands(this);
  }
}
