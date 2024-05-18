import { SquareCloudAPI } from "@squarecloud/api";
import { type SecretStorage, workspace } from "vscode";

class CoreConfig {
	private secrets?: SecretStorage;

	setSecretStorage(secrets: SecretStorage) {
		this.secrets = secrets;
	}

	get rootConfiguration() {
		return workspace.getConfiguration("squarecloud");
	}

	async getApiKey() {
		const apiKey = await this.secrets?.get("apiKey");

		return apiKey;
	}

	async setApiKey(value?: string) {
		if (!value) {
			await this.secrets?.delete("apiKey");
			return;
		}
		await this.secrets?.store("apiKey", value);
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
