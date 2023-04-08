import * as vscode from 'vscode';
import { getIconPaths } from '../helpers/files.helper';

export default class CustomTreeItem extends vscode.TreeItem {
  iconPath = getIconPaths(`${this.iconName}.svg`);

  constructor(
    public readonly label: string,
    public readonly command: vscode.Command,
    public readonly iconName?: string
  ) {
    super(label);
  }
}
