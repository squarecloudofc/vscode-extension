import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { SquareCloudBlob, SquareCloudBlobError } from "@squarecloud/blob";
import { env, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type {
  BlobObject,
  BlobPage,
  BlobStats,
  BlobUpload,
} from "@/webview/protocol";
import { LINKS } from "@/lib/constants";
import { describeError } from "@/lib/utils/errors";
import { paced } from "@/lib/utils/pace";
import {
  CHUNKED_BYTES,
  MIN_UPLOAD_BYTES,
  objectName,
  uploadName,
  uploadPrefix,
} from "@/webview/lib/blob";
import { SIGNED_OUT } from "@/webview/protocol";

import type { Handlers, PanelContext } from "./panel-manager";

/** Simple uploads: 1 per second per account below Pro. */
const UPLOAD_GAP_MS = 1_100;
/** Storage refuses object calls in windows of about 10 s. */
const STORAGE_WAIT_MS = 10_000;
/** Progress goes to the webview at most this often per file. */
const PROGRESS_MS = 200;
/** A listing page: enough for a screen, light on the 30-per-30-s budget. */
const PAGE_SIZE = 200;
/** Names a drop's confirmation lists before "+N". */
const DROP_LIST_MAX = 15;

const field = (params: unknown, key: string): unknown =>
  typeof params === "object" && params !== null
    ? (params as Record<string, unknown>)[key]
    : undefined;

const objectId = (params: unknown): string => {
  const id = field(params, "id");
  if (typeof id !== "string" || !id) throw new Error(t("panel.error.body"));
  return id;
};

/** `docs/2026/`, or "" for the root; anything else is refused. */
const prefixOf = (params: unknown): string => {
  const value = field(params, "prefix");
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || value.includes(".."))
    throw new Error(t("panel.error.body"));
  return value.endsWith("/") ? value : `${value}/`;
};

/**
 * A file-backed Blob whose parts tell how much of them fetch has read: the
 * SDK slices it per part and fetch streams each slice. ponytail: read is
 * close to sent, not the server's receipt; a part sent again counts once.
 */
function tracked(blob: Blob, onSent: (bytes: number) => void): Blob {
  const read = new Map<number, number>();
  const report = () => onSent([...read.values()].reduce((a, b) => a + b, 0));
  const own = <T extends object>(target: T, key: PropertyKey) => {
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  };
  return new Proxy(blob, {
    get(target, key) {
      if (key !== "slice") return own(target, key);
      return (start = 0, end?: number) => {
        const part = target.slice(start, end);
        return new Proxy(part, {
          get(slice, prop) {
            if (prop !== "stream") return own(slice, prop);
            return () => {
              let bytes = 0;
              read.set(start, 0);
              return slice.stream().pipeThrough(
                new TransformStream<Uint8Array, Uint8Array>({
                  transform(chunk, controller) {
                    bytes += chunk.byteLength;
                    read.set(start, bytes);
                    report();
                    controller.enqueue(chunk);
                  },
                }),
              );
            };
          },
        });
      };
    },
  });
}

/** What a dropped file arrives as from the webview. */
const bytesOf = (value: unknown): Uint8Array | undefined =>
  value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : undefined;

type Source = { name: string; size: number; path?: string; bytes?: Uint8Array };

/**
 * A drop arrives from the webview, which could name any file on disk: the
 * user sees what will go up (full paths) and as what, and nothing goes
 * without their yes. A drop from outside the workspace is fine.
 */
async function confirmDrop(
  sources: Source[],
  prefix: string,
  isPrivate: boolean,
): Promise<boolean> {
  const names = sources
    .slice(0, DROP_LIST_MAX)
    .map((source) => source.path ?? source.name);
  if (sources.length > DROP_LIST_MAX)
    names.push(`+${sources.length - DROP_LIST_MAX}`);
  const visibility = isPrivate
    ? t("blob.panel.private")
    : t("blob.panel.public");
  const upload = { title: t("blob.panel.upload") };
  const choice = await window.showWarningMessage(
    t("blob.panel.dropConfirm", { FOLDER: prefix || "/" }),
    {
      modal: true,
      detail: [
        `${t("blob.panel.visibility")}: ${visibility}`,
        "",
        ...names,
      ].join("\n"),
    },
    upload,
  );
  return choice === upload;
}

/**
 * The Blob panel's host side, over `@squarecloud/blob` with the stored key
 * (never sent to the webview). A key from before 6.0 has no `blob:*`: its
 * calls fail as MISSING_SCOPE without asking, so the panel offers Reconnect.
 */
