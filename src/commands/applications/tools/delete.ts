import { env, ProgressLocation, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { ApplicationCommand } from "@/structures/application/command";

export const deleteEntry = new ApplicationCommand(
  "deleteEntry",
  async (extension, { application }) => {
    if (extension.api.paused) {
      return;
    }

    const confirmDelete = await window.showInputBox({
      placeHolder: application.name,
      title: t("delete.confirm"),
    });

    if (confirmDelete !== application.name) {
      window.showInformationMessage(t("delete.cancelled"));
      return;
    }

    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("delete.loading"),
      },
      async (progress) => {
        const backupUrl = await extension.api.pauseUntil(async () => {
          const backup = await application.backups.create();
          await application.delete();
          return backup.url;
        });

        setTimeout(() => extension.api.refreshStatus(application.id), 7000);

        window
          .showInformationMessage(t("delete.loaded"), "Download Backup")
          .then((value) => {
            if (value === "Download Backup") {
              env.openExternal(Uri.parse(backupUrl));
            }
          });

        progress.report({ increment: 100 });
      },
    );
  },
);
