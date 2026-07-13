import { SquareCloudAPI, SquareCloudAPIError } from "@squarecloud/api";
import { type Disposable, window } from "vscode";

import { ApplicationStatus } from "@/structures/application/status";
import { Logger } from "@/structures/logger";

import type { SquareCloudExtension } from "./extension";

/** Automatic background polling interval for the full extension state. */
const REFRESH_INTERVAL_MS = 60_000;
/** Delay used after lifecycle actions before re-fetching the app status. */
const POST_ACTION_REFRESH_MS = 7_000;
/** Backoff before retrying a status fetch rejected with a 429. */
const RATE_LIMIT_BACKOFF_MS = 10_000;

export class APIManager implements Disposable {
  private readonly logger = new Logger("API");

  private client?: SquareCloudAPI;
  private clientApiKey?: string;
  private intervalId?: ReturnType<typeof setInterval>;
  private windowFocused = true;
  private refreshInFlight: Promise<void> | null = null;
  private disposables: Disposable[] = [];
  private scheduledRefreshes = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly extension: SquareCloudExtension) {
    this.refresh();
    this.intervalId = setInterval(() => {
      if (!this.windowFocused) return;
      if (!this.shouldAutoRefresh()) return;
      this.refresh();
      this.refreshServiceStatus();
    }, REFRESH_INTERVAL_MS);

    // Pause polling while the user isn't looking at the editor; resume + force
    // refresh when focus returns to avoid showing stale data.
    this.windowFocused = window.state.focused;
    this.disposables.push(
      window.onDidChangeWindowState((state) => {
        const wasFocused = this.windowFocused;
        this.windowFocused = state.focused;
        if (!wasFocused && state.focused && this.shouldAutoRefresh()) {
          this.refresh();
        }
      }),
    );
  }

  /**
   * Returns a shared SquareCloudAPI client bound to the stored API key.
   * Cached and recreated only when the stored key actually changes.
   */
  async getClient(): Promise<SquareCloudAPI | undefined> {
    const apiKey = await this.extension.config.apiKey.test();
    if (!apiKey) {
      this.client = undefined;
      this.clientApiKey = undefined;
      return undefined;
    }
    if (!this.client || this.clientApiKey !== apiKey) {
      this.client = new SquareCloudAPI(apiKey);
      this.clientApiKey = apiKey;
    }
    return this.client;
  }

  /**
   * Refreshes the full extension state. Coalesces concurrent calls — second
   * caller piggybacks on the in-flight refresh instead of starting a new one.
   */
  refresh(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.runRefresh().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async runRefresh(): Promise<void> {
    const api = await this.getClient();

    if (!api) {
      this.logger.log("API key not found.");
      this.extension.store.actions.setAppsLoaded(true);
      return;
    }

    // All four endpoints are independent — fire them in parallel.
    const [userResult, statusesResult, workspacesResult] =
      await Promise.allSettled([
        api.user.get(),
        api.applications.statusAll(),
        api.workspaces.list(),
      ]);

    if (userResult.status === "rejected") {
      this.logger.error("user.get() failed", userResult.reason);
      return;
    }

    const user = userResult.value;
    const applications = user.applications;
    const statuses =
      statusesResult.status === "fulfilled" ? statusesResult.value : [];
    const workspaces =
      workspacesResult.status === "fulfilled" ? workspacesResult.value : [];
    const databases = Array.from(user.databases.values());

    this.logger.log(
      `apps=${applications.size} statuses=${statuses.length} workspaces=${workspaces.length} databases=${databases.length}`,
    );

    this.extension.store.actions.setApplications(applications.toJSON());
    this.extension.store.actions.setStatuses(
      statuses.map((status) => new ApplicationStatus(status)),
    );
    this.extension.store.actions.setWorkspaces(workspaces);
    this.extension.store.actions.setDatabases(databases);
    this.extension.store.actions.setUser(user);
    this.extension.store.actions.setAppsLoaded(true);
  }

  async refreshStatus(appId: string, isRetry = false): Promise<void> {
    const api = await this.getClient();
    if (!api) return;

    try {
      const application = await api.applications.get(appId);
      const status = await application.getStatus();
      this.extension.store.actions.setStatus(new ApplicationStatus(status));
    } catch (error) {
      if (error instanceof SquareCloudAPIError) {
        this.logger.warn(`refreshStatus(${appId}) failed: ${error.code}`);
        // The SDK collapses every HTTP 429 (including short KEEP_CALM bursts)
        // into RATE_LIMIT_EXCEEDED before reading the body — retry once after
        // a backoff instead of giving up. The next poll cycle covers the rest.
        if (error.code === "RATE_LIMIT_EXCEEDED" && !isRetry) {
          this.scheduleStatusRefresh(appId, RATE_LIMIT_BACKOFF_MS, true);
        }
      } else {
        this.logger.error(`refreshStatus(${appId}) failed`, error);
      }
    }
  }

  async refreshServiceStatus(): Promise<void> {
    const api = await this.getClient();
    if (!api) return;
    try {
      const status = await api.service.status();
      this.extension.store.actions.setServiceStatus(status);
    } catch (error) {
      this.logger.error("service.status() failed", error);
    }
  }

  /** Forces a fresh client on the next call. Call after the API key changes. */
  invalidateClient(): void {
    this.client = undefined;
    this.clientApiKey = undefined;
  }

  /**
   * Re-fetches the status of an app after a short delay. Used by lifecycle
   * actions (start/stop/restart/commit/snapshotRestore) to let the API settle
   * before polling. The timer is tracked so we can drop it on dispose.
   */
  scheduleStatusRefresh(
    appId: string,
    delayMs = POST_ACTION_REFRESH_MS,
    isRetry = false,
  ): void {
    const handle = setTimeout(() => {
      this.scheduledRefreshes.delete(handle);
      void this.refreshStatus(appId, isRetry);
    }, delayMs);
    this.scheduledRefreshes.add(handle);
  }

  dispose(): void {
    if (this.intervalId !== undefined) clearInterval(this.intervalId);
    this.intervalId = undefined;
    for (const handle of this.scheduledRefreshes) clearTimeout(handle);
    this.scheduledRefreshes.clear();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  private shouldAutoRefresh(): boolean {
    const { appsLoaded, applications } = this.extension.store.value;
    // Skip polling while showing paywall/empty state; user can still refresh manually.
    return !appsLoaded || applications.size > 0;
  }
}
