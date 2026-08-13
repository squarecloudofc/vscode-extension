import { type Disposable, window } from "vscode";

import { AuthViewProvider } from "@/views/auth";
import { DashboardViewProvider } from "@/views/dashboard";

import type { SquareCloudExtension } from "./extension";

/**
 * The sidebar is two webviews that never show at the same time: sign in, or
 * the dashboard. `squarecloud.hideAuth` (owned by the auth view) decides which.
 */
export class TreeViewsManager implements Disposable {
  public readonly auth = new AuthViewProvider(this.extension);
  public readonly dashboard = new DashboardViewProvider(this.extension);

  private readonly disposables: Disposable[] = [];

  constructor(private readonly extension: SquareCloudExtension) {
    this.disposables.push(
      this.auth,
      this.dashboard,
      window.registerWebviewViewProvider(AuthViewProvider.viewId, this.auth, {
        // Keep a pending code on screen when the user peeks at another view.
        webviewOptions: { retainContextWhenHidden: true },
      }),
      window.registerWebviewViewProvider(
        DashboardViewProvider.viewId,
        this.dashboard,
        { webviewOptions: { retainContextWhenHidden: true } },
      ),
    );
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
