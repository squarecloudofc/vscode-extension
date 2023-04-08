import commandManager from '../managers/command.manager';
import { SquareCloud } from '../squarecloud';
import { ApplicationTreeItem } from '../treeitems';

export type ExecuteApplicationCommand = (
  ctx: SquareCloud,
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
