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

	async refresh(bypass?: boolean) {
		if (this.paused && !bypass) {
			return;
		}
		this.pause(true);

		const apiKey = await this.extension.config.apiKey.test();

		if (!apiKey) {
			this.logger.log("API key not found.");
			return;
		}

		const api = new SquareCloudAPI(apiKey);
		const user = await api.users.get();
		const applications = user.applications;
		const statuses = await api.applications.statusAll();

		this.pause(false);

		this.logger.log(
			`Found ${applications.size} applications and ${statuses.length} statuses.`,
		);

		const newApplications = applications.toJSON();
		const newStatuses = statuses.map((status) => new ApplicationStatus(status));

		this.extension.store.actions.setApplications(newApplications);
		this.extension.store.actions.setStatuses(newStatuses);
		this.extension.store.actions.setUser(user);
	}

	async refreshStatus(appId: string, bypass?: boolean) {
		if (this.paused && !bypass) {
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

		this.extension.store.actions.setStatus(new ApplicationStatus(status));
	}

	async pauseUntil<T>(fn: () => Promise<T>) {
		this.pause(true);
		return fn().finally(() => this.pause(false));
	}

	private pause(value?: boolean) {
		this.paused = value || !this.paused;
	}
}
