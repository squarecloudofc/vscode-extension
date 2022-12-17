import { getVscodeLang, loadTranslations } from 'vscode-ext-localisation';
import { getAllFiles } from '../getAllFiles';
import { Command } from './Command';
import * as vscode from 'vscode';
import { join } from 'path';
import { AppsProvider } from './AppsProvider';
import { SitesProvider } from './SitesProvides';

export class SquareCloud {
  public config = vscode.workspace.getConfiguration('squarecloud');
  public appsView = new AppsProvider(this.config.get('apiKey'));
  public sitesView = new SitesProvider(this.config.get('apiKey'));

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
    vscode.window.registerTreeDataProvider('apps-view', this.appsView);
    vscode.window.registerTreeDataProvider('sites-view', this.sitesView);
  }

  loadTranslations() {
    loadTranslations(
      getVscodeLang(process.env.VSCODE_NLS_CONFIG),
      this.context.extensionPath
    );
  }
}
