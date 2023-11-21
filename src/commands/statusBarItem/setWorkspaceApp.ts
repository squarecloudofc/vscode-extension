import * as vscode from "vscode";
import cacheManager from "../../managers/cache.manager";
import { Command } from "../../structures/command";
import { t } from "vscode-ext-localisation";
import configManager from "../../managers/config.manager";

export default new Command("setWorkspaceApp", async () => {
  const { applications } = cacheManager;

  const application = await vscode.window.showQuickPick(
    [
      { label: `$(remove) ${t("setWorkspaceApp.none")}`, detail: undefined },
      ...applications.map((app) => ({
        label: "$(symbol-function) " + app.tag,
        detail: app.id,
      })),
    ],
    {
      title: t("setWorkspaceApp.select"),
      placeHolder: t("generic.choose"),
    },
  );

  if (!application) {
    return;
  }

  await configManager.defaultConfig.update("workspaceAppId", application.detail, null);

  vscode.window.showInformationMessage(t("setWorkspaceApp.success"));
});
