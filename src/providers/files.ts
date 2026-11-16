import type { FileEntry, SquareCloudAPI } from "@squarecloud/api";
import {
  Disposable,
  EventEmitter,
  type FileChangeEvent,
  FileChangeType,
  type FileStat,
  FileSystemError,
  type FileSystemProvider,
  FileType,
  Uri,
} from "vscode";
import { t } from "vscode-ext-localisation";

import { describeError, isApiError } from "@/lib/utils/errors";
import { pacer } from "@/lib/utils/pace";
import {
  baseName,
  FILES_SCHEME,
  fsErrorKind,
  joinPath,
  MAX_FILE_BYTES,
  parentOf,
  pathProblem,
  sortEntries,
  splitUriPath,
} from "@/webview/lib/files";

/** A listing is reused this long: a tree expands and VS Code stats a lot. */
const LIST_TTL = 5_000;
/** The API takes 10 file writes per 5 s from a user: one every half second. */
const WRITE_GAP_MS = 500;
/** A burst refused anyway (KEEP_CALM) waits out the window, then goes on. */
const BUSY_WAIT_MS = 5_000;
/**
 * The API has no "create folder": like the site, a folder is a file
 * written inside it and deleted right after; the text is for the rare
 * case where the delete fails.
 */
const PLACEHOLDER = ".temp";
const PLACEHOLDER_TEXT = "You can delete this file.";

/** A limit checked here, before any request. */
class LocalLimit extends Error {}

function check(path: string): void {
  if (pathProblem(path) === "long")
    throw new LocalLimit(t("files.pathTooLong"));
}

/**
 * An app's files as a VS Code file system: `squarecloud://app/<appId>/<path>`
 * over `apps.files.*`. The Files tab calls the same instance's plain methods
 * (`list`, `write`, `move`…), which throw the API's errors so the tab can
 * offer "Reconnect"; the `FileSystemProvider` methods wrap them into
 * `FileSystemError`s for VS Code.
 */
export class AppFileSystem implements FileSystemProvider {
  private readonly changes = new EventEmitter<FileChangeEvent[]>();
  readonly onDidChangeFile = this.changes.event;
  private readonly listings = new Map<
    string,
    { at: number; entries: Promise<FileEntry[]> }
  >();
  /**
   * Every write, from an editor's save, a paste in the explorer or the
   * Files tab, goes through this one queue, so Save All or a pasted folder
   * stays under the write limit instead of failing half-way.
   */
  private readonly paced = pacer({
    gapMs: WRITE_GAP_MS,
    retryMs: BUSY_WAIT_MS,
    busy: (e) => isApiError(e) && e.code === "KEEP_CALM",
  });

  constructor(
    private readonly client: () => Promise<SquareCloudAPI | undefined>,
  ) {}

  static uri(appId: string, path = "/"): Uri {
    return Uri.from({
      scheme: FILES_SCHEME,
      authority: "app",
      path: `/${appId}${path}`,
    });
  }

  private async api(): Promise<SquareCloudAPI> {
    const api = await this.client();
    if (!api) throw FileSystemError.Unavailable(t("files.signIn"));
    return api;
  }

  /**
   * The key changed: no listing is reused, and the given files and folders
   * are read again (an open editor reloads with the new key).
   */
  reset(uris: readonly Uri[]): void {
    this.listings.clear();
    if (uris.length)
      this.changes.fire(
        uris.map((uri) => ({ type: FileChangeType.Changed, uri })),
      );
  }

  /** Forgets an app's listings (after a change, or to read them again). */
  forget(appId: string): void {
    for (const key of this.listings.keys())
      if (key.startsWith(`${appId}:`)) this.listings.delete(key);
  }

  private fire(appId: string, ...events: [FileChangeType, string][]): void {
    this.forget(appId);
    this.changes.fire(
      events.map(([type, path]) => ({
        type,
        uri: AppFileSystem.uri(appId, path),
      })),
    );
  }

  /** A folder's entries, folders first. A failure isn't kept. */
  list(appId: string, dir: string): Promise<FileEntry[]> {
    const key = `${appId}:${dir}`;
    const hit = this.listings.get(key);
    if (hit && Date.now() - hit.at < LIST_TTL) return hit.entries;
    check(dir);
    const entries = this.api()
      .then((api) => api.apps.files.list(appId, dir))
      .then(sortEntries);
    this.listings.set(key, { at: Date.now(), entries });
    entries.catch(() => {
      if (this.listings.get(key)?.entries === entries)
        this.listings.delete(key);
    });
    return entries;
  }

  /** The entry at `path`, from its folder's listing; undefined if absent. */
  async entry(appId: string, path: string): Promise<FileEntry | undefined> {
    if (path === "/") return { name: "", type: "directory" };
    const entries = await this.list(appId, parentOf(path));
    return entries.find((e) => e.name === baseName(path));
  }

  async read(appId: string, path: string): Promise<Uint8Array> {
    check(path);
    try {
      return await (await this.api()).apps.files.read(appId, path);
    } catch (error) {
      if (isApiError(error) && error.status === 413)
        throw new LocalLimit(t("files.tooLarge"));
      throw error;
    }
  }

