import type { TreeDataProvider, TreeItem } from "vscode";
import * as vscode from "vscode";
import { ApplicationsTreeViewProvider } from "./applications/provider";
import { BaseTreeViewProvider } from "./base";

export function registerTreeView(viewType: string, viewProvider: TreeDataProvider<TreeItem>) {
  vscode.window.registerTreeDataProvider(viewType, viewProvider);
}

export class TreeViewsManager {
  public applicationsView = new ApplicationsTreeViewProvider();

  registerTreeViews() {
    vscode.window.registerTreeDataProvider("apps-view", this.applicationsView);
  }

  refreshViews(...views: BaseTreeViewProvider<TreeItem>[]) {
    views.forEach((view) => view.refresh());
  }
}
