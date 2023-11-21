import type { TreeDataProvider, TreeItem } from "vscode";
import * as vscode from "vscode";

export function registerTreeView(viewType: string, viewProvider: TreeDataProvider<TreeItem>) {
  vscode.window.registerTreeDataProvider(viewType, viewProvider);
}
