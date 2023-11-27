import { workspace } from "vscode";
import { CONFIG_API_KEY } from "../constants/config";
import { applicationsManager } from "../api/applications";
import { coreConfig } from "../config/core";

export function listenForApiKey() {
  return workspace.onDidChangeConfiguration(async (event) => {
    if (event.affectsConfiguration(CONFIG_API_KEY) && (await coreConfig.testApiKey())) {
      await applicationsManager.refresh();
    }
  });
}
