import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";
import cacheManager from "../../managers/cache.manager";
import { ApplicationCommand } from "../../structures/application.command";

export default new ApplicationCommand("startEntry", ({ application }) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t("start.loading"),
    },
    async (progress) => {
      await cacheManager.pauseUntil(() => application.start());
      setTimeout(() => cacheManager.refreshStatus(application.id), 7000);

      vscode.window.showInformationMessage(t("start.loaded"));
      progress.report({ increment: 100 });
    },
  );
});
