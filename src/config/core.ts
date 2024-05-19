import { CONFIG_API_KEY } from "@/constants/config";
import { EXTENSION_ID } from "@/constants/core";
import { SquareCloudAPI } from "@squarecloud/api";
import { type SecretStorage, commands, workspace } from "vscode";

class CoreConfig {
	private secrets?: SecretStorage;

	setSecretStorage(secrets: SecretStorage) {
		this.secrets = secrets;
	}

	get rootConfiguration() {
		return workspace.getConfiguration(EXTENSION_ID);
	}

	async getApiKey() {
		const apiKey = await this.secrets?.get(CONFIG_API_KEY.name);
		commands.executeCommand("setContext", CONFIG_API_KEY, !!apiKey);

		return apiKey;
	}

	async setApiKey(value?: string) {
		if (!value) {
			await this.secrets?.delete(CONFIG_API_KEY.name);
			return;
		}
		await this.secrets?.store(CONFIG_API_KEY.name, value);
	}

	async testApiKey() {
		const apiKey = await this.getApiKey();

		if (!apiKey) {
			return this.setApiKey();
		}

		const api = new SquareCloudAPI(apiKey);

		return api.users
			.get()
			.then(() => apiKey)
			.catch(() => this.setApiKey());
	}
}

export const coreConfig = new CoreConfig();