  async write(
    appId: string,
    path: string,
    content: Uint8Array,
    created: boolean,
  ): Promise<void> {
    check(path);
    if (content.length > MAX_FILE_BYTES)
      throw new LocalLimit(t("files.tooLarge"));
    const api = await this.api();
    await this.paced(() => api.apps.files.write(appId, path, content));
    this.fire(appId, [
      created ? FileChangeType.Created : FileChangeType.Changed,
      path,
    ]);
  }

  async move(appId: string, from: string, to: string): Promise<void> {
    check(from);
    check(to);
    await (await this.api()).apps.files.move(appId, from, to);
    this.fire(
      appId,
      [FileChangeType.Deleted, from],
      [FileChangeType.Created, to],
    );
  }

  // ponytail: one DELETE, whatever the API does with a folder's contents
  // (VS Code always asks for recursive deletes of folders).
  async remove(appId: string, path: string): Promise<void> {
    check(path);
    await (await this.api()).apps.files.delete(appId, path);
    this.fire(appId, [FileChangeType.Deleted, path]);
  }

  async mkdir(appId: string, path: string): Promise<void> {
    const temp = joinPath(path, PLACEHOLDER);
    check(temp);
    const api = await this.api();
    await this.paced(() => api.apps.files.write(appId, temp, PLACEHOLDER_TEXT));
    await api.apps.files.delete(appId, temp);
    this.fire(appId, [FileChangeType.Created, path]);
  }

  // ---- FileSystemProvider ----

  /** Runs `work` on the URI's app and path; errors become FileSystemErrors. */
  private async guard<T>(
    uri: Uri,
    work: (appId: string, path: string) => Promise<T>,
  ): Promise<T> {
    const target = uri.authority === "app" ? splitUriPath(uri.path) : undefined;
    if (!target) throw FileSystemError.FileNotFound(uri);
    try {
      return await work(target.appId, target.path);
    } catch (error) {
      throw toFsError(error, uri);
    }
  }

  // ponytail: no remote watch. Changes made here fire at once; others show
  // once the 5-second listing cache runs out.
  watch(): Disposable {
    return new Disposable(() => undefined);
  }

  stat(uri: Uri): Promise<FileStat> {
    return this.guard(uri, async (appId, path) => {
      const entry = await this.entry(appId, path);
      if (!entry) throw FileSystemError.FileNotFound(uri);
      return {
        type: entry.type === "directory" ? FileType.Directory : FileType.File,
        ctime: 0,
        mtime: Math.floor(entry.lastModified ?? 0),
        size: entry.size ?? 0,
      };
    });
  }

  readDirectory(uri: Uri): Promise<[string, FileType][]> {
    return this.guard(uri, async (appId, path) =>
      (await this.list(appId, path)).map((e) => [
        e.name,
        e.type === "directory" ? FileType.Directory : FileType.File,
      ]),
    );
  }

  createDirectory(uri: Uri): Promise<void> {
    return this.guard(uri, async (appId, path) => {
      if (await this.entry(appId, path)) throw FileSystemError.FileExists(uri);
      await this.mkdir(appId, path);
    });
  }

  readFile(uri: Uri): Promise<Uint8Array> {
    return this.guard(uri, (appId, path) => this.read(appId, path));
  }

  writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean },
  ): Promise<void> {
    return this.guard(uri, async (appId, path) => {
      const entry = await this.entry(appId, path);
      if (entry?.type === "directory")
        throw FileSystemError.FileIsADirectory(uri);
      if (!entry && !options.create) throw FileSystemError.FileNotFound(uri);
      if (entry && options.create && !options.overwrite)
        throw FileSystemError.FileExists(uri);
      await this.write(appId, path, content, !entry);
    });
  }

  delete(uri: Uri): Promise<void> {
    return this.guard(uri, (appId, path) => this.remove(appId, path));
  }

  rename(
    oldUri: Uri,
    newUri: Uri,
    options: { overwrite: boolean },
  ): Promise<void> {
    return this.guard(oldUri, async (appId, from) => {
      const to =
        newUri.authority === "app" ? splitUriPath(newUri.path) : undefined;
      if (!to || to.appId !== appId)
        throw FileSystemError.NoPermissions(t("files.otherApp"));
      if (!options.overwrite && (await this.entry(appId, to.path)))
        throw FileSystemError.FileExists(newUri);
      await this.move(appId, from, to.path);
    });
  }
}

/**
 * 404 → FileNotFound; 401, 403 (BLOCKED_PATH, a role, a scope) and 413 →
 * NoPermissions; no answer, 429 and 5xx → Unavailable; each with the
 * API's error in words. A limit checked here is NoPermissions too.
 */
function toFsError(error: unknown, uri: Uri): Error {
  if (error instanceof FileSystemError) return error;
  if (error instanceof LocalLimit)
    return FileSystemError.NoPermissions(error.message);
  if (!isApiError(error))
    return FileSystemError.Unavailable(
      error instanceof Error ? error.message : uri,
    );
  const message = describeError(error);
  switch (fsErrorKind(error.status)) {
    case "FileNotFound":
      return FileSystemError.FileNotFound(uri);
    case "NoPermissions":
      return FileSystemError.NoPermissions(message);
    case "Unavailable":
      return FileSystemError.Unavailable(message);
    default:
      return new FileSystemError(message);
  }
}
