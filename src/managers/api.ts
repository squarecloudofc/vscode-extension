import { applicationsStore } from "@/lib/stores/applications";
import type { ConfigManager } from "@/managers/config";
import { ApplicationStatus } from "@/structures/application/status";
import { Logger } from "@/structures/logger";
import { SquareCloudAPI } from "@squarecloud/api";

export class APIManager {
	private readonly logger = new Logger("Square Cloud Easy");

	public paused = false;

	constructor(private readonly config: ConfigManager) {
		this.refresh();
		setInterval(() => this.refresh(), 10000);
	}

	async refresh() {
		if (this.paused) {
			return;
		}
		this.pause(true);

		const apiKey = await this.config.apiKey.test();

		if (!apiKey) {
			this.logger.log("API key not found.");
			return;
		}

		this.logger.log(`API key \`${apiKey}\`.`);

		const api = new SquareCloudAPI(apiKey);
		const applications = await api.applications.get();
		const statuses = await api.applications.status();

		const storedStatuses = applicationsStore.get().statuses;

		await Promise.all(
			applications
				.filter((app) => storedStatuses.get(app.id)?.isFull())
				.map(async (app) => {
					const application = await app.fetch();
					const status = await application.getStatus();
					storedStatuses.set(app.id, new ApplicationStatus(status));
				}),
		);

		this.pause(false);

		this.logger.log(
			`Found ${applications.size} applications and ${statuses.length} statuses.`,
		);

		const store = applicationsStore.get();
		store.setApplications(applications.toJSON());
		store.setStatuses(Array.from(storedStatuses.values()));
	}

	async refreshStatus(appId: string) {
		if (this.paused) {
			return;
		}
		this.pause(true);

		const apiKey = await this.config.apiKey.test();

		if (!apiKey) {
			this.logger.log("API key not found.");
			return;
		}

		const api = new SquareCloudAPI(apiKey);
		const application = await api.applications.get(appId);
		const status = await application.getStatus();

		this.pause(false);

		applicationsStore.get().setStatus(new ApplicationStatus(status));
	}

	async pauseUntil<T>(fn: () => Promise<T>) {
		this.pause(true);
		return fn().finally(() => this.pause(false));
	}

	private pause(value?: boolean) {
		this.paused = value || !this.paused;
	}
}
