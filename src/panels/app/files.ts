import { homedir } from "node:os";
import { join } from "node:path";
import { commands, Uri, window, workspace } from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import { describeError } from "@/lib/utils/errors";
import { paced } from "@/lib/utils/pace";
import { AppFileSystem } from "@/providers/files";
import {
  baseName,
  joinPath,
  MAX_FILE_BYTES,
  normalizePath,
} from "@/webview/lib/files";

import type { Handlers } from "../panel-manager";

const pathOf = (params: unknown, key = "path"): string => {
  const value =
    typeof params === "object" && params !== null
      ? (params as Record<string, unknown>)[key]
      : undefined;
  const path = typeof value === "string" ? normalizePath(value) : undefined;
  if (!path) throw new Error(t("files.invalidPath"));
  return path;
};

/**
 * Where a save or open dialog starts: the first local workspace folder (an
 * app opened as a folder is `squarecloud:`, not a place on disk), else home.
 */
export const defaultDir = () =>
  workspace.workspaceFolders?.find((f) => f.uri.scheme === "file")?.uri
    .fsPath ?? homedir();

/**
 * The Files tab's RPC methods (`files.*` in AppMethod): the tree, and
 * what it does to a file, over the extension's `squarecloud:` file system,
 * so an editor open on a file sees the same changes.
 */
export function filesHandlers(
  extension: SquareCloudExtension,
  id: string,
  name: () => string,
): Handlers {
  const fs = extension.files;
  const uri = (path: string) => AppFileSystem.uri(id, path);

  return {
    /** A folder's entries; `fresh` reads them again. */
    "files.list": async (params) => {
      if ((params as { fresh?: unknown })?.fresh === true) fs.forget(id);
      return fs.list(id, pathOf(params));
    },

    /** In a normal editor (or VS Code's viewer for images and binaries). */
    "files.open": async (params) => {
      await commands.executeCommand("vscode.open", uri(pathOf(params)));
    },

    /** An empty file, opened; or a folder. Refuses an existing name. */
    "files.create": async (params) => {
      const path = pathOf(params);
      const folder = (params as { kind?: unknown }).kind === "folder";
      if (await fs.entry(id, path).catch(() => undefined))
        throw new Error(t("files.exists", { NAME: baseName(path) }));
      if (folder) return fs.mkdir(id, path);
      await fs.write(id, path, new Uint8Array(), true);
      await commands.executeCommand("vscode.open", uri(path));
    },

    "files.rename": async (params) => {
      const from = pathOf(params, "from");
      const to = pathOf(params, "to");
      if (from === to) return;
      if (await fs.entry(id, to).catch(() => undefined))
        throw new Error(t("files.exists", { NAME: baseName(to) }));
      await fs.move(id, from, to);
    },

    "files.delete": async (params) => fs.remove(id, pathOf(params)),

    /** Where the user picks; the saved file's path, or null when canceled. */
    "files.download": async (params) => {
      const path = pathOf(params);
      const target = await window.showSaveDialog({
        defaultUri: Uri.file(join(defaultDir(), baseName(path))),
      });
      if (!target) return null;
      await workspace.fs.writeFile(target, await fs.read(id, path));
      return target.fsPath;
    },

    /**
     * Local files the user picks, into `dir` (existing names overwritten,
     * as a commit does), paced under the write limit. How many went; 0
     * when canceled. Stopped part-way, the error says how many went.
     */
    "files.upload": async (params) => {
      const dir = pathOf(params, "dir");
      const picked =
        (await window.showOpenDialog({
          canSelectMany: true,
          openLabel: t("app.files.upload"),
        })) ?? [];
      const sizes = await Promise.all(
        picked.map((file) => workspace.fs.stat(file)),
      );
      const large = picked.filter((_, i) => sizes[i].size > MAX_FILE_BYTES);
      if (large.length)
        throw new Error(
          t("files.uploadTooLarge", {
            NAMES: large.map((file) => baseName(file.path)).join(", "),
          }),
        );
      // fs.write keeps the pace (and waits out KEEP_CALM) for every writer.
      const { done, error } = await paced(
        picked,
        async (file) =>
          fs.write(
            id,
            joinPath(dir, baseName(file.path)),
            await workspace.fs.readFile(file),
            true,
          ),
        { gapMs: 0 },
      );
      if (!error) return done;
      // Nothing went: the error as it is (a missing scope offers Reconnect).
      if (!done) throw error;
      throw new Error(
        `${t("files.uploadPartial", { COUNT: done, TOTAL: picked.length })} ${describeError(error)}`,
      );
    },

    /** Adds the app to the workspace, named after it; reveals it if there. */
    "files.openFolder": async () => {
      const root = uri("/");
      const folders = workspace.workspaceFolders ?? [];
      if (folders.some((f) => f.uri.toString() === root.toString()))
        return void commands.executeCommand("workbench.view.explorer");
      workspace.updateWorkspaceFolders(folders.length, 0, {
        uri: root,
        name: name(),
      });
    },
  };
}
