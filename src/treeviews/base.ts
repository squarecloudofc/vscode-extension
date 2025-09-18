import {
  type Event,
  EventEmitter,
  type ProviderResult,
  type TreeDataProvider,
  type TreeItem,
} from "vscode";

export class BaseTreeViewProvider<TreeItemType extends TreeItem = TreeItem>
  implements TreeDataProvider<TreeItemType>
{
  protected _onDidChangeTreeData = new EventEmitter<
    // biome-ignore lint/suspicious/noConfusingVoidType: This is a valid type for the event emitter
    TreeItemType | undefined | void
  >();

  public readonly onDidChangeTreeData: Event<
    // biome-ignore lint/suspicious/noConfusingVoidType: This is a valid type for the event emitter
    TreeItemType | TreeItemType[] | null | undefined | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getChildren(): ProviderResult<TreeItemType[]> {
    return [];
  }

  getTreeItem(element: TreeItemType): TreeItemType {
    return element;
  }
}
