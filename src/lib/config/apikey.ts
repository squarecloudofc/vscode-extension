import { Config } from "@/lib/constants";
import { SquareCloudAPI } from "@squarecloud/api";
import { type SecretStorage, commands } from "vscode";

export class ConfigAPIKey {
	constructor(private readonly secrets: SecretStorage) {}

	async get() {
		const apiKey = await this.secrets.get(Config.APIKey.name);
		commands.executeCommand("setContext", `${Config.APIKey}`, !!apiKey);

		return apiKey;
	}

	async set(value: string | undefined) {
		if (!value) {
			await this.secrets.delete(Config.APIKey.name);
			return;
		}
		await this.secrets.store(Config.APIKey.name, value);
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
