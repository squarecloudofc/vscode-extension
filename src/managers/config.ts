import { type SecretStorage, workspace } from "vscode";

import { ConfigAPIKey } from "@/lib/config/apikey";
import { ExtensionID } from "@/lib/constants";

export class ConfigManager {
  apiKey = new ConfigAPIKey(this.secrets);

  constructor(private readonly secrets: SecretStorage) {}

  get root() {
    return workspace.getConfiguration(ExtensionID);
  }
}
