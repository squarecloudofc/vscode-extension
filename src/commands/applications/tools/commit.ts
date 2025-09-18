import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ignore from "ignore";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { ApplicationCommand } from "@/structures/application/command";

import AdmZip = require("adm-zip");

export const commitEntry = new ApplicationCommand(
  "commitEntry",
  async (extension, { application }) => {
    if (extension.api.paused) {
      return;
    }

    const fileOrFolder = await window.showQuickPick(
      [t("generic.file"), t("generic.folder")],
      {
        title: t("commit.fileOrFolder"),
        placeHolder: t("generic.choose"),
      },
    );

    if (!fileOrFolder) {
      return;
    }

    const shouldRestart = await window.showQuickPick(
      [t("generic.yes"), t("generic.no")],
      {
        title: t("commit.restart"),
        placeHolder: t("generic.choose"),
      },
    );

    if (shouldRestart === undefined) {
      return;
    }

    const isFile = fileOrFolder === t("generic.file");
    const isFolder = fileOrFolder === t("generic.folder");

    const files = await window.showOpenDialog({
      canSelectMany: isFile,
      canSelectFiles: isFile,
      canSelectFolders: isFolder,
      openLabel: t("commit.select", { TYPE: fileOrFolder.toLowerCase() }),
      title: `Commit - ${application.name}`,
    });

    if (!files) {
      return;
    }

    const ignoreDefaults = await readFile(
      join(__dirname, "..", "resources", "squarecloud.ignore"),
    );

    const ig = ignore().add(ignoreDefaults.toString("utf-8"));
    const zipFile = new AdmZip();

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
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

          const squarecloudIgnore = await readFile(
            join(path, "squarecloud.ignore"),
          ).catch(() => null);

          if (squarecloudIgnore) {
            ig.add(squarecloudIgnore.toString("utf-8"));
          } else {
            const gitIgnore = await readFile(join(path, ".gitignore")).catch(
              () => null,
            );

            if (gitIgnore) {
              const canIgnore = await window.showInformationMessage(
                t("commit.useGitIgnore"),
                t("generic.yes"),
                t("generic.no"),
              );

              if (canIgnore === t("generic.yes")) {
                ig.add(gitIgnore.toString("utf-8"));
              }
            }
          }

          await zipFile.addLocalFolderPromise(path, {
            zipPath: `${path.split("/").pop()}/`,
            filter: (filename) => !ig.ignores(filename),
          });
        }

        await application.commit(zipFile.toBuffer(), `${application.id}.zip`);

        if (shouldRestart === t("generic.yes")) {
          await application.restart();
        }

        setTimeout(() => extension.api.refreshStatus(application.id), 7000);

        progress.report({ increment: 100 });
        window.showInformationMessage(t("commit.loaded"));
      },
    );
  },
);
