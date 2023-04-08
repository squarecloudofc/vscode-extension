import * as vscode from 'vscode';
import UserProvider from '../providers/user.provider';
import BotsProvider from '../providers/bots.provider';
import WebsitesProvider from '../providers/websites.provider';
import cacheManager from './cache.manager';

class TreeViewManager {
  public userView = new UserProvider();
  public botsView = new BotsProvider();
  public websitesView = new WebsitesProvider();

  loadTreeViews() {
    vscode.window.registerTreeDataProvider('user-view', this.userView);
    vscode.window.registerTreeDataProvider('bots-view', this.botsView);
    vscode.window.registerTreeDataProvider('sites-view', this.websitesView);

    cacheManager.on('refreshData', () => {
      this.refreshViews(this.userView, this.botsView, this.websitesView);
    });

    cacheManager.on('refreshStatus', () => {
      this.refreshViews(this.botsView, this.websitesView);
    });
  }

  refreshViews(...views: (UserProvider | BotsProvider | WebsitesProvider)[]) {
    views.forEach((view) => view.refresh());
  }
}

export default new TreeViewManager();
