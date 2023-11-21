import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";
import cacheManager from "../managers/cache.manager";
import configManager from "../managers/config.manager";
import apiService from "../services/api.service";
import { Command } from "../structures/command";

export default new Command("setApiKey", async () => {
  const apiKey = await vscode.window.showInputBox({
    title: t("setApiKey.apiKey"),
    placeHolder: t("generic.paste"),
    ignoreFocusOut: true,
  });

  if (!apiKey) {
    return;
  }

  const testKey = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t("setApiKey.testing"),
    },
    async () => {
      return await apiService.testKey(apiKey);
    },
  );

  if (!testKey) {
    return;
  }

  await configManager.setApiKey(apiKey);
  cacheManager.refreshData();

  vscode.window.showInformationMessage(t("setApiKey.success"));
});
