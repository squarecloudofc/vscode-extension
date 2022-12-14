import { SquareCloud } from './classes/SquareCloud';
import * as vscode from 'vscode';

process.on('uncaughtException', console.error);

process.on('unhandledRejection', console.error);

export async function activate(context: vscode.ExtensionContext) {
  new SquareCloud(context);
}

export function deactivate() {}
