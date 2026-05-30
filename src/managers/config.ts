import { type SecretStorage, workspace } from "vscode";

import { ApiKey } from "@/lib/api-key";
import { ExtensionID } from "@/lib/constants";

export class ConfigManager {
  public readonly apiKey: ApiKey;

  constructor(secrets: SecretStorage) {
    this.apiKey = new ApiKey(secrets);
  }

  get root() {
    return workspace.getConfiguration(ExtensionID);
  }
}
