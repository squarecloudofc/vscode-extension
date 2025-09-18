import { window } from "vscode";

import { ApplicationsTreeViewProvider } from "@/treeviews/applications/provider";
import { UserTreeViewProvider } from "@/treeviews/user/provider";

import type { SquareCloudExtension } from "./extension";

type TreeViewsKey = keyof TreeViewsManager["views"];

export class TreeViewsManager {
  public views = {
    applications: new ApplicationsTreeViewProvider(this.extension),
    user: new UserTreeViewProvider(this.extension),
  };

  constructor(private readonly extension: SquareCloudExtension) {
    window.registerTreeDataProvider("apps-view", this.views.applications);
    window.registerTreeDataProvider("user-view", this.views.user);
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
