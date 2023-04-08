import * as vscode from 'vscode';
import commandManager from './managers/command.manager';
import translationManager from './managers/translation.manager';
import treeviewManager from './managers/treeview.manager';
import './managers/config.manager';
import cacheManager from './managers/cache.manager';
import baritemManager from './managers/baritem.manager';

export class SquareCloud {
  constructor(public readonly context: vscode.ExtensionContext) {
    commandManager.loadCommands(this);
    translationManager.loadTranslations(context);
    baritemManager.loadBarItem(context);
    treeviewManager.loadTreeViews();

    cacheManager.refreshData(true);
  }
}
