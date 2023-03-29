import commandManager from '../managers/command.manager';
import { SquareCloud } from '../squarecloud';

export type ExecuteCommand = (ctx: SquareCloud, ...args: any[]) => any;

export class Command {
  public name: string;

  constructor(name: string, public execute: ExecuteCommand) {
    this.name = 'squarecloud.' + name;

    commandManager.registerCommands(this);
  }
}
