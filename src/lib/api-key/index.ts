import type { SecretStorage } from "vscode";
import { SquareCloudAPI } from "@squarecloud/api";

import { Config, ExtensionID } from "../constants";
import { ApiKeyStore } from "./store";

export class ApiKey {
  private readonly store = new ApiKeyStore();

  constructor(private readonly secrets: SecretStorage) {}

  async get() {
    let apiKey = await this.store.get();

    if (!apiKey) {
      const secretsApiKey = await this.secrets.get(
        `${ExtensionID}.${Config.APIKey}`,
      );
      if (secretsApiKey) {
        await this.set(secretsApiKey);
        apiKey = secretsApiKey;
      }
    }

    return apiKey;
  }

  async set(value: string | undefined) {
    if (!value) return void (await this.store.delete());
    await this.store.store(value);
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
