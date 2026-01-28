import { SquareCloudAPI } from "@squarecloud/api";

import { ApiKeyStore } from "./store";

export class ApiKey {
  private readonly store = new ApiKeyStore();

  async get() {
    const apiKey = await this.store.get();
    return apiKey;
  }

  async set(value: string | undefined) {
    if (!value) return void (await this.store.delete());
    await this.store.set(value);
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
