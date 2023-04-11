import * as vscode from 'vscode';
import UserProvider from '../providers/user.provider';
import BotsProvider from '../providers/bots.provider';
import WebsitesProvider from '../providers/websites.provider';
import cacheManager from './cache.manager';
import FavoritedProvider from '../providers/favorited.provider';

class TreeViewManager {
  public userView = new UserProvider();
  public botsView = new BotsProvider();
  public websitesView = new WebsitesProvider();
  public favoritedView = new FavoritedProvider();

  loadTreeViews() {
    vscode.window.registerTreeDataProvider('user-view', this.userView);
    vscode.window.registerTreeDataProvider('bots-view', this.botsView);
    vscode.window.registerTreeDataProvider('sites-view', this.websitesView);
    vscode.window.registerTreeDataProvider('favapp-view', this.favoritedView);

    cacheManager.on('refreshData', () => {
      this.refreshViews(
        this.userView,
        this.botsView,
        this.websitesView,
        this.favoritedView
      );
    });

    cacheManager.on('refreshStatus', () => {
      this.refreshViews(this.botsView, this.websitesView, this.favoritedView);
    });
  }

  refreshViews(
    ...views: (
      | UserProvider
      | BotsProvider
      | WebsitesProvider
      | FavoritedProvider
    )[]
  ) {
    views.forEach((view) => view.refresh());
  }
}

export default new TreeViewManager();
