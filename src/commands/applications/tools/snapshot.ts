import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { ApplicationCommand } from "@/structures/application/command";

export const snapshotEntry = new ApplicationCommand(
  "snapshotEntry",
  async (extension, { application }) => {
    if (extension.api.paused) {
      return;
    }

    const dialog = await window.showOpenDialog({
      canSelectFolders: true,
      openLabel: t("snapshot.save"),
      title: `Snapshot - ${application.name}`,
    });

    if (!dialog) {
      return;
    }

    const [{ fsPath }] = dialog;

    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("snapshot.loading"),
      },
      async (progress) => {
        const buffer = await extension.api.pauseUntil(() =>
          application.snapshots.download(),
        );

        await writeFile(
          join(fsPath, `snapshot-${application.id}.zip`),
          new Uint8Array(buffer),
        );

        window.showInformationMessage(t("snapshot.loaded"));
        progress.report({ increment: 100 });
      },
    );
  },
);
