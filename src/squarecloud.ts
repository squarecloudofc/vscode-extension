import * as vscode from 'vscode';
import baritemManager from './managers/baritem.manager';
import cacheManager from './managers/cache.manager';
import commandManager from './managers/command.manager';
import configManager from './managers/config.manager';
import translationManager from './managers/translation.manager';
import treeviewManager from './managers/treeview.manager';

export class SquareCloud {
  constructor(public readonly context: vscode.ExtensionContext) {
    console.log('[Square Cloud Easy] Class loaded.');
    configManager.setUpListeners();
    commandManager.loadCommands(this);
    translationManager.loadTranslations(context);
    baritemManager.loadBarItem(context);
    treeviewManager.loadTreeViews();
    cacheManager.refreshData(true);
  }
}
