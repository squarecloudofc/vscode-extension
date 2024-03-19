import * as vscode from "vscode";
import { getIcons } from "../../util/icons";

export class GenericTreeItem extends vscode.TreeItem {
	iconPath = this.iconName ? getIcons(`${this.iconName}.svg`) : undefined;

	constructor(
		public readonly label: string,
		public readonly iconName?: string,
		public readonly description?: string,
		public readonly contextValue: string = "generic",
	) {
		super(label);
		this.description = description;
	}
}
