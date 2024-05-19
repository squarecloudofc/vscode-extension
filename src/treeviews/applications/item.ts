import { applicationsStore } from "@/lib/stores/applications";
import { getIcons } from "@/lib/utils/icons";
import type { BaseApplication } from "@squarecloud/api";
import { TreeItem, TreeItemCollapsibleState } from "vscode";
import type { CustomTreeItem } from "../items/custom";
import type { GenericTreeItem } from "../items/generic";

export type SquareTreeItem =
	| ApplicationTreeItem
	| CustomTreeItem
	| GenericTreeItem;

export class ApplicationTreeItem extends TreeItem {
	tooltip = this.application.id;

	collapsibleState = this.status?.running
		? TreeItemCollapsibleState.Collapsed
		: TreeItemCollapsibleState.None;

	iconPath = getIcons(
		this.status
			? this.status.running
				? "online.svg"
				: "offline.svg"
			: "loading.svg",
	);

	contextValue = this.favorited ? "application-fav" : "application";

	constructor(public readonly application: BaseApplication) {
		super(application.tag);
	}

	get favorited() {
		return applicationsStore.get().isFavorited(this.application.id);
	}

	get status() {
		return applicationsStore.get().getStatus(this.application.id);
	}
}
