import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import ignore from "ignore";
import JSZip from "jszip";
import { CancellationError, ProgressLocation, type Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { walkDir } from "@/lib/utils/walk-dir";
import { ApplicationCommand } from "@/structures/application/command";

type CommitKind = "file" | "folder";

export const commitEntry = new ApplicationCommand(
  "commitEntry",
  async (extension, { application }) => {
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
      openLabel: t("commit.select", { TYPE: kindLabel.label.toLowerCase() }),
      title: `Commit - ${application.name}`,
    });
    if (!dialog) return;

    const ignoreDefaults = await readFile(
      join(__dirname, "..", "resources", "squarecloud.ignore"),
    );
    const ig = ignore().add(ignoreDefaults.toString("utf-8"));
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
            if (token.isCancellationRequested) throw new CancellationError();
            zip.file(basename(uri.fsPath), await readFile(uri.fsPath));
          }
        } else {
          const rootUri = dialog[0];
          await maybeMergeIgnore(rootUri, ig);
          const folderName = basename(rootUri.fsPath);
          for await (const entry of walkDir(rootUri.fsPath, ig)) {
            if (token.isCancellationRequested) throw new CancellationError();
            zip.file(`${folderName}/${entry.relPath}`, entry.content);
          }
        }

        progress.report({ message: t("commit.zipping") });

        const buffer = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });

        if (token.isCancellationRequested) throw new CancellationError();
        progress.report({ message: t("commit.uploading") });

        await application.commit(buffer, `${application.id}.zip`);

        if (shouldRestart) await application.restart();

        extension.api.scheduleStatusRefresh(application.id);

        progress.report({ increment: 100 });
        window.showInformationMessage(t("commit.loaded"));
      },
    );
  },
);

async function maybeMergeIgnore(
  rootUri: Uri,
  ig: ReturnType<typeof ignore>,
): Promise<void> {
  const squarecloudIgnore = await readFile(
    join(rootUri.fsPath, "squarecloud.ignore"),
  ).catch(() => null);
  if (squarecloudIgnore) {
    ig.add(squarecloudIgnore.toString("utf-8"));
    return;
  }
  const gitIgnore = await readFile(join(rootUri.fsPath, ".gitignore")).catch(
    () => null,
  );
  if (!gitIgnore) return;

  // Only ask the user about .gitignore when there's no squarecloud.ignore —
  // otherwise the prompt is noise.
  if (await confirm(t("commit.useGitIgnore"), { modal: false })) {
    ig.add(gitIgnore.toString("utf-8"));
  }
}
