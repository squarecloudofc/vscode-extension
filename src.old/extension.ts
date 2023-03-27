import * as vscode from 'vscode';
import { SquareCloud } from './structures/SquareCloud';

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

export function activate(context: vscode.ExtensionContext) {
  console.log('[Square Cloud Easy] Extension loaded.');

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (
      !editor?.document ||
      !['squarecloud.config', 'squarecloud.app'].includes(
        editor.document.fileName
      )
    ) {
      return;
    }
  });

  new SquareCloud(context);
}

export function deactivate() {}
