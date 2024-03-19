import * as vscode from "vscode";

export class BaseTreeViewProvider<
	TreeItemType extends vscode.TreeItem = vscode.TreeItem,
> implements vscode.TreeDataProvider<TreeItemType>
{
	protected _onDidChangeTreeData = new vscode.EventEmitter<
		// biome-ignore lint/suspicious/noConfusingVoidType: This is a valid type for the event emitter
		TreeItemType | undefined | void
	>();

	public readonly onDidChangeTreeData: vscode.Event<
		// biome-ignore lint/suspicious/noConfusingVoidType: This is a valid type for the event emitter
		TreeItemType | TreeItemType[] | null | undefined | void
	> = this._onDidChangeTreeData.event;

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
