import { applicationsStore } from "@/lib/stores/applications";
import type { ConfigManager } from "@/managers/config";
import { Logger } from "@/structures/logger";
import { SquareCloudAPI } from "@squarecloud/api";

export class APIManager {
	private readonly logger = new Logger("Square Cloud Easy");

	constructor(private readonly config: ConfigManager) {
		this.refresh();
		setInterval(() => this.refresh(), 10000);
	}

	async refresh() {
		const apiKey = await this.config.apiKey.test();

		if (!apiKey) {
			this.logger.log("API key not found.");
			return;
		}

		this.logger.log(`API key \`${apiKey}\`.`);

		const api = new SquareCloudAPI(apiKey);
		const applications = await api.applications.get();
		const statuses = await api.applications.status();

		const storedFullStatuses = applicationsStore.get().fullStatuses;
		const fullStatuses = await Promise.all(
			applications
				.filter((app) => storedFullStatuses.get(app.id))
				.map(async (app) => {
					const application = await app.fetch();
					return application.getStatus();
				}),
		);

		this.logger.log(
			`Found ${applications.size} applications and ${statuses.length} statuses.`,
		);

		const store = applicationsStore.get();
		store.setApplications(applications.toJSON());
		store.setFullStatuses(fullStatuses);
		store.setStatuses(statuses);
	}
}
