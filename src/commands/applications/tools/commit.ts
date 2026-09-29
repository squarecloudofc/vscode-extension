import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import JSZip from "jszip";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { loadIgnore, walkDir } from "@/lib/utils/walk-dir";
import { ApplicationCommand } from "@/structures/application/command";

type CommitKind = "file" | "folder";

export const commitEntry = new ApplicationCommand(
  "commitEntry",
  async (extension, { application }, api) => {
    const kindLabel = await window.showQuickPick(
      [
        { label: t("generic.file"), id: "file" as const },
        { label: t("generic.folder"), id: "folder" as const },
      ],
      {
        title: t("commit.fileOrFolder"),
        placeHolder: t("generic.choose"),
      },
    );
    if (!kindLabel) return;
    const kind: CommitKind = kindLabel.id;

    const shouldRestart = await confirm(t("commit.restart"), { modal: false });

    const dialog = await window.showOpenDialog({
      canSelectMany: kind === "file",
      canSelectFiles: kind === "file",
      canSelectFolders: kind === "folder",
      // Two t() calls, not t(ternary): check-strings only sees literal keys.
      openLabel:
        kind === "file" ? t("commit.selectFiles") : t("commit.selectFolder"),
      title: `${t("command.commit")} - ${application.name}`,
    });
    if (!dialog) return;

    const zip = new JSZip();

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("commit.loading"),
        cancellable: true,
      },
      async (progress, token) => {
        if (kind === "file") {
          for (const uri of dialog) {
            // Cancel is the user's choice, not a failure: no error toast (a
            // thrown CancellationError surfaced as "Canceled").
            if (token.isCancellationRequested) return;
            zip.file(basename(uri.fsPath), await readFile(uri.fsPath));
          }
        } else {
          const root = dialog[0].fsPath;
          const ig = await loadIgnore(root);
          const folderName = basename(root);
          for await (const entry of walkDir(root, ig)) {
            if (token.isCancellationRequested) return;
            zip.file(`${folderName}/${entry.relPath}`, entry.content);
          }
        }

        progress.report({ message: t("commit.zipping") });

        const buffer = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });

        if (token.isCancellationRequested) return;
        progress.report({ message: t("commit.uploading") });

        // The SDK gives uploads no timeout; Cancel is how one ends early.
        const upload = new AbortController();
        token.onCancellationRequested(() => upload.abort());
        try {
          await api.apps.commit(application.id, buffer, {
            filename: `${application.id}.zip`,
            signal: upload.signal,
          });
        } catch (error) {
          if (token.isCancellationRequested) return;
          throw error;
        }

        if (shouldRestart) await api.apps.restart(application.id);

        extension.api.scheduleStatusRefresh(application.id);

        progress.report({ increment: 100 });
        window.showInformationMessage(t("commit.loaded"));
      },
    );
  },
);
