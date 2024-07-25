import { ApplicationStatus } from "@/structures/application/status";
import { Logger } from "@/structures/logger";
import { SquareCloudAPI } from "@squarecloud/api";
import type { SquareEasyExtension } from "./extension";

export class APIManager {
	private readonly logger = new Logger("Square Cloud Easy");

	public paused = false;

	constructor(private readonly extension: SquareEasyExtension) {
		this.refresh();
		setInterval(() => this.refresh(), 30000);
	}

	async refresh() {
		if (this.paused) {
			return;
		}
		this.pause(true);

		const apiKey = await this.extension.config.apiKey.test();

		if (!apiKey) {
			this.logger.log("API key not found.");
			return;
		}

		this.logger.log(`API key \`${apiKey}\`.`);

		const api = new SquareCloudAPI(apiKey);
		const applications = await api.applications.get();
		const statuses = await api.applications.statusAll();

		const storedStatuses = this.extension.store.getState().statuses;

		for (const status of statuses) {
			storedStatuses.set(status.applicationId, new ApplicationStatus(status));
		}

		this.pause(false);

		this.logger.log(
			`Found ${applications.size} applications and ${statuses.length} statuses.`,
		);

		const store = this.extension.store.getState();
		store.setApplications(applications.toJSON());
		store.setStatuses(Array.from(storedStatuses.values()));
	}

	async refreshStatus(appId: string) {
		if (this.paused) {
			return;
		}
		this.pause(true);

		const apiKey = await this.extension.config.apiKey.test();

		if (!apiKey) {
			this.logger.log("API key not found.");
			return;
		}

		const api = new SquareCloudAPI(apiKey);
		const application = await api.applications.get(appId);
		const status = await application.getStatus();

		this.pause(false);

		this.extension.store.getState().setStatus(new ApplicationStatus(status));
	}

	async pauseUntil<T>(fn: () => Promise<T>) {
		this.pause(true);
		return fn().finally(() => this.pause(false));
	}

	private pause(value?: boolean) {
		this.paused = value || !this.paused;
	}
}
