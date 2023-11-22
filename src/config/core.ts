import { workspace } from "vscode";

class CoreConfig {
  get rootConfiguration() {
    return workspace.getConfiguration("squarecloud");
  }

  get apiKey() {
    return this.rootConfiguration.get<string | undefined>("apiKey");
  }
}

export const coreConfig = new CoreConfig();
