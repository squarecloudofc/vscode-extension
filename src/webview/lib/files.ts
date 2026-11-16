// The pure half of an app's files: the `squarecloud:` file system
// (src/providers/files.ts) and the Files tab share it. A URI is
// `squarecloud://app/<appId>/<path>`; the API takes the absolute `<path>`.
// No imports: `node --test` loads this file directly.

export const FILES_SCHEME = "squarecloud";
/** The API's limits on `files.*`: content and the whole path. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PATH = 256;

/** `/a//b/` → `/a/b`; the root is `/`. Undefined with a `.` or `..` part. */
export function normalizePath(path: string): string | undefined {
  const parts = path.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) return undefined;
  return `/${parts.join("/")}`;
}

/** A URI's path (`/<appId>/src/index.js`) → the app and `/src/index.js`. */
export function splitUriPath(
  uriPath: string,
): { appId: string; path: string } | undefined {
  const match = /^\/([^/]+)(\/.*)?$/.exec(uriPath);
  const path = normalizePath(match?.[2] ?? "/");
  return match?.[1] && path ? { appId: match[1], path } : undefined;
}

export const parentOf = (path: string) =>
  path.slice(0, path.lastIndexOf("/")) || "/";

export const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export const joinPath = (dir: string, name: string) =>
  dir === "/" ? `/${name}` : `${dir}/${name}`;

/**
 * Why a path can't be used, before asking: its length. Square Cloud's own
 * `.squarecloud` folder is the API's to refuse (403 BLOCKED_PATH).
 */
export function pathProblem(path: string): "long" | undefined {
  return path.length > MAX_PATH ? "long" : undefined;
}

/**
 * A name typed in the tab (`src/new.ts` makes `src` too) joined to the
 * folder it goes in; undefined when it isn't one.
 */
export function childPath(dir: string, name: string): string | undefined {
  const typed = name.trim();
  if (!typed || typed.endsWith("/")) return undefined;
  const path = normalizePath(joinPath(dir, typed));
  return path && path !== dir && path !== "/" ? path : undefined;
}

/** What a failed request means to a file system (vscode.FileSystemError). */
export type FsErrorKind = "FileNotFound" | "NoPermissions" | "Unavailable";

/**
 * 404 is a missing file or folder; 403 a blocked path, role or scope; 413
 * a file over 10 MB; no answer, 429 and 5xx are worth retrying. Anything
 * else (400 INVALID_PATH, WRITE_FAILED) is a plain error.
 */
export function fsErrorKind(status: number): FsErrorKind | undefined {
  if (status === 404) return "FileNotFound";
  if (status === 401 || status === 403 || status === 413)
    return "NoPermissions";
  if (status === 0 || status === 429 || status >= 500) return "Unavailable";
  return undefined;
}

type Entry = { name: string; type: "file" | "directory" };

/** Folders first, then by name, as the site's tree. */
export function sortEntries<T extends Entry>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      Number(b.type === "directory") - Number(a.type === "directory") ||
      a.name.localeCompare(b.name, "en", { numeric: true }),
  );
}
