import { type Disposable, window } from "vscode";

import { type ExtensionStore, selectAndSubscribe } from "@/lib/store";
import { ApplicationsTreeViewProvider } from "@/treeviews/applications/provider";
import { DatabasesTreeViewProvider } from "@/treeviews/databases/provider";
import { UserTreeViewProvider } from "@/treeviews/user/provider";
import { WorkspacesTreeViewProvider } from "@/treeviews/workspaces/provider";

import type { SquareCloudExtension } from "./extension";

type TreeViewsKey = keyof TreeViewsManager["views"];

export class TreeViewsManager implements Disposable {
  public readonly views = {
    applications: new ApplicationsTreeViewProvider(this.extension),
    user: new UserTreeViewProvider(this.extension),
    workspaces: new WorkspacesTreeViewProvider(this.extension),
    databases: new DatabasesTreeViewProvider(this.extension),
  };

  private readonly disposables: Disposable[] = [];

  constructor(private readonly extension: SquareCloudExtension) {
    this.disposables.push(
      window.registerTreeDataProvider("apps-view", this.views.applications),
      window.registerTreeDataProvider("user-view", this.views.user),
      window.registerTreeDataProvider("workspaces-view", this.views.workspaces),
      window.registerTreeDataProvider("databases-view", this.views.databases),
    );

    // Selective subscriptions: each view only refreshes when the slice it
    // actually renders changes. Replaces a blanket `refreshAll` on every store
    // tick that was re-rendering all four trees per status update.
    const apps = () => this.views.applications.refresh();
    this.disposables.push(
      this.on((s) => s.applications, apps),
      this.on((s) => s.statuses, apps),
      this.on((s) => s.favorited, apps),
      this.on((s) => s.appsLoaded, apps),
      this.on(
        (s) => s.user,
        () => this.views.user.refresh(),
      ),
      this.on(
        (s) => s.workspaces,
        () => this.views.workspaces.refresh(),
      ),
      this.on(
        (s) => s.databases,
        () => this.views.databases.refresh(),
      ),
    );
  }

  refreshViews(...views: TreeViewsKey[]) {
    for (const view of views) this.views[view].refresh();
  }

  refreshAll() {
    for (const view of Object.values(this.views)) view.refresh();
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }

  private on<T>(
    selector: (state: ExtensionStore) => T,
    listener: () => void,
  ): Disposable {
    return selectAndSubscribe(selector, listener);
  }
}
