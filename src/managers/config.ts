import { workspace } from "vscode";

import { ApiKey } from "@/lib/api-key";
import { ExtensionID } from "@/lib/constants";

export class ConfigManager {
  apiKey = new ApiKey();

  get root() {
    return workspace.getConfiguration(ExtensionID);
  }
}
