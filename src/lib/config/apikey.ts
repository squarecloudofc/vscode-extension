import { Config } from "@/lib/constants";
import { config } from "@/managers/config";
import { SquareCloudAPI } from "@squarecloud/api";
import { commands } from "vscode";

export class ConfigAPIKey {
	async get() {
		const apiKey = await config.secrets?.get(Config.APIKey.name);
		commands.executeCommand("setContext", `${Config.APIKey}`, !!apiKey);

		return apiKey;
	}

	async set(value: string | undefined) {
		if (!value) {
			await config.secrets?.delete(Config.APIKey.name);
			return;
		}
		await config.secrets?.store(Config.APIKey.name, value);
	}

	async test() {
		const apiKey = await this.get();

		if (!apiKey) {
			return this.set(undefined);
		}

		const api = new SquareCloudAPI(apiKey);
		const user = await api.users.get().catch(() => undefined);

		if (!user) {
			return this.set(undefined);
		}

		return apiKey;
	}
}

export const configAPIKey = new ConfigAPIKey();
