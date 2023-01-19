/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import { Command } from '../structures/Command';
import createConfigFile from '../utils/createConfigFile';

export default new Command('createConfig', async (ctx, arg) => {
  const path = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (!path) {
    return;
  }

  createConfigFile(path, ctx);
});
