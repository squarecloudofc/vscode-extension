import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";
import cacheManager from "../../managers/cache.manager";
import { ApplicationCommand } from "../../structures/application.command";

export default new ApplicationCommand("deleteEntry", async ({ application }) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  const confirmDelete = await vscode.window.showInputBox({
    placeHolder: application.tag,
    title: t("delete.confirm"),
  });

  if (confirmDelete !== application.tag) {
    vscode.window.showInformationMessage(t("delete.cancelled"));
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t("delete.loading"),
    },
    async (progress) => {
      const { downloadURL } = await cacheManager.pauseUntil(async () => {
        const url = await application.backup();
        await application.delete();
        return url!;
      });
      setTimeout(() => cacheManager.refreshData(), 7000);

      vscode.window.showInformationMessage(t("delete.loaded"), "Download Backup").then(async (value) => {
        if (value === "Download Backup") {
          vscode.env.openExternal(vscode.Uri.parse(downloadURL));
        }
      });

      progress.report({ increment: 100 });
    },
  );
});
