import { ExtensionID } from "@/constants";
import { Config } from "@/constants/config";
import { SquareCloudAPI } from "@squarecloud/api";
import { type SecretStorage, commands, workspace } from "vscode";

class CoreConfig {
	private secrets?: SecretStorage;

	setSecretStorage(secrets: SecretStorage) {
		this.secrets = secrets;
	}

	get rootConfiguration() {
		return workspace.getConfiguration(ExtensionID);
	}

	async getApiKey() {
		const apiKey = await this.secrets?.get(Config.APIKey.name);
		commands.executeCommand("setContext", Config.APIKey, !!apiKey);

		return apiKey;
	}

	async setApiKey(value?: string) {
		if (!value) {
			await this.secrets?.delete(Config.APIKey.name);
			return;
		}
		await this.secrets?.store(Config.APIKey.name, value);
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
