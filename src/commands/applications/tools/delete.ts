import type { SquareCloudAPI } from "@squarecloud/api";
import { env, ProgressLocation, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import { showMessageWithActions } from "@/lib/utils/dialogs";
import { ApplicationCommand } from "@/structures/application/command";

/**
 * Takes a recovery snapshot, then deletes the app. Undefined when the
 * snapshot is still generating (202): the app is left alone, since deleting
 * now could leave it without one.
 */
export async function deleteWithRecovery(
  api: SquareCloudAPI,
  appId: string,
): Promise<string | undefined> {
  const snapshot = await api.apps.snapshots.create(appId);
  if (snapshot.pending) return undefined;
  await api.apps.delete(appId);
  return snapshot.url;
}

/** After a delete: refresh the lists, and offer the recovery snapshot. */
export async function afterDelete(
  extension: SquareCloudExtension,
  snapshotUrl: string,
): Promise<void> {
  setTimeout(() => void extension.api.refresh(), 7_000);
  const choice = await showMessageWithActions(t("delete.loaded"), [
    { id: "download", title: t("delete.downloadSnapshot") },
  ]);
  if (choice === "download") env.openExternal(Uri.parse(snapshotUrl));
}

export const deleteEntry = new ApplicationCommand(
  "deleteEntry",
  async (extension, { application }, api) => {
    const typed = await window.showInputBox({
      placeHolder: application.name,
      title: t("delete.confirm"),
    });

    if (typed !== application.name) {
      window.showInformationMessage(t("delete.cancelled"));
      return;
    }

    // Progress in the status bar: the one notification is the toast after
    // it, which carries the recovery snapshot.
    const snapshotUrl = await window.withProgress(
      {
        location: ProgressLocation.Window,
        title: t("delete.loading"),
      },
      () => deleteWithRecovery(api, application.id),
    );

    if (!snapshotUrl) {
      window.showWarningMessage(t("delete.snapshotPending"));
      return;
    }
    await afterDelete(extension, snapshotUrl);
  },
);
