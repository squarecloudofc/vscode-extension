import { workspace } from "vscode";

class ConfigCore {
  get rootConfiguration() {
    return workspace.getConfiguration("squarecloud");
  }

  get apiKey() {
    return this.rootConfiguration.get<string | undefined>("apiKey");
  }
}

export const configCore = new ConfigCore();
