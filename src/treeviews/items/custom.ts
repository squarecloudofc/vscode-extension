import * as vscode from "vscode";
import { getIcons } from "../../util/icons";

export class CustomTreeItem extends vscode.TreeItem {
	iconPath = this.iconName ? getIcons(`${this.iconName}.svg`) : undefined;

	constructor(
		public readonly label: string,
		public readonly command: vscode.Command,
		public readonly iconName?: string,
	) {
		super(label);
	}
}
