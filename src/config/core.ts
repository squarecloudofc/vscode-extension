import { SquareCloudAPI } from "@squarecloud/api";
import { workspace } from "vscode";

class CoreConfig {
	get rootConfiguration() {
		return workspace.getConfiguration("squarecloud");
	}

	get apiKey() {
		return this.rootConfiguration.get<string | undefined>("apiKey");
	}

	setApiKey(value?: string) {
		this.rootConfiguration.update("apiKey", value, true);
	}

	async testApiKey() {
		const apiKey = this.apiKey;

		if (!apiKey) {
			return this.setApiKey(undefined);
		}

		const api = new SquareCloudAPI(apiKey);

		return api.users
			.get()
			.then(() => apiKey)
			.catch(() => this.setApiKey(undefined));
	}
}

export const coreConfig = new CoreConfig();
