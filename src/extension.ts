import * as vscode from 'vscode';
import { SquareCloud } from './squarecloud';

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

export function activate(context: vscode.ExtensionContext) {
  console.log('[Square Cloud Easy] Extension loaded.');

  return new SquareCloud(context);
}

export function deactivate() {}
