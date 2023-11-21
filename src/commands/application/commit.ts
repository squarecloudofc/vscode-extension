import * as AdmZip from "adm-zip";
import { existsSync, readFileSync } from "fs";
import ignore from "ignore";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";
import cacheManager from "../../managers/cache.manager";
import { ApplicationCommand } from "../../structures/application.command";
import { join } from "path";

export default new ApplicationCommand("commitEntry", async ({ application }) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  const fileOrFolder = await vscode.window.showQuickPick([t("generic.file"), t("generic.folder")], {
    title: t("commit.fileOrFolder"),
    placeHolder: t("generic.choose"),
  });

  if (!fileOrFolder) {
    return;
  }

  const [isFile, isFolder] = [fileOrFolder === t("generic.file"), fileOrFolder === t("generic.folder")];

  const files = await vscode.window.showOpenDialog({
    canSelectMany: isFile,
    canSelectFiles: isFile,
    canSelectFolders: isFolder,
    openLabel: t("commit.select", { TYPE: fileOrFolder.toLowerCase() }),
    title: `Commit - ${application.tag}`,
  });

  if (!files) {
    return;
  }

  const ig = ignore().add(read(join(__dirname, "/../../../defaults.ignore")));
  const zipFile = new AdmZip();

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t("commit.loading"),
    },
    async (progress) => {
      if (isFile) {
        for (let { path } of files) {
          path = path.slice(1);
          zipFile.addLocalFile(path);
        }
      }

      if (isFolder) {
        let [{ path }] = files;
        path = path.slice(1);

        if (existsSync(path + "/squarecloud.ignore")) {
          ig.add(read(path + "/squarecloud.ignore"));
        } else if (existsSync(path + "/.gitignore")) {
          const canIgnore = await vscode.window.showInformationMessage(
            t("commit.useGitIgnore"),
            t("generic.yes"),
            t("generic.no"),
          );

          if (canIgnore === t("generic.yes")) {
            ig.add(read(path + "/.gitignore"));
          }
        }

        await zipFile.addLocalFolderPromise(path, {
          zipPath: path.split("/").pop() + "/",
          filter: (filename) => !ig.ignores(filename),
        });
      }

      await application.commit(zipFile.toBuffer(), `${application.id}.zip`, true);

      setTimeout(() => cacheManager.refreshStatus(application.id), 7000);

      progress.report({ increment: 100 });
      vscode.window.showInformationMessage(t("commit.loaded"));
    },
  );
});

function read(path: string) {
  return readFileSync(path).toString("utf8");
}
