import { join } from 'path';
import * as vscode from 'vscode';
import { getVscodeLang, loadTranslations } from 'vscode-ext-localisation';
import CacheManager from '../managers/CacheManager';
import { BotsProvider, SitesProvider, UserProvider } from '../providers';
import getAllFiles from '../utils/getAllFiles';
import { Command } from './Command';
import { UtilBarItem } from './UtilBarItem';

export class SquareCloud {
  public cache = new CacheManager(this);
  public userView = new UserProvider(this.cache);
  public botsView = new BotsProvider(this.cache);
  public sitesView = new SitesProvider(this.cache);
  public utilBarItem: UtilBarItem = undefined!;

  constructor(public context: vscode.ExtensionContext) {
    this.loadTranslations();
    this.loadTreeViews();
    this.loadBarItem();
    this.loadCommands();

    this.cache.refresh(true);
  }

  loadCommands() {
    const files = getAllFiles(join(__dirname, '..', 'commands'), [
      '.js',
      '.ts',
    ]);

    for (const file of files) {
      const command: Command = require(file).default;

      if (!command) {
        continue;
      }

      const disposable = vscode.commands.registerCommand(
        command.name,
        (...args) => {
          command.execute(this, ...args);
        }
      );

      this.context.subscriptions.push(disposable);
    }
  }

  loadTreeViews() {
    vscode.window.registerTreeDataProvider('user-view', this.userView);
    vscode.window.registerTreeDataProvider('bots-view', this.botsView);
    vscode.window.registerTreeDataProvider('sites-view', this.sitesView);

    this.cache.on('refresh', () => {
      this.userView.refresh();
      this.botsView.refresh();
      this.sitesView.refresh();

      console.log('refresh');
    });

    this.cache.on('refreshStatus', () => {
      this.botsView.refresh();
      this.sitesView.refresh();

      console.log('refreshStatus');
    });
  }

  loadBarItem() {
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.utilBarItem = new UtilBarItem(this, statusBarItem);
    this.context.subscriptions.push(statusBarItem);
  }

  loadTranslations() {
    loadTranslations(
      getVscodeLang(process.env.VSCODE_NLS_CONFIG),
      this.context.extensionPath
    );
  }

  get apiKey(): string | undefined {
    return this.config.get('apiKey');
  }

  get config() {
    return vscode.workspace.getConfiguration('squarecloud');
  }
}
