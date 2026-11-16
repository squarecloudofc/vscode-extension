import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { BlobObject, BlobPage, BlobStats, BlobUpload } from "../protocol";
import {
  Alert,
  Button,
  type Column,
  Dialog,
  EmptyState,
  IconButton,
  Select,
  Skeleton,
  Stat,
  StatGrid,
  Table,
  UsageBar,
} from "../components";
import { Icon } from "../components/icon";
import { NAV_ICON } from "../icons";
import { locale, t } from "../l10n";
import { CHUNKED_BYTES, crumbs, folderName } from "../lib/blob";
import {
  formatBytes,
  formatBytesParts,
  formatCount,
  formatDateTime,
  formatPercent,
} from "../lib/format";
import { call, needsReconnect, onHostMessage, RpcError } from "../rpc";
import { Canceled, Failure, useRpc, useTask } from "./shared/rpc";

// The Blob panel: the account's objects by folder, uploads (picker or drop),
// links, details and deletes. Credentials and temporary links stay on the
// host (src/panels/blob.ts); the webview names objects by their opaque id.

/** A folder entry or an object, as the table lists them. */
type Row =
  | { kind: "folder"; key: string; prefix: string; name: string }
  | ({ kind: "object"; key: string } & BlobObject);

type Listing = {
  prefix: string;
  objects: BlobObject[];
  folders: string[];
  cursor?: string;
  loading: boolean;
  error?: unknown;
};

type Info = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  createdAt: string;
  expiresAt: string | null;
  private: boolean;
  url: string | null;
  originalName: string | null;
};

/** Plan refusals: Blob needs a plan to write, and some keys can't read it. */
const NO_PLAN = new Set(["PERMISSION_DENIED", "UPGRADE_REQUIRED"]);

const VALIDITY = [
  { value: "3600", label: () => t("blob.panel.duration.1h") },
  { value: "21600", label: () => t("blob.panel.duration.6h") },
  { value: "43200", label: () => t("blob.panel.duration.12h") },
  { value: "86400", label: () => t("blob.panel.duration.24h") },
];

function useListing() {
  const [listing, setListing] = useState<Listing>({
    prefix: "",
    objects: [],
    folders: [],
    loading: true,
  });
  const latest = useRef(0);
  const load = useCallback((prefix: string, cursor?: string) => {
    const ticket = ++latest.current;
    setListing((l) =>
      cursor
        ? { ...l, loading: true, error: undefined }
        : { prefix, objects: [], folders: [], loading: true },
    );
    call<BlobPage>("list", { prefix, cursor }).then(
      (page) => {
        if (ticket !== latest.current) return;
        setListing((l) => ({
          prefix,
          objects: cursor ? [...l.objects, ...page.objects] : page.objects,
          folders: cursor
            ? [...new Set([...l.folders, ...page.folders])]
            : page.folders,
          cursor: page.cursor,
          loading: false,
        }));
      },
      (error: unknown) => {
        if (ticket === latest.current)
          setListing((l) => ({ ...l, loading: false, error }));
      },
    );
  }, []);
  useEffect(() => load(""), [load]);
  return { listing, load };
}

/** The `upload` events, newest last; cleared once all are settled. */
function useUploads() {
  const [uploads, setUploads] = useState<BlobUpload[]>([]);
  useEffect(
    () =>
      onHostMessage((message) => {
        if (message.type !== "event" || message.name !== "upload") return;
        const row = message.data as BlobUpload;
        setUploads((list) =>
          list.some((u) => u.key === row.key)
            ? list.map((u) => (u.key === row.key ? row : u))
            : [...list, row],
        );
      }),
    [],
  );
  return {
    uploads,
    clear: () =>
      setUploads((list) =>
        list.filter((u) => u.state === "queued" || u.state === "sending"),
      ),
  };
}

