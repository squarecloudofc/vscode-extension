import { type SecretStorage, workspace } from "vscode";

import { ApiKey } from "@/lib/api-key";
import { ExtensionID } from "@/lib/constants";

export class ConfigManager {
  apiKey = new ApiKey(this.secrets);

  constructor(private readonly secrets: SecretStorage) {}

  get root() {
    return workspace.getConfiguration(ExtensionID);
  }
}
