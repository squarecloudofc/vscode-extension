import { ApplicationsTreeViewProvider } from "@/treeviews/applications/provider";
import { window } from "vscode";
import type { SquareEasyExtension } from "./extension";

type TreeViewsKey = keyof TreeViewsManager["views"];

export class TreeViewsManager {
	public views = {
		applications: new ApplicationsTreeViewProvider(this.extension),
	};

	constructor(private readonly extension: SquareEasyExtension) {
		window.registerTreeDataProvider("apps-view", this.views.applications);
	}

	refreshViews(...views: TreeViewsKey[]) {
		for (const view of views) {
			this.views[view].refresh();
		}
	}

	refreshAll() {
		for (const view of Object.values(this.views)) {
			view.refresh();
		}
	}
}
