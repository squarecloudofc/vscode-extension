import { SquareCloud } from './structures/SquareCloud';
import vscode from 'vscode';

process.on('uncaughtException', console.error);

process.on('unhandledRejection', console.error);

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension loaded.');

  new SquareCloud(context);
}

export function deactivate() {}
