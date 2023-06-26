import * as vscode from 'vscode';
import createConfigFile from '../helpers/generatefile.helper';
import { Command } from '../structures/command';

export default new Command('createConfig', () => {
  const path = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (!path) {
    return;
  }

  createConfigFile(path);
});
