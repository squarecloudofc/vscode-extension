import { workspace } from "vscode";
import { treeViewsManager } from "../treeviews/manager";
import { CONFIG_API_KEY } from "../constants/config";

export function listenForApiKey() {
  return workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_API_KEY)) {
      treeViewsManager.refreshAll();
    }
  });
}
