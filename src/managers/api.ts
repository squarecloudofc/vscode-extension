import { SquareCloudAPI, SquareCloudAPIError } from "@squarecloud/api";
import { type Disposable, window } from "vscode";

import { describeError } from "@/lib/utils/errors";
import { ApplicationStatus } from "@/structures/application/status";
import { Logger } from "@/structures/logger";

import type { SquareCloudExtension } from "./extension";

/** Automatic background polling interval for the full extension state. */
const REFRESH_INTERVAL_MS = 60_000;
/** Delay used after lifecycle actions before re-fetching the app status. */
const POST_ACTION_REFRESH_MS = 7_000;
/**
 * Backoff for following a lifecycle action. A single shot at 7s meant the row
 * sat on a stale state for seven seconds; this asks early, then backs off, and
 * stops as soon as the status actually flips.
 */
const POST_ACTION_STEPS_MS = [600, 1_800, 4_000];
/** Backoff before retrying a status fetch rejected with a 429. */
const RATE_LIMIT_BACKOFF_MS = 10_000;

export class APIManager implements Disposable {
  private readonly logger = new Logger("API");

  private client?: SquareCloudAPI;
  private clientApiKey?: string;
  private failureNotified = false;
  private disposed = false;
  private intervalId?: ReturnType<typeof setInterval>;
  private windowFocused = true;
  private refreshInFlight: Promise<void> | null = null;
  private disposables: Disposable[] = [];
  private scheduledRefreshes = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly extension: SquareCloudExtension) {
    this.refresh();
    // The dashboard shows service health as a footer, so it has to be there on
    // first paint rather than a minute in.
    this.refreshServiceStatus();
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
   *
   * It does NOT validate the key: this used to run a full `user.get()` on
   * every call, doubling the requests of each poll and of every command that
   * needs a client. `runRefresh` already talks to the API and handles a
   * rejected key there.
   */
  async getClient(): Promise<SquareCloudAPI | undefined> {
    const apiKey = await this.extension.config.apiKey.get();
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
    try {
      await this.fetchState();
    } finally {
      // A refresh that failed must not look like one still in flight — the
      // tree views render "Loading..." off this flag, so bailing out early
      // left every view loading forever.
      this.extension.store.actions.setAppsLoaded(true);
    }
  }

  private async fetchState(): Promise<void> {
    const api = await this.getClient();

    if (!api) {
      this.logger.log("API key not found.");
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
      await this.handleRefreshFailure(userResult.reason);
      return;
    }

    this.failureNotified = false;
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

  /**
   * A refresh can fail because the key is dead or because the network is. The
   * first drops the key and falls back to the welcome view; the second must
   * say so out loud once — silence here is what made the views hang.
   */
  private async handleRefreshFailure(error: unknown): Promise<void> {
    this.logger.error("user.get() failed", error);

    if (await this.extension.config.apiKey.invalidateIfRejected(error)) {
      this.invalidateClient();
      this.clearState();
      // The key is gone — hand the sidebar back to the sign-in view.
      await this.extension.treeViews.auth.syncVisibility();
      return;
    }

    if (this.failureNotified) return;
    this.failureNotified = true;
    window.showErrorMessage(describeError(error));
  }

  /** Drops everything fetched with an authorization that no longer applies. */
  clearState(): void {
    const { actions } = this.extension.store;
    actions.setApplications([]);
    actions.setStatuses([]);
    actions.setWorkspaces([]);
    actions.setDatabases([]);
    actions.setUser(undefined);
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
   * Follows a lifecycle action until the status changes, asking early and
   * backing off. Stops the moment `running` flips, so the common case costs a
   * single request instead of leaving the row stale for seven seconds.
   */
  async trackStatusChange(appId: string): Promise<void> {
    const before = this.extension.store.actions.getStatus(appId)?.running;

    for (const delay of POST_ACTION_STEPS_MS) {
      await this.wait(delay);
      if (this.disposed) return;
      await this.refreshStatus(appId);
      if (this.extension.store.actions.getStatus(appId)?.running !== before) {
        return;
      }
    }
  }

  /** Sleep whose timer is tracked, so dispose cancels it like any other. */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const handle = setTimeout(() => {
        this.scheduledRefreshes.delete(handle);
        resolve();
      }, ms);
      this.scheduledRefreshes.add(handle);
    });
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
    this.disposed = true;
    if (this.intervalId !== undefined) clearInterval(this.intervalId);
    this.intervalId = undefined;
    for (const handle of this.scheduledRefreshes) clearTimeout(handle);
    this.scheduledRefreshes.clear();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  private shouldAutoRefresh(): boolean {
    const { appsLoaded, applications, user } = this.extension.store.value;
    // Keep polling while the account has never loaded — otherwise a single
    // failed refresh froze the extension until a manual refresh.
    if (!appsLoaded || !user) return true;
    // Skip polling while showing paywall/empty state; user can still refresh manually.
    return applications.size > 0;
  }
}
