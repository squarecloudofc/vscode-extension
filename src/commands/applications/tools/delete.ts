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
        const snapshotUrl = await extension.api.pauseUntil(async () => {
          const snapshot = await application.snapshots.create();
          await application.delete();
          return snapshot.url;
        });

        setTimeout(() => extension.api.refreshStatus(application.id), 7000);

        window
          .showInformationMessage(t("delete.loaded"), "Download Snapshot")
          .then((value) => {
            if (value === "Download Snapshot") {
              env.openExternal(Uri.parse(snapshotUrl));
            }
          });

        progress.report({ increment: 100 });
      },
    );
  },
);
