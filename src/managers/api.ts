import { SquareCloudAPI } from "@squarecloud/api";
import { type Disposable, window } from "vscode";

import { disposeAllRealtimeSessions } from "@/commands/applications/tools/realtime";
import { isApiError, isRateLimited, problemOf } from "@/lib/utils/errors";
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
/** Backoff before retrying a status fetch rejected with `KEEP_CALM`. */
const KEEP_CALM_BACKOFF_MS = 10_000;
/**
 * `RATE_LIMITED` blocks the account for up to ~30 min; polling through it only
 * burns requests. Background polling sits out this long, manual refreshes
 * still go through.
 */
const RATE_LIMITED_PAUSE_MS = 5 * 60_000;

export class APIManager implements Disposable {
  private readonly logger = new Logger("API");

  private client?: SquareCloudAPI;
  private clientApiKey?: string;
  private rateLimitedUntil = 0;
  /**
   * The dashboard counts down to the end of a rate-limit pause, so the retry
   * happens right then instead of on the next poll, up to a minute later.
   */
  private retryTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private intervalId?: ReturnType<typeof setInterval>;
  private windowFocused = true;
  private refreshInFlight: Promise<void> | null = null;
  /**
   * Bumped whenever the key changes. A refresh started under an older key
   * throws its answer away: it would bring a logged-out account back into the
   * store, or its 401 would delete the key that just replaced it.
   */
  private generation = 0;
  /** Dashboard rows that are open, in the order they were opened. */
  private readonly inspected = new Set<string>();
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
    const run = this.runRefresh().finally(() => {
      if (this.refreshInFlight === run) this.refreshInFlight = null;
    });
    this.refreshInFlight = run;
    return run;
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
    const generation = this.generation;
    const api = await this.getClient();

    if (!api) {
      this.logger.log("API key not found.");
      return;
    }

    // All three endpoints are independent — fire them in parallel.
    const [accountResult, statusesResult, workspacesResult] =
      await Promise.allSettled([
        api.account.me(),
        api.apps.statusAll(),
        api.workspaces.list(),
      ]);

    if (generation !== this.generation) return;

    if (accountResult.status === "rejected") {
      await this.handleRefreshFailure(accountResult.reason);
      return;
    }

    const { user, applications, databases } = accountResult.value;
    const { actions } = this.extension.store;
    // The account answered, so any rate-limit pause is over; a side call
    // below can still start a new one.
    this.rateLimitedUntil = 0;
    clearTimeout(this.retryTimer);
    actions.setProblem(undefined);
    actions.setLastUpdated(Date.now());

    this.logger.log(
      `apps=${applications.length} workspaces=${workspacesResult.status} statuses=${statusesResult.status} databases=${databases.length}`,
    );

