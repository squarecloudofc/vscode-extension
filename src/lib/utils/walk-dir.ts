import type { Ignore } from "ignore";
import { readdir, readFile } from "node:fs/promises";
import { posix, sep } from "node:path";

export interface WalkedFile {
  /** Path relative to the walk root, always using POSIX separators. */
  relPath: string;
  content: Buffer;
}

/**
 * Recursively yields files inside `root`, honoring an `ignore` instance.
 * - Symbolic links are skipped (mirrors adm-zip's previous behavior).
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
    if (entry.isSymbolicLink()) continue;

    const rel = prefix ? posix.join(prefix, entry.name) : entry.name;
    const ignoreKey = entry.isDirectory() ? `${rel}/` : rel;
    if (ig.ignores(ignoreKey)) continue;

    const absolute = `${root}${sep}${entry.name}`;
    if (entry.isDirectory()) {
      yield* walkDir(absolute, ig, rel);
    } else if (entry.isFile()) {
      yield { relPath: rel, content: await readFile(absolute) };
    }
  }
}
