import { env, ProgressLocation, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { showMessageWithActions } from "@/lib/utils/dialogs";
import { ApplicationCommand } from "@/structures/application/command";

export const deleteEntry = new ApplicationCommand(
  "deleteEntry",
  async (extension, { application }) => {
    const typed = await window.showInputBox({
      placeHolder: application.name,
      title: t("delete.confirm"),
    });

    if (typed !== application.name) {
      window.showInformationMessage(t("delete.cancelled"));
      return;
    }

    // Take a recovery snapshot inside withProgress so the spinner only spans
    // the actual work, and surface the post-delete toast OUTSIDE — otherwise
    // the progress notification would hang waiting for the user to dismiss
    // the toast (the same bug we had on the cert download).
    const snapshotUrl = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("delete.loading"),
      },
      async () => {
        const snapshot = await application.snapshots.create();
        await application.delete();
        return snapshot.url;
      },
    );

    setTimeout(() => void extension.api.refresh(), 7_000);

    const choice = await showMessageWithActions(t("delete.loaded"), [
      { id: "download", title: t("delete.downloadSnapshot") },
    ]);
    if (choice === "download") {
      env.openExternal(Uri.parse(snapshotUrl));
    }
  },
);
