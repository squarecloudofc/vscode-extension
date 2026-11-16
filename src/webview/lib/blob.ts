// The pure half of the Blob panel: names and folders as people read them.
// The host (src/panels/blob.ts) and the webview share it. Object ids stay
// opaque everywhere else: only these helpers look inside one, to label it.
// No imports: `node --test` loads this file.

/** The API refuses smaller files. */
export const MIN_UPLOAD_BYTES = 512;
/** Above this, the SDK uploads in parts, and the panel shows progress. */
export const CHUNKED_BYTES = 90 * 1024 * 1024;

/** The expiry stamp the server puts before the extension (`a~e1767225600.png`). */
const EXPIRE_PART = /~e\d{8,10}(?=\.[A-Za-z0-9.]+$)/;

/** `pub/<owner>/docs/a~e1767225600.png` → `a.png`, as the site shows it. */
export function objectName(id: string): string {
  return id.slice(id.lastIndexOf("/") + 1).replace(EXPIRE_PART, "");
}

/** A subfolder (`docs/2026/`) of the open one (`docs/`) → `2026`. */
export const folderName = (folder: string, parent: string) =>
  (folder.startsWith(parent) ? folder.slice(parent.length) : folder).replace(
    /\/$/,
    "",
  );

/** `docs/2026/` → each step, root excluded, with the prefix that opens it. */
export function crumbs(prefix: string): { name: string; prefix: string }[] {
  const parts = prefix.split("/").filter(Boolean);
  return parts.map((name, i) => ({
    name,
    prefix: `${parts.slice(0, i + 1).join("/")}/`,
  }));
}

/** The folder as an upload takes it: `docs/2026`, or undefined at the root. */
export const uploadPrefix = (prefix: string) =>
  prefix.replace(/^\/+|\/+$/g, "") || undefined;

/**
 * A local file's name as an object name: no extension (the server keeps
 * the file's), only letters, numbers, `_ - .`, up to 128 (the site's rule).
 */
export function uploadName(fileName: string): string {
  const parts = fileName.split(".");
  // `data.tar.gz` is stored under `tar.gz`, as the server does.
  const compressed =
    parts.length > 2 && /^(gz|bz2|xz|zst|br|lz4)$/i.test(parts.at(-1) ?? "");
  const base = parts
    .slice(0, parts.length - (parts.length > 1 ? (compressed ? 2 : 1) : 0))
    .join(".");
  const cleaned = base
    .replace(/[^A-Za-z0-9_.-]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[^A-Za-z0-9_]+/, "")
    .replace(/-ex(\d+)$/, "_ex$1")
    .slice(0, 128);
  return cleaned || "file";
}
