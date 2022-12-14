import { SquareCloud } from './SquareCloud';

export type ExecuteCommand = (ctx: SquareCloud) => any;

export class Command {
  public name: string;
  public execute: ExecuteCommand;

  constructor(name: string, execute: ExecuteCommand) {
    this.name = 'squarecloud.' + name;
    this.execute = execute;
  }
}
