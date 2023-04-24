import * as vscode from 'vscode';
import UserProvider from '../providers/user.provider';
import cacheManager from './cache.manager';
import FavoritedProvider from '../providers/favorited.provider';
import ApplicationsProvider from '../providers/applications.provider';

class TreeViewManager {
  public userView = new UserProvider();
  public appsView = new ApplicationsProvider();
  public favoritedView = new FavoritedProvider();

  loadTreeViews() {
    vscode.window.registerTreeDataProvider('user-view', this.userView);
    vscode.window.registerTreeDataProvider('apps-view', this.appsView);
    vscode.window.registerTreeDataProvider('favapp-view', this.favoritedView);

    cacheManager.on('refreshData', () => {
      this.refreshViews(this.userView, this.appsView, this.favoritedView);
    });

    cacheManager.on('refreshStatus', () => {
      this.refreshViews(this.appsView, this.favoritedView);
    });
  }

  refreshViews(
    ...views: (
      | UserProvider
      | ApplicationsProvider
    )[]
  ) {
    views.forEach((view) => view.refresh());
  }
}

export default new TreeViewManager();
