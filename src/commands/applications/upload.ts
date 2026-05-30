import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import ignore from "ignore";
import JSZip from "jszip";
import {
  CancellationError,
  env,
  type MessageItem,
  ProgressLocation,
  Uri,
  window,
} from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { walkDir } from "@/lib/utils/walk-dir";
import { Command } from "@/structures/command";

const CONFIG_FILENAMES = ["squarecloud.app", "squarecloud.config"];

/**
 * Uploads a new application to Square Cloud. Unlike `commitEntry`, which
 * patches an existing application, this calls `applications.create()` with a
 * freshly built zip of the chosen folder.
 *
 * Validation runs entirely client-side so we don't waste an upload round-trip
 * on a missing `squarecloud.app` / `squarecloud.config`.
 */
export const uploadApplication = new Command(
  "uploadApplication",
  async (extension) => {
    const api = await extension.api.getClient();
    if (!api) return;

    const dialog = await window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: t("upload.select"),
      title: t("upload.title"),
    });
    if (!dialog) return;
    const rootUri = dialog[0];
    const rootPath = rootUri.fsPath;

    // Validate the config file before doing anything expensive.
    const configPath = await findConfigFile(rootPath);
    if (!configPath) {
      type DocsItem = MessageItem & { id: "docs" };
      const docsItem: DocsItem = {
        title: t("upload.openDocs"),
        id: "docs",
      };
      const choice = await window.showErrorMessage<DocsItem>(
        t("upload.missingConfig"),
        docsItem,
      );
      if (choice?.id === "docs") {
        env.openExternal(
          Uri.parse("https://docs.squarecloud.app/getting-started/config-file"),
        );
      }
      return;
    }

    const ignoreDefaults = await readFile(
      join(__dirname, "..", "resources", "squarecloud.ignore"),
    );
    const ig = ignore().add(ignoreDefaults.toString("utf-8"));
    await maybeMergeIgnore(rootPath, ig);

    const proceed = await confirm(t("upload.confirm", { PATH: rootPath }), {
      modal: true,
    });
    if (!proceed) return;

    const result = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("upload.zipping"),
        cancellable: true,
      },
      async (progress, token) => {
        const zip = new JSZip();

        let fileCount = 0;
        for await (const entry of walkDir(rootPath, ig)) {
          if (token.isCancellationRequested) throw new CancellationError();
          zip.file(entry.relPath, entry.content);
          fileCount++;
          if (fileCount % 25 === 0) {
            progress.report({ message: `${fileCount} files...` });
          }
        }

        if (fileCount === 0) throw new Error(t("upload.emptyFolder"));

        progress.report({ message: t("upload.uploading") });
        const buffer = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });

        if (token.isCancellationRequested) throw new CancellationError();
        return api.applications.create(buffer);
      },
    );

    await extension.api.refresh();
    window.showInformationMessage(
      t("upload.loaded", { NAME: result.name, ID: result.id }),
    );
  },
);

async function findConfigFile(rootPath: string): Promise<string | null> {
  for (const filename of CONFIG_FILENAMES) {
    const candidate = join(rootPath, filename);
    const exists = await stat(candidate)
      .then((s) => s.isFile())
      .catch(() => false);
    if (exists) return candidate;
  }
  return null;
}

async function maybeMergeIgnore(
  rootPath: string,
  ig: ReturnType<typeof ignore>,
): Promise<void> {
  const squarecloudIgnore = await readFile(
    join(rootPath, "squarecloud.ignore"),
  ).catch(() => null);
  if (squarecloudIgnore) {
    ig.add(squarecloudIgnore.toString("utf-8"));
    return;
  }
  // Fall back to .gitignore silently — the user already opted into uploading
  // this folder; asking twice would be noise.
  const gitIgnore = await readFile(join(rootPath, ".gitignore")).catch(
    () => null,
  );
  if (gitIgnore) ig.add(gitIgnore.toString("utf-8"));
}
