import { SquareCloud } from './structures/SquareCloud';
import * as vscode from 'vscode';

process.on('uncaughtException', console.error);

process.on('unhandledRejection', console.error);

export function activate(context: vscode.ExtensionContext) {
  new SquareCloud(context);
}

export function deactivate() {}
