import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import JSZip from "jszip";
import { ProgressLocation, type Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { loadIgnore, walkDir } from "@/lib/utils/walk-dir";
import { ApplicationCommand } from "@/structures/application/command";

export type CommitKind = "file" | "folder";

/** Files (several) or one folder to commit, from the open dialog. */
export function pickCommitSource(
  kind: CommitKind,
  appName: string,
): Thenable<Uri[] | undefined> {
  return window.showOpenDialog({
    canSelectMany: kind === "file",
    canSelectFiles: kind === "file",
    canSelectFolders: kind === "folder",
    // Two t() calls, not t(ternary): check-strings only sees literal keys.
    openLabel:
      kind === "file" ? t("commit.selectFiles") : t("commit.selectFolder"),
    title: `${t("command.commit")} - ${appName}`,
  });
}

/**
 * The zip a commit uploads: files at its root, or the folder under its own
 * name minus what its ignore files list. Undefined once `cancelled()`.
 */
export async function zipForCommit(
  kind: CommitKind,
  uris: readonly Uri[],
  cancelled: () => boolean = () => false,
): Promise<Buffer | undefined> {
  const zip = new JSZip();
  if (kind === "file") {
    for (const uri of uris) {
      if (cancelled()) return undefined;
      zip.file(basename(uri.fsPath), await readFile(uri.fsPath));
    }
  } else {
    const root = uris[0]?.fsPath;
    if (!root) return undefined;
    const ig = await loadIgnore(root);
    const folderName = basename(root);
    for await (const entry of walkDir(root, ig)) {
      if (cancelled()) return undefined;
      zip.file(`${folderName}/${entry.relPath}`, entry.content);
    }
  }
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

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

    const dialog = await pickCommitSource(kind, application.name);
    if (!dialog) return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("commit.loading"),
        cancellable: true,
      },
      async (progress, token) => {
        // Cancel is the user's choice, not a failure: no error toast (a
        // thrown CancellationError surfaced as "Canceled").
        const cancelled = () => token.isCancellationRequested;
        progress.report({ message: t("commit.zipping") });
        const buffer = await zipForCommit(kind, dialog, cancelled);
        if (!buffer || cancelled()) return;
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
          if (cancelled()) return;
          throw error;
        }

        if (shouldRestart) await api.apps.restart(application.id);

        extension.api.scheduleStatusRefresh(application.id);
      },
    );
  },
);
