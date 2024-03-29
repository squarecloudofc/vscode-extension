import * as vscode from "vscode";

export class BaseTreeViewProvider<TreeItemType extends vscode.TreeItem = vscode.TreeItem>
  implements vscode.TreeDataProvider<TreeItemType>
{
  protected _onDidChangeTreeData = new vscode.EventEmitter<TreeItemType | undefined | void>();

  public readonly onDidChangeTreeData: vscode.Event<void | TreeItemType | TreeItemType[] | null | undefined> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getChildren(): vscode.ProviderResult<TreeItemType[]> {
    return [];
  }

  getTreeItem(element: TreeItemType): TreeItemType {
    return element;
  }
}
