import * as vscode from 'vscode';
import baritemManager from './managers/baritem.manager';
import cacheManager from './managers/cache.manager';
import commandManager from './managers/command.manager';
import configManager from './managers/config.manager';
import translationManager from './managers/translation.manager';
import treeviewManager from './managers/treeview.manager';
import webviewManager from './managers/webview.manager';

export class SquareCloud {
  constructor(public readonly context: vscode.ExtensionContext) {
    configManager.setUpListeners();
    commandManager.loadCommands(this);
    translationManager.loadTranslations(context);
    baritemManager.loadBarItem(context);
    treeviewManager.loadTreeViews();
    webviewManager.loadWebViews(context);
    cacheManager.refreshData(true);
  }
}
