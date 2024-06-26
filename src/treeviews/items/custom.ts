import { getIcons } from "@/lib/utils/icons";
import { type Command, TreeItem } from "vscode";

export class CustomTreeItem extends TreeItem {
	iconPath = this.iconName ? getIcons(`${this.iconName}.svg`) : undefined;

	constructor(
		public readonly label: string,
		public readonly command: Command,
		public readonly iconName?: string,
	) {
		super(label);
	}
}