    actions.setApplications(applications);
    actions.setDatabases(databases);
    actions.setUser(user);
    // A failed side call (a 429 most often) keeps what was already on screen
    // instead of blanking every status dot until the next poll.
    if (statusesResult.status === "fulfilled") {
      actions.setStatuses(statusesResult.value);
      // ponytail: one status request per opened row and poll, capped at the
      // last 5 opened; raise it if people keep many rows open at once.
      for (const id of [...this.inspected].slice(-5)) {
        void this.refreshStatus(id);
      }
    } else {
      this.noteFailure("apps.statusAll()", statusesResult.reason);
    }
    if (workspacesResult.status === "fulfilled") {
      actions.setWorkspaces(workspacesResult.value);
    } else {
      this.noteFailure("workspaces.list()", workspacesResult.reason);
    }
    actions.setAppsLoaded(true);
  }

  /** Logs a background failure; a 429 also pauses background polling. */
  private noteFailure(call: string, error: unknown): void {
    this.logger.warn(
      `${call} failed: ${isApiError(error) ? error.code : String(error)}`,
    );
    if (isRateLimited(error) && error.code !== "KEEP_CALM") {
      this.rateLimitedUntil = Date.now() + RATE_LIMITED_PAUSE_MS;
    }
  }

  /**
   * A refresh can fail because the key is dead or because the network is. The
   * first drops the key and falls back to the welcome view; the second stays
   * in the store as `problem`, which the dashboard and the status bar show —
   * no toast on top, so working offline stays quiet.
   */
  private async handleRefreshFailure(error: unknown): Promise<void> {
    this.logger.error("account.me() failed", error);
    this.noteFailure("account.me()", error);

    if (await this.extension.config.apiKey.invalidateIfRejected(error)) {
      this.invalidateClient();
      this.clearState();
      // The key is gone — hand the sidebar back to the sign-in view.
      await this.extension.treeViews.auth.syncVisibility();
      return;
    }

    const paused = this.rateLimitedUntil > Date.now();
    this.extension.store.actions.setProblem({
      kind: problemOf(error),
      code: isApiError(error) ? error.code : "UNKNOWN_ERROR",
      at: Date.now(),
      retryAt: paused ? this.rateLimitedUntil : undefined,
    });
    if (paused) {
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(
        () => void this.refresh(),
        this.rateLimitedUntil - Date.now(),
      );
    }
  }

  /**
   * The key changed in another window. Nothing fetched with the old one
   * applies any more: start over with the new key, or go back to sign-in.
   */
  async restartForNewKey(): Promise<void> {
    this.invalidateClient();
    this.clearState();
    await this.extension.treeViews.auth.syncVisibility();
    await this.refresh();
  }

  /**
   * A dashboard row opened or closed. An open row shows the full status
   * (uptime, storage), which the list endpoint doesn't carry: it is read now
   * and again on every poll while the row stays open.
   */
  inspect(appId: string, open: boolean): void {
    this.inspected.delete(appId);
    if (!open) return;
    this.inspected.add(appId);
    void this.refreshStatus(appId);
  }

  /** The dashboard was rebuilt, and a new one starts with every row closed. */
  forgetInspected(): void {
    this.inspected.clear();
  }

  /** Drops everything fetched with an authorization that no longer applies. */
  clearState(): void {
    this.inspected.clear();
    const { actions } = this.extension.store;
    actions.setApplications([]);
    actions.setStatuses([]);
    actions.setWorkspaces([]);
    actions.setDatabases([]);
    actions.setUser(undefined);
    actions.setProblem(undefined);
    actions.setLastUpdated(undefined);
  }

  async refreshStatus(appId: string, isRetry = false): Promise<void> {
    const api = await this.getClient();
    if (!api) return;

    try {
      const status = await api.apps.status(appId);
      this.extension.store.actions.setStatus({ id: appId, ...status });
    } catch (error) {
      // Silent on purpose: the row keeps its last known state. A short
      // KEEP_CALM burst gets one retry after a backoff; RATE_LIMITED (a block
      // of up to ~30 min) pauses polling instead of feeding it more requests.
      this.noteFailure(`refreshStatus(${appId})`, error);
      if (isApiError(error) && error.code === "KEEP_CALM" && !isRetry) {
        this.scheduleStatusRefresh(appId, KEEP_CALM_BACKOFF_MS, true);
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
    this.generation++;
    // The next refresh() must use the new key, not join the old one.
    this.refreshInFlight = null;
    // An open console holds the old client and would keep streaming (and
    // reconnecting to) the previous account's logs.
    disposeAllRealtimeSessions();
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
    clearTimeout(this.retryTimer);
    for (const handle of this.scheduledRefreshes) clearTimeout(handle);
    this.scheduledRefreshes.clear();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  private shouldAutoRefresh(): boolean {
    if (Date.now() < this.rateLimitedUntil) return false;
    const { appsLoaded, applications, user } = this.extension.store.value;
    // Keep polling while the account has never loaded — otherwise a single
    // failed refresh froze the extension until a manual refresh.
    if (!appsLoaded || !user) return true;
    // Skip polling while showing paywall/empty state; user can still refresh manually.
    return applications.size > 0;
  }
}