export function BlobPanel() {
  const lang = locale();
  const stats = useRpc<BlobStats>("stats");
  const { listing, load } = useListing();
  const { uploads, clear } = useUploads();
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [details, setDetails] = useState<BlobObject>();
  const [linking, setLinking] = useState<BlobObject>();
  const [removing, setRemoving] = useState<BlobObject>();
  const send = useTask();
  const remove = useTask();
  const copy = useTask();
  const [copied, setCopied] = useState<string>();
  const prefix = listing.prefix;
  // Without a plan, objects can be read and deleted, not uploaded or linked.
  const writable = stats.data?.plan !== false;

  const refresh = () => {
    stats.reload();
    load(prefix);
  };

  const settle = (result: { done: number; total: number }) => {
    if (!result.total) throw new Canceled();
    setNotice(
      t("blob.panel.uploaded", { COUNT: result.done, TOTAL: result.total }),
    );
    refresh();
  };
  const pick = () =>
    void send.run(async () => {
      setNotice(undefined);
      settle(
        await call("upload", { prefix, private: visibility === "private" }),
      );
    });

  const onDrop = (event: JSX.TargetedDragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const data = event.dataTransfer;
    if (!data || !writable) return;
    // VS Code's explorer gives URIs (any size, read from disk by the host);
    // the system gives files, sent as bytes up to the 90 MiB of one request.
    const uris = (
      data.getData("application/vnd.code.uri-list") ||
      data.getData("text/uri-list")
    )
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"));
    const files = uris.length ? [] : [...data.files];
    const big = files.filter((f) => f.size > CHUNKED_BYTES);
    void send.run(async () => {
      setNotice(
        big.length
          ? t("blob.panel.tooBigToDrop", {
              NAMES: big.map((f) => f.name).join(", "),
            })
          : undefined,
      );
      const sent = await Promise.all(
        files
          .filter((f) => f.size <= CHUNKED_BYTES)
          .map(async (f) => ({ name: f.name, bytes: await f.arrayBuffer() })),
      );
      if (!uris.length && !sent.length) throw new Canceled();
      settle(
        await call("upload.drop", {
          prefix,
          private: visibility === "private",
          uris,
          files: sent,
        }),
      );
    });
  };

  const copyLink = (object: BlobObject) =>
    object.url &&
    void copy.run(async () => {
      await call("copy", { text: object.url });
      setCopied(object.id);
      setTimeout(() => setCopied(undefined), 2000);
    });

  // Blob isn't open to this key or account: one calm screen, one way out.
  const refused = stats.data ? undefined : stats.error;
  if (refused && needsReconnect(refused))
    return (
      <Shell>
        <EmptyState
          action={
            <Button onClick={() => void call("reconnect")}>
              {t("panel.reconnect.action")}
            </Button>
          }
          description={t("panel.reconnect.body")}
          icon={NAV_ICON.blob}
          title={t("panel.reconnect.title")}
        />
      </Shell>
    );
  if (
    (refused instanceof RpcError && NO_PLAN.has(refused.code)) ||
    (stats.data && !stats.data.plan && !stats.data.objects)
  )
    return (
      <Shell>
        <EmptyState
          action={
            <Button onClick={() => void call("pricing")}>
              {t("problem.plan.action")}
            </Button>
          }
          description={t("blob.panel.notInPlanBody")}
          icon={NAV_ICON.blob}
          title={t("blob.panel.notInPlan")}
        />
      </Shell>
    );

  const rows: Row[] = [
    ...listing.folders.map(
      (folder): Row => ({
        kind: "folder",
        key: folder,
        prefix: folder,
        name: folderName(folder, prefix),
      }),
    ),
    ...listing.objects.map((o): Row => ({ kind: "object", key: o.id, ...o })),
  ];

  const columns: Column<Row>[] = [
    {
      key: "name",
      label: t("app.files.name"),
      render: (row) =>
        row.kind === "folder" ? (
          <button
            class="blob-name"
            onClick={() => load(row.prefix)}
            type="button"
          >
            <Icon class="blob-name__icon" name="folder" />
            {row.name}
          </button>
        ) : (
          <button
            class="blob-name"
            onClick={() => setDetails(row)}
            title={row.name}
            type="button"
          >
            <Icon class="blob-name__icon" name="file" />
            <span class="blob-name__text">{row.name}</span>
            {row.private ? (
              <Icon
                aria-label={t("blob.panel.private")}
                class="blob-name__lock"
                name="lock-simple"
                size={12}
              />
            ) : null}
          </button>
        ),
    },
    {
      key: "size",
      label: t("panel.snapshots.size"),
      align: "end",
      mono: true,
      width: "110px",
      render: (row) =>
        row.kind === "object" ? formatBytes(row.size, lang, 1) : "",
    },
    {
      key: "created",
      label: t("app.info.created"),
      mono: true,
      width: "180px",
      render: (row) =>
        row.kind === "object"
          ? formatDateTime(Date.parse(row.createdAt), lang)
          : "",
    },
    {
      key: "actions",
      label: <span class="visually-hidden">{t("panel.actions")}</span>,
      align: "end",
      width: "136px",
      render: (row) =>
        row.kind === "folder" ? null : (
          <span class="row row--end">
            {row.url ? (
              <IconButton
                icon={copied === row.id ? "check" : "link"}
                label={
                  copied === row.id ? t("app.copied") : t("blob.panel.copyLink")
                }
                onClick={() => copyLink(row)}
              />
            ) : null}
            {writable ? (
              <IconButton
                icon="clock-counter-clockwise"
                label={t("blob.panel.tempLink")}
                onClick={() => setLinking(row)}
              />
            ) : null}
            <IconButton
              icon="info"
              label={t("app.info.title")}
              onClick={() => setDetails(row)}
            />
            <IconButton
              icon="trash"
              label={t("command.delete")}
              onClick={() => setRemoving(row)}
            />
          </span>
        ),
    },
  ];

  return (
    <Shell
      actions={
        writable ? (
          <>
            <Select
              aria-label={t("blob.panel.visibility")}
              onChange={(event) =>
                setVisibility(event.currentTarget.value as "public" | "private")
              }
              options={[
                { value: "public", label: t("blob.panel.public") },
                { value: "private", label: t("blob.panel.private") },
              ]}
              value={visibility}
            />
            <Button
              busy={send.busy}
              icon="upload-simple"
              onClick={pick}
              size="xs"
            >
              {t("blob.panel.upload")}
            </Button>
          </>
        ) : undefined
      }
      onRefresh={refresh}
      refreshing={stats.loading || listing.loading}
    >
      <BlobStatsGrid lang={lang} stats={stats.data} />

      {stats.data && !stats.data.plan ? (
        <Alert
          action={
            <Button
              onClick={() => void call("pricing")}
              size="xs"
              variant="secondary"
            >
              {t("problem.plan.action")}
            </Button>
          }
          intent="info"
          title={t("blob.panel.noPlan")}
        >
          {t("blob.panel.noPlanBody")}
        </Alert>
      ) : null}
      {send.error ? <Failure error={send.error} /> : null}
      {notice ? <Alert intent="info" title={notice} /> : null}
      {copy.error ? <Failure error={copy.error} /> : null}
      <Uploads lang={lang} onClear={clear} uploads={uploads} />

      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target; the Upload button is the keyboard way */}
      <section
        class="blob-drop stack stack--tight"
        data-dragging={dragging ? "" : undefined}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDragOver={(event) => {
          if (!writable) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={onDrop}
      >
        <nav aria-label={t("blob.panel.folder")} class="crumbs">
          <button
            aria-current={prefix ? undefined : "page"}
            class="crumbs__item"
            onClick={() => load("")}
            type="button"
          >
            <Icon name={NAV_ICON.blob} size={14} />
            {t("blob.panel.all")}
          </button>
          {crumbs(prefix).map((crumb) => (
            <span class="crumbs__step" key={crumb.prefix}>
              <Icon name="caret-right" size={12} />
              <button
                aria-current={crumb.prefix === prefix ? "page" : undefined}
                class="crumbs__item mono"
                onClick={() => load(crumb.prefix)}
                type="button"
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        {listing.error && !rows.length ? (
          <Failure error={listing.error} onRetry={() => load(prefix)} />
        ) : !listing.loading && !rows.length ? (
          <EmptyState
            description={
              prefix
                ? t("blob.panel.emptyFolderBody")
                : t("blob.panel.emptyBody")
            }
            icon={NAV_ICON.blob}
            title={prefix ? t("blob.panel.emptyFolder") : t("blob.panel.empty")}
          />
        ) : (
          <Table
            columns={columns}
            empty={t("generic.loading")}
            label={t("blob.panel.files")}
            rowKey={(row) => row.key}
            rows={rows}
          />
        )}
        {listing.error && rows.length ? (
          <Failure error={listing.error} />
        ) : null}
        {listing.cursor ? (
          <div class="row">
            <Button
              busy={listing.loading}
              onClick={() => load(prefix, listing.cursor)}
              size="xs"
              variant="secondary"
            >
              {t("blob.panel.loadMore")}
            </Button>
          </div>
        ) : null}
        {dragging ? (
          <div class="blob-drop__hint" aria-hidden="true">
            <Icon name="upload-simple" size={20} />
            {t("blob.panel.drop", { FOLDER: prefix || "/" })}
          </div>
        ) : null}
      </section>

      <Drawer
        lang={lang}
        object={details}
        onClose={() => setDetails(undefined)}
      />
      <TempLink
        lang={lang}
        object={linking}
        onClose={() => setLinking(undefined)}
      />
      <Dialog
        busy={remove.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={t("command.delete")}
        danger
        description={t("blob.panel.deleteBody")}
        onClose={() => setRemoving(undefined)}
        onConfirm={() =>
          void remove.run(async () => {
            if (removing) await call("delete", { id: removing.id });
            setRemoving(undefined);
            refresh();
          })
        }
        open={Boolean(removing)}
        title={t("app.files.deleteTitle", { NAME: removing?.name ?? "" })}
      >
        {remove.error ? <Failure error={remove.error} /> : null}
      </Dialog>
    </Shell>
  );
}

/** The panel's frame: the title row and what's under it. */
function Shell({
  actions,
  onRefresh,
  refreshing,
  children,
}: {
  actions?: JSX.Element;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: JSX.Element | (JSX.Element | null)[] | null;
}) {
  return (
    <main class="page">
      <header class="page__head">
        <div class="page__identity">
          <span class="page__logo">
            <Icon name={NAV_ICON.blob} size={20} />
          </span>
          <div class="page__names">
            <h1 class="page__title">Blob</h1>
            <p class="page__meta">
              <span>{t("blob.panel.subtitle")}</span>
            </p>
          </div>
        </div>
        <div class="page__actions blob-actions">
          {actions}
          {onRefresh ? (
            <IconButton
              busy={refreshing}
              icon="arrow-clockwise"
              label={t("command.refresh")}
              onClick={onRefresh}
            />
          ) : null}
        </div>
      </header>
      {children}
    </main>
  );
}

function BlobStatsGrid({ stats, lang }: { stats?: BlobStats; lang: string }) {
  if (!stats)
    return (
      <div aria-busy="true" class="row row--fill">
        {[0, 1, 2].map((col) => (
          <Skeleton col={col} height={92} key={col} />
        ))}
      </div>
    );
  const used = formatBytesParts(stats.storage, lang, 1);
  const percent = stats.included ? (stats.storage / stats.included) * 100 : 0;
  return (
    <StatGrid columns={3}>
      <Stat
        hint={
          stats.included
            ? t("blob.panel.included", {
                PERCENT: formatPercent(percent, lang, 0),
                SIZE: formatBytes(stats.included, lang, 1),
              })
            : undefined
        }
        label={t("panel.metrics.storage")}
        unit={used.unit}
        value={used.value}
      >
        {stats.included ? <UsageBar percent={percent} /> : null}
      </Stat>
      <Stat
        label={t("blob.panel.files")}
        value={formatCount(stats.objects, lang)}
      />
      <Stat
        label={t("blob.panel.visibility")}
        value={
          <span class="blob-legend">
            <span>
              <Icon name="globe" size={14} /> {t("blob.panel.public")}
            </span>
            <span>
              <Icon name="lock-simple" size={14} /> {t("blob.panel.private")}
            </span>
          </span>
        }
      />
    </StatGrid>
  );
}

/** Each file of the last uploads: waiting, its progress, done or why not. */
function Uploads({
  uploads,
  lang,
  onClear,
}: {
  uploads: BlobUpload[];
  lang: string;
  onClear(): void;
}) {
  if (!uploads.length) return null;
  const settled = uploads.every(
    (u) => u.state === "done" || u.state === "error",
  );
  return (
    <section aria-label={t("blob.panel.uploads")} class="uploads">
      <header class="uploads__head">
        <h2 class="label">{t("blob.panel.uploads")}</h2>
        {settled ? (
          <Button onClick={onClear} size="xs" variant="ghost">
            {t("panel.dismiss")}
          </Button>
        ) : null}
      </header>
      <ul class="uploads__list">
        {uploads.map((u) => (
          <li class="uploads__row" data-state={u.state} key={u.key}>
            <Icon
              name={
                u.state === "done"
                  ? "check-circle"
                  : u.state === "error"
                    ? "warning-circle"
                    : "upload-simple"
              }
              size={14}
            />
            <span class="uploads__name" title={u.name}>
              {u.name}
            </span>
            {u.state === "sending" && u.total > CHUNKED_BYTES ? (
              <progress
                aria-label={u.name}
                class="uploads__bar"
                max={u.total}
                value={u.sent}
              />
            ) : null}
            <span class="uploads__meta mono">
              {u.state === "error"
                ? u.message
                : u.state === "queued"
                  ? t("blob.panel.waiting")
                  : u.state === "sending" && u.total > CHUNKED_BYTES
                    ? `${formatBytes(u.sent, lang, 1)} / ${formatBytes(u.total, lang, 1)}`
                    : formatBytes(u.total, lang, 1)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** An object's details, in a side sheet over the list. */
function Drawer({
  object,
  lang,
  onClose,
}: {
  object?: BlobObject;
  lang: string;
  onClose(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (object && dialog && !dialog.open) dialog.showModal();
    else if (!object && dialog?.open) dialog.close();
  }, [object]);
  return (
    <dialog
      aria-label={t("app.info.title")}
      class="drawer"
      onClose={onClose}
      ref={ref}
    >
      <header class="drawer__head">
        <h2 class="drawer__title" title={object?.name}>
          {object?.name}
        </h2>
        <IconButton icon="x" label={t("panel.dismiss")} onClick={onClose} />
      </header>
      {object ? <Details key={object.id} id={object.id} lang={lang} /> : null}
    </dialog>
  );
}

function Details({ id, lang }: { id: string; lang: string }) {
  const info = useRpc<Info>("info", { id }, id);
  const data = info.data;
  return info.error && !data ? (
    <Failure error={info.error} onRetry={info.reload} />
  ) : !data ? (
    <div class="stack stack--tight">
      <Skeleton height={14} />
      <Skeleton col={1} height={14} />
      <Skeleton col={2} height={14} />
    </div>
  ) : (
    <dl class="facts facts--drawer">
      <dt>{t("blob.panel.visibility")}</dt>
      <dd>{data.private ? t("blob.panel.private") : t("blob.panel.public")}</dd>
      <dt>{t("panel.snapshots.size")}</dt>
      <dd class="mono">{formatBytes(data.size, lang, 1)}</dd>
      <dt>{t("app.network.dns.type")}</dt>
      <dd class="mono facts__wrap">{data.contentType}</dd>
      <dt>{t("app.info.created")}</dt>
      <dd>{formatDateTime(Date.parse(data.createdAt), lang)}</dd>
      <dt>{t("blob.panel.expires")}</dt>
      <dd>
        {data.expiresAt
          ? formatDateTime(Date.parse(data.expiresAt), lang)
          : t("blob.panel.never")}
      </dd>
      {data.originalName ? (
        <>
          <dt>{t("blob.panel.originalName")}</dt>
          <dd class="facts__wrap">{data.originalName}</dd>
        </>
      ) : null}
      {data.url ? (
        <>
          <dt>{t("blob.panel.publicLink")}</dt>
          <dd class="mono facts__wrap">{data.url}</dd>
        </>
      ) : null}
    </dl>
  );
}

/** Makes a temporary link and copies it; says how long it lives and what ends it. */
function TempLink({
  object,
  lang,
  onClose,
}: {
  object?: BlobObject;
  lang: string;
  onClose(): void;
}) {
  const [validity, setValidity] = useState("3600");
  const [until, setUntil] = useState<string | null>();
  const task = useTask();
  useEffect(() => {
    setUntil(undefined);
    task.clear();
  }, [object, task.clear]);
  return (
    <Dialog
      busy={task.busy}
      cancelLabel={until === undefined ? t("panel.cancel") : t("panel.dismiss")}
      confirmLabel={t("blob.panel.tempLinkCreate")}
      description={t("blob.panel.tempLinkBody")}
      onClose={onClose}
      onConfirm={() =>
        object &&
        void task.run(async () =>
          setUntil(
            await call<string | null>("link.temporary", {
              id: object.id,
              expires: Number(validity),
            }),
          ),
        )
      }
      open={Boolean(object)}
      title={t("blob.panel.tempLink")}
    >
      <div class="stack stack--tight">
        <div class="field-label">
          {t("blob.panel.validity")}
          <Select
            aria-label={t("blob.panel.validity")}
            onChange={(event) => setValidity(event.currentTarget.value)}
            options={VALIDITY.map((v) => ({
              value: v.value,
              label: v.label(),
            }))}
            value={validity}
          />
        </div>
        {until !== undefined ? (
          <Alert
            intent="success"
            title={t("blob.panel.tempLinkCopied", {
              DATE: until ? formatDateTime(Date.parse(until), lang) : "—",
            })}
          />
        ) : null}
        {task.error ? <Failure error={task.error} /> : null}
      </div>
    </Dialog>
  );
}
