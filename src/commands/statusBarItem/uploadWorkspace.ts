import { existsSync } from "fs";
import { join } from "path";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";
import createConfigFile from "../../helpers/generatefile.helper";
import getIgnoreFile from "../../helpers/ignores.helper";
import cacheManager from "../../managers/cache.manager";
import configManager from "../../managers/config.manager";
import apiService from "../../services/api.service";
import { Command } from "../../structures/command";
import AdmZip = require("adm-zip");

export default new Command("uploadWorkspace", async () => {
  const path = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (!path) {
    return;
  }

  if (!existsSync(join(path, "squarecloud.app")) && !existsSync(join(path, "squarecloud.config"))) {
    const created = await createConfigFile(path);

    if (!created) {
      vscode.window.showErrorMessage(t("uploadWorkspace.createFile"));
      return;
    }
  }

  const ig = await getIgnoreFile(path);
  const zipFile = new AdmZip();

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t("uploadWorkspace.loading"),
    },
    async (progress) => {
      await zipFile.addLocalFolderPromise(path, {
        filter: (filename) => !ig.ignores(filename),
      });

      const { data } = (await cacheManager.pauseUntil(() => apiService.upload(zipFile.toBuffer())))!;

      await configManager.defaultConfig.update("workspaceAppId", data?.id, null);

      await cacheManager.refreshData();

      vscode.window.showInformationMessage(t("uploadWorkspace.loaded"));
      progress.report({ increment: 100 });
    },
  );
});