export function blobPanel({ extension, panel, emit }: PanelContext): Handlers {
  panel.title = "Blob";
  // Closed (a sign-out or another account): an upload under way stops.
  let closed = false;
  panel.onDidDispose(() => {
    closed = true;
  });

  const blob = async (write = false) => {
    const [key, account] = await Promise.all([
      extension.config.apiKey.get(),
      extension.config.apiKey.getAccount(),
    ]);
    // Quietly, like every panel call without a key (PanelContext.client).
    if (!key) throw new SquareCloudBlobError(401, SIGNED_OUT);
    const scope = write ? "blob:write" : "blob:read";
    if (account?.scopes && !account.scopes.includes(scope))
      throw new SquareCloudBlobError(403, "MISSING_SCOPE");
    return new SquareCloudBlob(key);
  };

  const hasPlan = () => {
    const { user } = extension.store.value;
    return user?.plan.name !== "free";
  };

  /** Sends each file in turn; one that fails doesn't stop the rest, a rate limit does. */
  const upload = async (
    sources: Source[],
    prefix: string,
    visibility: boolean,
  ): Promise<{ done: number; total: number }> => {
    const client = await blob(true);
    const stamp = Date.now();
    const rows: BlobUpload[] = sources.map((source, i) => ({
      key: `${stamp}-${i}`,
      name: source.name,
      sent: 0,
      total: source.size,
      state: "queued",
    }));
    const send = (row: BlobUpload) => emit("upload", row);
    for (const row of rows) send(row);

    let done = 0;
    const retried = new Set<string>();
    const result = await paced(
      sources.map((source, i) => ({ source, row: rows[i] })),
      async ({ source, row }) => {
        if (closed) throw new SquareCloudBlobError(401, SIGNED_OUT);
        row.state = "sending";
        send(row);
        try {
          if (source.size < MIN_UPLOAD_BYTES)
            throw new SquareCloudBlobError(400, "FILE_TOO_SMALL");
          let last = 0;
          const file =
            source.bytes ??
            (source.size > CHUNKED_BYTES && source.path
              ? tracked(await openAsBlob(source.path), (sent) => {
                  row.sent = sent;
                  if (Date.now() - last < PROGRESS_MS) return;
                  last = Date.now();
                  send(row);
                })
              : (source.path as string));
          await client.put(file, {
            name: uploadName(source.name),
            filename: source.name,
            prefix: uploadPrefix(prefix),
            private: visibility,
          });
          row.state = "done";
          row.sent = row.total;
          done++;
          send(row);
        } catch (error) {
          const code = error instanceof SquareCloudBlobError ? error.code : "";
          // Storage comes back in about 10 s: paced waits once and retries.
          if (code === "STORAGE_UNAVAILABLE" && !retried.has(row.key)) {
            retried.add(row.key);
            throw error;
          }
          row.state = "error";
          row.message = describeError(error);
          send(row);
          // A rate limit stops the rest; anything else is this file's alone.
          if (error instanceof SquareCloudBlobError && error.status === 429)
            throw error;
        }
      },
      {
        gapMs: UPLOAD_GAP_MS,
        retryMs: STORAGE_WAIT_MS,
        retries: 1,
        busy: (error) =>
          error instanceof SquareCloudBlobError &&
          error.code === "STORAGE_UNAVAILABLE",
      },
    );
    if (result.error)
      for (const row of rows.slice(result.done + 1)) {
        row.state = "error";
        row.message = describeError(result.error);
        send(row);
      }
    return { done, total: sources.length };
  };

  return {
    stats: async (): Promise<BlobStats> => {
      const stats = await (await blob()).stats();
      return {
        storage: stats.usage.storage,
        objects: stats.usage.objects,
        included: stats.plan.included,
        plan: hasPlan(),
      };
    },

    list: async (params): Promise<BlobPage> => {
      const cursor = field(params, "cursor");
      const prefix = prefixOf(params);
      const page = await (await blob()).listPage({
        prefix: prefix || undefined,
        delimiter: "/",
        limit: PAGE_SIZE,
        cursor: typeof cursor === "string" && cursor ? cursor : undefined,
      });
      return {
        objects: page.objects.map(
          (o): BlobObject => ({
            id: o.id,
            name: objectName(o.id),
            size: o.size,
            createdAt: o.created_at,
            expiresAt: o.expires_at,
            private: o.private,
            url: o.url,
          }),
        ),
        folders: page.folders ?? [],
        cursor: page.continuationToken,
      };
    },

    info: async (params) => {
      const info = await (await blob()).info(objectId(params));
      return {
        id: info.id,
        name: objectName(info.id),
        size: info.size,
        contentType: info.content_type,
        createdAt: info.created_at,
        expiresAt: info.expires_at,
        private: info.private,
        url: info.url,
        cacheControl: info.cache_control,
        originalName: info.original_name,
      };
    },

    delete: async (params) => (await blob(true)).delete(objectId(params)),

    /**
     * A temporary link (`expires` seconds, 1 hour to 24 hours), copied on
     * the host: it's a credential until it runs out. When it does.
     */
    "link.temporary": async (params) => {
      const seconds = Number(field(params, "expires"));
      const { url, expires_at } = await (await blob()).downloadUrl(
        objectId(params),
        {
          expires: Number.isInteger(seconds)
            ? Math.min(86_400, Math.max(3_600, seconds))
            : 3_600,
          // A public object gets its permanent URL without this.
          disposition: "attachment",
        },
      );
      await env.clipboard.writeText(url);
      return expires_at;
    },

    /** Files the user picks, into `prefix`; `private` sets their visibility. */
    upload: async (params) => {
      const picked =
        (await window.showOpenDialog({
          canSelectMany: true,
          openLabel: t("blob.panel.upload"),
        })) ?? [];
      if (!picked.length) return { done: 0, total: 0 };
      const sources = await Promise.all(
        picked.map(async (uri) => ({
          name: basename(uri.fsPath),
          path: uri.fsPath,
          size: (await stat(uri.fsPath)).size,
        })),
      );
      return upload(
        sources,
        prefixOf(params),
        field(params, "private") === true,
      );
    },

    /**
     * Files dropped on the panel: `uris` from VS Code's explorer (any size,
     * read from disk), `files` from the system (their bytes, up to 90 MiB).
     * Only after the user confirms them in a modal (confirmDrop).
     */
    "upload.drop": async (params) => {
      const uris = field(params, "uris");
      const files = field(params, "files");
      const sources: Source[] = [];
      for (const value of Array.isArray(uris) ? uris : []) {
        if (typeof value !== "string") continue;
        const uri = Uri.parse(value, true);
        if (uri.scheme !== "file") continue;
        const info = await stat(uri.fsPath).catch(() => undefined);
        if (info?.isFile())
          sources.push({
            name: basename(uri.fsPath),
            path: uri.fsPath,
            size: info.size,
          });
      }
      for (const value of Array.isArray(files) ? files : []) {
        const name = field(value, "name");
        const bytes = bytesOf(field(value, "bytes"));
        if (typeof name === "string" && bytes && bytes.length <= CHUNKED_BYTES)
          sources.push({ name: basename(name), size: bytes.length, bytes });
      }
      if (!sources.length) return { done: 0, total: 0 };
      const prefix = prefixOf(params);
      const isPrivate = field(params, "private") === true;
      if (!(await confirmDrop(sources, prefix, isPrivate)))
        return { done: 0, total: 0 };
      return upload(sources, prefix, isPrivate);
    },

    copy: async (params) => {
      const text = field(params, "text");
      if (typeof text === "string") await env.clipboard.writeText(text);
    },

    pricing: async () => {
      await env.openExternal(Uri.parse(LINKS.pricing));
    },

    reconnect: () => extension.views.sidebar.signIn(),
  };
}

