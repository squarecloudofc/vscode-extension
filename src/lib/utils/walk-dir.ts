import { readdir, readFile, stat } from "node:fs/promises";
import { join, posix, sep } from "node:path";
import ignore, { type Ignore } from "ignore";

/**
 * What a zip of `root` leaves out: the bundled defaults, then the folder's own
 * squarecloud.ignore. Nothing else, .gitignore included: git often leaves out
 * exactly what the app needs to run (.env, build output). The CLI does the same.
 */
export async function loadIgnore(root: string): Promise<Ignore> {
  const defaults = await readFile(
    join(__dirname, "..", "resources", "squarecloud.ignore"),
    "utf-8",
  );
  const own = await readFile(join(root, "squarecloud.ignore"), "utf-8").catch(
    () => "",
  );
  return ignore().add(defaults).add(own);
}

export interface WalkedFile {
  /** Path relative to the walk root, always using POSIX separators. */
  relPath: string;
  content: Buffer;
}

/**
 * Recursively yields files inside `root`, honoring an `ignore` instance.
 * - A symbolic link to a file is yielded as that file; links to folders and
 *   broken links are skipped. The Square Cloud CLI zips the same way.
 * - Directory checks pass a trailing slash to `ignore.ignores()` so that
 *   patterns like `node_modules/` prune the whole subtree.
 */
export async function* walkDir(
  root: string,
  ig: Ignore,
  prefix = "",
): AsyncGenerator<WalkedFile> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = `${root}${sep}${entry.name}`;
    const isFile = entry.isSymbolicLink()
      ? await stat(absolute).then(
          (target) => target.isFile(),
          () => false,
        )
      : entry.isFile();
    const isDirectory = !entry.isSymbolicLink() && entry.isDirectory();
    if (!isFile && !isDirectory) continue;

    const rel = prefix ? posix.join(prefix, entry.name) : entry.name;
    if (ig.ignores(isDirectory ? `${rel}/` : rel)) continue;

    if (isDirectory) yield* walkDir(absolute, ig, rel);
    else yield { relPath: rel, content: await readFile(absolute) };
  }
}
