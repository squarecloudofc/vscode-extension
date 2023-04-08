import commandManager from '../managers/command.manager';

export type ExecuteCommand = (...args: any[]) => any;

export class Command {
  public name: string;

  constructor(name: string, public execute: ExecuteCommand) {
    this.name = 'squarecloud.' + name;

    commandManager.registerCommands(this);
  }
}
