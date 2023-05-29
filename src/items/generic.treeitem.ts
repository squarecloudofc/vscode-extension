import * as vscode from 'vscode';
import { getIconPaths } from '../helpers/files.helper';

export default class GenericTreeItem extends vscode.TreeItem {
  iconPath = getIconPaths(`${this.iconName}.svg`);
  command: vscode.Command = {
    command: 'squarecloud.copyText',
    title: 'Copy',
  };

  constructor(
    public readonly label: string,
    public readonly iconName?: string,
    public readonly description?: string,
    public readonly contextValue: string = 'generic'
  ) {
    super(label);
    this.description = description;
  }
}
