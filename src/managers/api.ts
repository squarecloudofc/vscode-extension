import { SquareCloudAPI } from "@squarecloud/api";

import { ApplicationStatus } from "@/structures/application/status";
import { Logger } from "@/structures/logger";

import type { SquareCloudExtension } from "./extension";

export class APIManager {
  private readonly logger = new Logger("Square Cloud");

  public paused = false;

  constructor(private readonly extension: SquareCloudExtension) {
    this.refresh();
    setInterval(() => {
      if (!this.shouldAutoRefresh()) {
        return;
      }

      this.refresh();
    }, 30000);
  }

  async refresh(bypass?: boolean) {
    if (this.paused && !bypass) {
      return;
    }
    this.pause(true);

    const apiKey = await this.extension.config.apiKey.test();

    if (!apiKey) {
      this.logger.log("API key not found.");
      this.extension.store.actions.setAppsLoaded(true);
      this.pause(false);
      return;
    }

    const api = new SquareCloudAPI(apiKey);
    const user = await api.user.get();
    const applications = user.applications;

    let statuses: Awaited<ReturnType<typeof api.applications.statusAll>> = [];
    try {
      statuses = await api.applications.statusAll();
    } catch {
      // No applications or plan - treat as empty list
    }

    this.pause(false);

    this.logger.log(
      `Found ${applications.size} applications and ${statuses.length} statuses.`,
    );
    const newApplications = applications.toJSON();
    const newStatuses = statuses.map((status) => new ApplicationStatus(status));

    this.extension.store.actions.setApplications(newApplications);
    this.extension.store.actions.setStatuses(newStatuses);
    this.extension.store.actions.setUser(user);
    this.extension.store.actions.setAppsLoaded(true);
  }

  async refreshStatus(appId: string, bypass?: boolean) {
    if (this.paused && !bypass) {
      return;
    }
    this.pause(true);

    const apiKey = await this.extension.config.apiKey.test();

    if (!apiKey) {
      this.logger.log("API key not found.");
      this.pause(false);
      return;
    }

    const api = new SquareCloudAPI(apiKey);
    const application = await api.applications.get(appId);
    const status = await application.getStatus();

    this.pause(false);

    this.extension.store.actions.setStatus(new ApplicationStatus(status));
  }

  async pauseUntil<T>(fn: () => Promise<T>) {
    this.pause(true);
    return fn().finally(() => this.pause(false));
  }

  private pause(value?: boolean) {
    this.paused = value || !this.paused;
  }

  private shouldAutoRefresh() {
    const { appsLoaded, applications } = this.extension.store.value;

    // Skip polling while showing paywall/empty state; user can still refresh manually.
    return !appsLoaded || applications.size > 0;
  }
}
