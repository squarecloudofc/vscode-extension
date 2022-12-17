import { getVscodeLang, loadTranslations } from 'vscode-ext-localisation';
import { SitesProvider } from './SitesProvides';
import { BotsProvider } from './BotsProvider';
import { getAllFiles } from '../getAllFiles';
import CacheManager from './CacheManager';
import { Command } from './Command';
import * as vscode from 'vscode';
import { join } from 'path';

export class SquareCloud {
  public config = vscode.workspace.getConfiguration('squarecloud');

  public cache = new CacheManager(this);
  public sitesView = new SitesProvider(this.cache);
  public botsView = new BotsProvider(this.cache);

  constructor(public context: vscode.ExtensionContext) {
    this.loadTranslations();
    this.loadTreeViews();
    this.loadCommands();
  }

  loadCommands() {
    const files = getAllFiles(join(__dirname, '..', 'commands'));

    for (const file of files) {
      const command: Command = require(file).default;

      if (!command) {
        continue;
      }

      const disposable = vscode.commands.registerCommand(command.name, () =>
        command.execute(this)
      );

      this.context.subscriptions.push(disposable);
    }
  }

  loadTreeViews() {
    vscode.window.registerTreeDataProvider('bots-view', this.botsView);
    vscode.window.registerTreeDataProvider('sites-view', this.sitesView);
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
}
