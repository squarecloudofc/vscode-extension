import type { VNode } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import {
  Alert,
  Button,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Skeleton,
} from "../../components";
import { Icon } from "../../components/icon";
import { NAV_ICON } from "../../icons";
import { locale, t } from "../../l10n";
import {
  baseName,
  childPath,
  joinPath,
  MAX_FILE_BYTES,
  MAX_PATH,
  parentOf,
} from "../../lib/files";
import { formatBytes, formatDateTime } from "../../lib/format";
import { call, RpcError } from "../../rpc";
import { Canceled, Failure, useTask } from "../shared/rpc";

// The Files tab: the app's tree, read a folder at a time as it opens. A
// file opens in a normal VS Code editor on its `squarecloud:` URI, so
// saving there writes it back (src/providers/files.ts).

/** `FileEntry` in the SDK. */
type Entry = {
  name: string;
  type: "file" | "directory";
  size?: number;
  lastModified?: number | null;
};

type Folder = { entries?: Entry[]; error?: unknown; loading: boolean };

type Editing =
  | { kind: "file" | "folder"; dir: string }
  | { kind: "rename"; path: string }
  | { kind: "delete"; path: string; folder: boolean };

/** Why a folder's listing failed, in a row's words. */
function folderError(error: unknown): string {
  if (error instanceof RpcError && error.code === "BLOCKED_PATH")
    return t("app.files.blocked");
  if (error instanceof RpcError && error.status === 404)
    return t("app.files.gone");
  return error instanceof Error ? error.message : t("panel.error.body");
}

const within = (path: string, dir: string) =>
  path === dir || path.startsWith(`${dir}/`);

