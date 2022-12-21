import { SquareCloud } from './SquareCloud';

export type ExecuteCommand = (ctx: SquareCloud, arg: any) => any;

export class Command {
  public name: string;
  public execute: ExecuteCommand;

  constructor(name: string, execute: ExecuteCommand) {
    this.name = 'squarecloud.' + name;
    this.execute = execute;
  }
}
