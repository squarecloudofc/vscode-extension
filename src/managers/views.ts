import { type Disposable, window } from "vscode";

import { SidebarViewProvider } from "@/views/sidebar";

import type { SquareCloudExtension } from "./extension";

/** The extension's views: one sidebar webview, signed in or not. */
export class ViewsManager implements Disposable {
  public readonly sidebar = new SidebarViewProvider(this.extension);

  private readonly disposables: Disposable[] = [];

  constructor(private readonly extension: SquareCloudExtension) {
    this.disposables.push(
      this.sidebar,
      window.registerWebviewViewProvider(
        SidebarViewProvider.viewId,
        this.sidebar,
        // Keeps a pending code and the open menus when another view is shown.
        { webviewOptions: { retainContextWhenHidden: true } },
      ),
    );
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