export function FilesTab() {
  const lang = locale();
  const [folders, setFolders] = useState<Record<string, Folder>>({});
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<{ path: string; folder: boolean }>();
  const [editing, setEditing] = useState<Editing>();
  const [name, setName] = useState("");
  /** A file over 10 MB, which doesn't open here. */
  const [large, setLarge] = useState(false);
  const [done, setDone] = useState<string>();
  const edit = useTask();
  const action = useTask();

  const load = useCallback((path: string, fresh = false) => {
    setFolders((all) => ({
      ...all,
      [path]: { ...all[path], loading: true },
    }));
    call<Entry[]>("files.list", { path, fresh }).then(
      (entries) =>
        setFolders((all) => ({ ...all, [path]: { entries, loading: false } })),
      (error: unknown) =>
        setFolders((all) => ({
          ...all,
          [path]: { entries: all[path]?.entries, error, loading: false },
        })),
    );
  }, []);

  useEffect(() => load("/"), [load]);

  const refresh = () => {
    load("/", true);
    for (const path of open) load(path);
  };

  /** Where new files and uploads go: the selected folder, or a file's. */
  const cwd = selected
    ? selected.folder
      ? selected.path
      : parentOf(selected.path)
    : "/";

  const toggle = (path: string) => {
    setSelected({ path, folder: true });
    const next = new Set(open);
    if (next.delete(path)) return setOpen(next);
    next.add(path);
    setOpen(next);
    if (!folders[path]?.entries) load(path);
  };

  const openFile = (path: string, entry: Entry) => {
    setSelected({ path, folder: false });
    setDone(undefined);
    setLarge((entry.size ?? 0) > MAX_FILE_BYTES);
    if ((entry.size ?? 0) > MAX_FILE_BYTES) return;
    void action.run(() => call("files.open", { path }));
  };

  const startEdit = (next: Editing) => {
    edit.clear();
    setName(next.kind === "rename" ? baseName(next.path) : "");
    setEditing(next);
  };

  const upload = (dir: string) =>
    void action.run(async () => {
      setDone(undefined);
      const count = await call<number>("files.upload", { dir });
      if (!count) throw new Canceled();
      setDone(
        new Intl.PluralRules(lang).select(count) === "one"
          ? t("app.files.uploadedOne", { COUNT: count })
          : t("app.files.uploaded", { COUNT: count }),
      );
      if (dir !== "/" && !open.has(dir)) setOpen(new Set(open).add(dir));
      load(dir);
    });

  const download = (path: string) =>
    void action.run(async () => {
      setDone(undefined);
      if ((await call<string | null>("files.download", { path })) === null)
        throw new Canceled();
      setDone(t("app.logs.saved"));
    });

  // The dialog's target and whether what's typed makes one.
  const target =
    editing?.kind === "rename"
      ? name.includes("/")
        ? undefined
        : childPath(parentOf(editing.path), name)
      : editing && editing.kind !== "delete"
        ? childPath(editing.dir, name)
        : undefined;
  const nameError = !name.trim()
    ? undefined
    : !target
      ? t("app.files.invalidName")
      : target.length > MAX_PATH
        ? t("app.files.pathTooLong")
        : undefined;

  const confirm = () => {
    if (!editing) return;
    if (editing.kind === "delete") {
      const { path } = editing;
      return void edit.run(async () => {
        await call("files.delete", { path });
        setEditing(undefined);
        if (selected && within(selected.path, path)) setSelected(undefined);
        setOpen(new Set([...open].filter((p) => !within(p, path))));
        load(parentOf(path));
      });
    }
    if (!target || nameError) return;
    void edit.run(async () => {
      if (editing.kind === "rename") {
        await call("files.rename", { from: editing.path, to: target });
        if (selected && within(selected.path, editing.path))
          setSelected({ path: target, folder: selected.folder });
        load(parentOf(editing.path));
        if (parentOf(target) !== parentOf(editing.path)) load(parentOf(target));
      } else {
        await call("files.create", { path: target, kind: editing.kind });
        // `src/new.ts` also made `src`: show where it went.
        let dir = editing.dir;
        const shown = new Set(open);
        for (const part of target.slice(dir.length).split("/").slice(1, -1)) {
          dir = joinPath(dir, part);
          shown.add(dir);
        }
        setOpen(shown);
        for (const path of new Set([editing.dir, ...shown])) load(path);
        setSelected({ path: target, folder: editing.kind === "folder" });
      }
      setEditing(undefined);
    });
  };

  const rows = (path: string, depth: number): VNode[] => {
    const folder = folders[path];
    const pad = { paddingLeft: `${12 + depth * 20}px` };
    if (!folder?.entries && folder?.error)
      return [
        <li class="tree__note tree__note--error" key={`${path}:e`} style={pad}>
          <Icon name="warning-circle" size={14} />
          {folderError(folder.error)}
        </li>,
      ];
    if (!folder?.entries)
      return [
        <li class="tree__note" key={`${path}:l`} style={pad}>
          <Skeleton height={12} width={140} />
        </li>,
      ];
    if (!folder.entries.length)
      return [
        <li class="tree__note" key={`${path}:0`} style={pad}>
          {t("app.files.emptyFolder")}
        </li>,
      ];
    return folder.entries.flatMap((entry) => {
      const full = joinPath(path, entry.name);
      const isFolder = entry.type === "directory";
      const expanded = isFolder && open.has(full);
      const modified = entry.lastModified
        ? formatDateTime(entry.lastModified, lang)
        : undefined;
      const size =
        entry.size === undefined || isFolder
          ? undefined
          : formatBytes(entry.size, lang, 1);
      return [
        <li
          class="tree__row"
          data-selected={selected?.path === full ? "" : undefined}
          key={full}
        >
          <button
            aria-expanded={isFolder ? expanded : undefined}
            class="tree__item"
            data-path={full}
            onClick={() => (isFolder ? toggle(full) : openFile(full, entry))}
            style={pad}
            title={full}
            type="button"
          >
            {isFolder ? (
              <Icon
                class={
                  expanded ? "tree__caret tree__caret--open" : "tree__caret"
                }
                name="caret-right"
                size={12}
              />
            ) : (
              <span class="tree__caret" />
            )}
            <Icon
              class="tree__icon"
              name={isFolder ? (expanded ? "folder-open" : "folder") : "file"}
            />
            <span class="tree__name">{entry.name}</span>
            <span class="tree__meta mono">{size}</span>
            <span class="tree__meta tree__meta--date mono">{modified}</span>
          </button>
          <span class="tree__actions">
            {isFolder ? (
              <IconButton
                icon="upload-simple"
                label={t("app.files.uploadHere")}
                onClick={() => upload(full)}
              />
            ) : (
              <IconButton
                disabled={(entry.size ?? 0) > MAX_FILE_BYTES}
                icon="download-simple"
                label={t("app.logs.download")}
                onClick={() => download(full)}
              />
            )}
            <IconButton
              icon="pencil-simple"
              label={t("app.files.rename")}
              onClick={() => startEdit({ kind: "rename", path: full })}
            />
            <IconButton
              icon="trash"
              label={t("command.delete")}
              onClick={() =>
                startEdit({ kind: "delete", path: full, folder: isFolder })
              }
            />
          </span>
        </li>,
        ...(expanded ? rows(full, depth + 1) : []),
      ];
    });
  };

  const root = folders["/"];
  const editingName =
    editing?.kind === "rename" || editing?.kind === "delete"
      ? baseName(editing.path)
      : "";

  return (
    <section class="stack">
      <header class="section-head">
        <p class="muted">{t("app.files.description")}</p>
        <div class="row">
          <IconButton
            busy={Boolean(root?.loading)}
            icon="arrow-clockwise"
            label={t("command.refresh")}
            onClick={refresh}
          />
          <Button
            icon="folder-open"
            onClick={() => void action.run(() => call("files.openFolder"))}
            size="xs"
            variant="ghost"
          >
            {t("app.files.openFolder")}
          </Button>
          <Button
            icon="upload-simple"
            onClick={() => upload(cwd)}
            size="xs"
            variant="secondary"
          >
            {t("app.files.upload")}
          </Button>
          <Button
            icon="folder-plus"
            onClick={() => startEdit({ kind: "folder", dir: cwd })}
            size="xs"
            variant="secondary"
          >
            {t("app.files.newFolder")}
          </Button>
          <Button
            icon="file-plus"
            onClick={() => startEdit({ kind: "file", dir: cwd })}
            size="xs"
          >
            {t("app.files.newFile")}
          </Button>
        </div>
      </header>

      {large ? <Alert intent="info" title={t("app.files.tooLarge")} /> : null}
      {action.error ? <Failure error={action.error} /> : null}

      {root?.error && !root.entries ? (
        <Failure error={root.error} onRetry={() => load("/")} />
      ) : root?.entries && !root.entries.length ? (
        <EmptyState
          action={
            <Button
              icon="upload-simple"
              onClick={() => upload("/")}
              size="xs"
              variant="secondary"
            >
              {t("app.files.upload")}
            </Button>
          }
          description={t("app.files.empty.body")}
          icon={NAV_ICON.files}
          title={t("app.files.empty.title")}
        />
      ) : (
        <div class="tree-wrap">
          <div class="tree__bar">
            <span class="mono tree__cwd" title={cwd}>
              {t("app.files.target", { PATH: cwd })}
            </span>
            {done ? (
              <span class="muted" role="status">
                <Icon name="check" size={14} />
                {done}
              </span>
            ) : null}
          </div>
          <ul aria-label={t("panel.tab.files")} class="tree">
            {rows("/", 0)}
          </ul>
        </div>
      )}

      <Dialog
        busy={edit.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={
          editing?.kind === "delete"
            ? t("command.delete")
            : editing?.kind === "rename"
              ? t("app.files.rename")
              : editing?.kind === "folder"
                ? t("app.files.newFolderTitle")
                : t("app.files.newFileTitle")
        }
        danger={editing?.kind === "delete"}
        description={
          editing?.kind === "delete"
            ? editing.folder
              ? t("app.files.deleteFolder")
              : t("app.files.deleteFile")
            : editing?.kind === "rename"
              ? undefined
              : t("app.files.nameHint")
        }
        onClose={() => setEditing(undefined)}
        onConfirm={confirm}
        open={Boolean(editing)}
        title={
          editing?.kind === "delete"
            ? t("app.files.deleteTitle", { NAME: editingName })
            : editing?.kind === "rename"
              ? t("app.files.renameTitle", { NAME: editingName })
              : editing?.kind === "folder"
                ? t("app.files.newFolderTitle")
                : t("app.files.newFileTitle")
        }
      >
        <div class="stack stack--tight">
          {editing && editing.kind !== "delete" ? (
            <div class="field-label">
              {t("app.files.name")}
              <Input
                aria-label={t("app.files.name")}
                autoComplete="off"
                class="mono"
                invalid={Boolean(nameError)}
                onInput={(event) => setName(event.currentTarget.value)}
                placeholder={editing.kind === "folder" ? "assets" : "index.js"}
                spellcheck={false}
                value={name}
              />
              {editing.kind !== "rename" ? (
                <span class="muted mono">
                  {t("app.files.target", { PATH: editing.dir })}
                </span>
              ) : null}
            </div>
          ) : null}
          {nameError ? <p class="field-error">{nameError}</p> : null}
          {edit.error ? <Failure error={edit.error} /> : null}
        </div>
      </Dialog>
    </section>
  );
}
