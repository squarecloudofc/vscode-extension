import * as vscode from 'vscode';
import commandManager from './managers/command.manager';
import translationManager from './managers/translation.manager';
import treeviewManager from './managers/treeview.manager';
import './managers/config.manager';
import cacheManager from './managers/cache.manager';

export class SquareCloud {
  constructor(public readonly context: vscode.ExtensionContext) {
    commandManager.loadCommands(this);
    translationManager.loadTranslations(context);
    treeviewManager.loadTreeViews();

    cacheManager.refreshData(true);
  }
}
