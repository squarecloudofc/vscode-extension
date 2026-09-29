import { createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { ApplicationCommand } from "@/structures/application/command";

export const snapshotEntry = new ApplicationCommand(
  "snapshotEntry",
  async (_extension, { application }, api) => {
    const dialog = await window.showOpenDialog({
      // Files default to selectable too, and macOS then lets one be picked.
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: t("snapshot.save"),
      title: `${t("command.snapshot")} - ${application.name}`,
    });

    if (!dialog) return;
    const [{ fsPath }] = dialog;
    const file = join(fsPath, `snapshot-${application.id}.zip`);

    const saved = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("snapshot.loading"),
      },
      async () => {
        const snapshot = await api.apps.snapshots.create(application.id);
        // 202: still generating, no URL yet.
        if (snapshot.pending) return false;

        // Streamed straight to disk — a large snapshot is never held in memory.
        // Into a side file first: a failed download must not truncate the
        // snapshot a previous run saved under the same name.
        const partial = `${file}.part`;
        const stream = await api.downloadSnapshot(snapshot.url);
        await stream
          .pipeTo(Writable.toWeb(createWriteStream(partial)))
          .catch(async (error) => {
            // A half-written zip looks like a backup and isn't one.
            await rm(partial, { force: true });
            throw error;
          });
        await rename(partial, file);
        return true;
      },
    );

    window.showInformationMessage(
      saved ? t("snapshot.loaded") : t("snapshot.pending"),
    );
  },
);
