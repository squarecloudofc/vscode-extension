import { SquareCloudAPI } from "@squarecloud/api";
import { commands, type SecretStorage } from "vscode";

import { Config } from "@/lib/constants";

export class ConfigAPIKey {
  constructor(private readonly secrets: SecretStorage) {}

  async get() {
    const apiKey = await this.secrets.get(Config.APIKey.value);
    commands.executeCommand("setContext", Config.APIKey.value, !!apiKey);

    return apiKey;
  }

  async set(value: string | undefined) {
    if (!value) {
      await this.secrets.delete(Config.APIKey.value);
      return;
    }
    await this.secrets.store(Config.APIKey.value, value);
  }

  async test(apiKey?: string) {
    apiKey = apiKey || (await this.get());

    if (!apiKey) {
      await this.set(undefined);
      return;
    }

    const api = new SquareCloudAPI(apiKey);
    const user = await api.user.get().catch(() => null);

    if (!user) {
      await this.set(undefined);
      return;
    }

    return apiKey;
  }
}