/** Every string the Blob panel's webview reads. */
export const BLOB_STRINGS = [
  "app.copied",
  "app.files.deleteTitle",
  "app.files.name",
  "app.info.created",
  "app.info.title",
  "app.network.dns.type",
  "blob.panel.all",
  "blob.panel.copyLink",
  "blob.panel.deleteBody",
  "blob.panel.drop",
  "blob.panel.duration.12h",
  "blob.panel.duration.1h",
  "blob.panel.duration.24h",
  "blob.panel.duration.6h",
  "blob.panel.empty",
  "blob.panel.emptyBody",
  "blob.panel.emptyFolder",
  "blob.panel.emptyFolderBody",
  "blob.panel.expires",
  "blob.panel.files",
  "blob.panel.folder",
  "blob.panel.included",
  "blob.panel.loadMore",
  "blob.panel.never",
  "blob.panel.noPlan",
  "blob.panel.noPlanBody",
  "blob.panel.notInPlan",
  "blob.panel.notInPlanBody",
  "blob.panel.originalName",
  "blob.panel.private",
  "blob.panel.public",
  "blob.panel.publicLink",
  "blob.panel.subtitle",
  "blob.panel.tempLink",
  "blob.panel.tempLinkBody",
  "blob.panel.tempLinkCopied",
  "blob.panel.tempLinkCreate",
  "blob.panel.tooBigToDrop",
  "blob.panel.upload",
  "blob.panel.uploaded",
  "blob.panel.uploads",
  "blob.panel.validity",
  "blob.panel.visibility",
  "blob.panel.waiting",
  "command.delete",
  "command.refresh",
  "command.setApiKey",
  "generic.loading",
  "panel.actions",
  "panel.cancel",
  "panel.dismiss",
  "panel.error.body",
  "panel.metrics.storage",
  "panel.reconnect.action",
  "panel.reconnect.body",
  "panel.reconnect.title",
  "panel.retry",
  "sidebar.signIn.title",
  "panel.snapshots.size",
  "problem.plan.action",
  "problem.rateLimit.title",
];
