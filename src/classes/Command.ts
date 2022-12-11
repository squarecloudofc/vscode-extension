import CommandManager from '../CommandManager';
import * as vs from 'vscode';

export type ExecuteCommand = (vscode: typeof vs) => any;

export class Command {
  public name: string;
  public execute: ExecuteCommand;

  constructor(name: string, execute: ExecuteCommand) {
    this.name = 'squarecloud.' + name;
    this.execute = execute;

    CommandManager.registerCommand(this);
  }
}
