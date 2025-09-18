import { SquareCloudAPI } from "@squarecloud/api";
import { commands, type SecretStorage } from "vscode";

import { Config } from "@/lib/constants";

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

  async test(apiKey?: string) {
    apiKey = apiKey || (await this.get());

    if (!apiKey) {
      await this.set(undefined);
      return;
    }

    const api = new SquareCloudAPI(apiKey);
    const user = await api.users.get().catch(() => null);

    if (!user) {
      await this.set(undefined);
      return;
    }

    return apiKey;
  }
}
