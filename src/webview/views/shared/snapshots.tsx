import { useEffect, useRef, useState } from "preact/hooks";

import {
  Alert,
  Badge,
  Button,
  type Column,
  Dialog,
  EmptyState,
  IconButton,
  StatusDot,
  Table,
} from "../../components";
import { NAV_ICON } from "../../icons";
import { locale, t } from "../../l10n";
import { formatBytes, formatDateTime } from "../../lib/format";
import {
  isFinal,
  joinRestore,
  nextRestore,
  RESTORE_POLL_MS,
  type RestoreAnswer,
  type RestoreFollow,
  settleRestore,
  startRestore,
} from "../../lib/restore";
import { call, RpcError } from "../../rpc";
import { Failure, useRpc, useTask } from "./rpc";

// The Snapshots tab of the app panel, and of the database panel (E5): both
// hosts answer the `snapshots*` methods (src/panels/resource.ts). The
// restore is followed by the panel's root (`useRestore`), so the header can
// show it on every tab and switching tabs doesn't lose it.

/** A row of `snapshots` (`SnapshotRow` on the host). */
export type SnapshotRow = {
  name: string;
  size: number;
  modified: string;
  version_id: string;
  runtime?: string | null;
  origin?: "automatic" | "manual" | null;
};

export type RestoreTracker = {
  follow?: RestoreFollow & {
    /** The failure in words, from the host. */
    message?: string;
    /** A 409 RESTORE_IN_PROGRESS: following the run that was going. */
    joined?: boolean;
  };
  /** The restore request itself failed. */
  error?: unknown;
  start(row: SnapshotRow): Promise<void>;
  dismiss(): void;
};

/** The node's step names, as the site words them. */
const PHASE: Record<string, () => string> = {
  queued: () => t("panel.snapshots.phase.queued"),
  inspect: () => t("panel.snapshots.phase.inspect"),
  download: () => t("panel.snapshots.phase.download"),
  preflight: () => t("panel.snapshots.phase.preflight"),
  verify: () => t("panel.snapshots.phase.verify"),
  lock: () => t("panel.snapshots.phase.lock"),
  stop: () => t("panel.snapshots.phase.stop"),
  wipe: () => t("panel.snapshots.phase.wipe"),
  unzip: () => t("panel.snapshots.phase.unzip"),
  start: () => t("panel.snapshots.phase.start"),
  recovery: () => t("panel.snapshots.phase.recovery"),
  done: () => t("panel.snapshots.phase.done"),
  interrupted: () => t("panel.snapshots.phase.interrupted"),
};

export const phaseLabel = (step?: string) =>
  step && Object.hasOwn(PHASE, step) ? PHASE[step]?.() : undefined;

/**
 * Follows a restore through `snapshots.restoreState` every 5 seconds until
 * it ends. Joins one already running when `restoring` turns true (the
 * status says so), e.g. a restore started from the site.
 */
export function useRestore(restoring: boolean | undefined): RestoreTracker {
  const [follow, setFollow] = useState<RestoreTracker["follow"]>();
  const [error, setError] = useState<unknown>();
  const current = useRef(follow);
  current.current = follow;

  useEffect(() => {
    if (restoring && (!current.current || isFinal(current.current.phase)))
      setFollow(joinRestore());
  }, [restoring]);

  const active = Boolean(follow && !isFinal(follow.phase));
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const answer = await call<RestoreAnswer & { message?: string }>(
          "snapshots.restoreState",
        );
        if (stopped) return;
        setFollow(
          (f) =>
            f && { ...f, ...nextRestore(f, answer), message: answer.message },
        );
        timer = setTimeout(tick, RESTORE_POLL_MS);
      } catch {
        // A missed read (a rate limit, the network) waits longer, then asks again.
        if (!stopped) timer = setTimeout(tick, RESTORE_POLL_MS * 3);
      }
    };
    timer = setTimeout(tick, 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active]);

  return {
    follow,
    error,
    async start(row) {
      setError(undefined);
      setFollow(startRestore(Date.now()));
      try {
        const { pending } = await call<{ pending: boolean }>(
          "snapshots.restore",
          { name: row.name, version: row.version_id },
        );
        setFollow((f) => f && { ...f, ...settleRestore(f, pending) });
      } catch (failure) {
        const code = failure instanceof RpcError ? failure.code : "";
        // Another restore holds it: follow that one instead.
        if (code === "RESTORE_IN_PROGRESS")
          setFollow({ ...joinRestore(), joined: true });
        // The request gave up waiting; the restore goes on.
        else if (code === "TIMEOUT")
          setFollow((f) => f && { ...f, ...settleRestore(f, true) });
        else {
          setFollow(undefined);
          setError(failure);
        }
      }
    },
    dismiss() {
      setFollow(undefined);
      setError(undefined);
    },
  };
}

/**
 * The restore's step for the header, beside a status word that says
 * "Restoring snapshot" (empty, and hidden, otherwise).
 */
export function RestoreLine({ restore }: { restore: RestoreTracker }) {
  const follow = restore.follow;
  const phase =
    follow && !isFinal(follow.phase) ? phaseLabel(follow.step) : undefined;
  return (
    <span aria-live="polite" class="restore-line">
      {phase}
    </span>
  );
}

/** Where the restore stands, in the Snapshots tab. */
function RestoreStatus({
  restore,
  onOpenLogs,
}: {
  restore: RestoreTracker;
  onOpenLogs?: () => void;
}) {
  const { follow, error } = restore;
  if (error) return <Failure error={error} />;
  if (!follow) return null;
  const close = (
    <Button onClick={restore.dismiss} size="xs" variant="ghost">
      {t("panel.dismiss")}
    </Button>
  );
  if (follow.phase === "success")
    return (
      <Alert
        action={close}
        intent="success"
        title={t("panel.snapshots.restored")}
      >
        {t("panel.snapshots.restoredBody")}
      </Alert>
    );
  if (follow.phase === "error")
    return (
      <Alert action={close} intent="danger" title={t("panel.snapshots.failed")}>
        {follow.message ?? t("panel.snapshots.failedBody")}
      </Alert>
    );
  if (follow.phase === "unknown")
    return (
      <Alert
        action={
          <>
            {onOpenLogs ? (
              <Button onClick={onOpenLogs} size="xs" variant="secondary">
                {t("panel.snapshots.openLogs")}
              </Button>
            ) : null}
            {close}
          </>
        }
        intent="warning"
        title={t("panel.snapshots.unknown")}
      >
        {t("panel.snapshots.unknownBody")}
      </Alert>
    );
  const phase = phaseLabel(follow.step);
  return (
    <Alert intent="info" title={t("panel.snapshots.restoring")}>
      <div class="stack stack--tight">
        {follow.joined ? <p>{t("panel.snapshots.joined")}</p> : null}
        <StatusDot
          label={phase ?? t("panel.snapshots.phase.queued")}
          tone="amber"
        />
        <p class="muted">{t("panel.snapshots.restoringBody")}</p>
      </div>
    </Alert>
  );
}

export function SnapshotsPanel({
  name,
  restore,
  onOpenLogs,
}: {
  /** The app's or database's name, for the confirmation. */
  name: string;
  restore: RestoreTracker;
  onOpenLogs?: () => void;
}) {
  const lang = locale();
  const list = useRpc<SnapshotRow[]>("snapshots");
  const create = useTask();
  const download = useTask();
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState<string>();
  const [savedTo, setSavedTo] = useState<string>();
  const [confirm, setConfirm] = useState<SnapshotRow>();
  const restoring = Boolean(restore.follow && !isFinal(restore.follow.phase));
  const date = (row: SnapshotRow) =>
    formatDateTime(Date.parse(row.modified), lang);

  // A pending snapshot shows up in about 2 minutes: look again then.
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setPending(false);
      list.reload();
    }, 120_000);
    return () => clearTimeout(timer);
  }, [pending, list.reload]);

  const columns: Column<SnapshotRow>[] = [
    {
      key: "modified",
      label: t("panel.snapshots.date"),
      mono: true,
      render: date,
    },
    {
      key: "origin",
      label: t("panel.snapshots.origin"),
      render: (row) =>
        row.origin === "automatic" ? (
          <Badge size="sm">{t("panel.snapshots.automatic")}</Badge>
        ) : row.origin === "manual" ? (
          <Badge size="sm" tone="primary">
            {t("panel.snapshots.manual")}
          </Badge>
        ) : null,
    },
    {
      key: "size",
      label: t("panel.snapshots.size"),
      align: "end",
      mono: true,
      render: (row) => formatBytes(row.size, lang, 1),
    },
    {
      key: "version",
      label: t("panel.snapshots.version"),
      mono: true,
      render: (row) => (
        <span class="muted" title={row.version_id}>
          {row.version_id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "actions",
      label: <span class="visually-hidden">{t("panel.actions")}</span>,
      align: "end",
      width: "96px",
      render: (row) => (
        <span class="row row--end">
          <IconButton
            busy={download.busy && saving === row.version_id}
            disabled={download.busy}
            icon="download-simple"
            label={t("panel.snapshots.download")}
            onClick={() => {
              setSaving(row.version_id);
              setSavedTo(undefined);
              void download.run(async () => {
                const file = await call<string | null>("snapshots.download", {
                  name: row.name,
                  version: row.version_id,
                });
                if (file) setSavedTo(file);
              });
            }}
          />
          <IconButton
            disabled={restoring}
            icon={NAV_ICON.snapshots}
            label={t("panel.snapshots.restore")}
            onClick={() => setConfirm(row)}
          />
        </span>
      ),
    },
  ];

  return (
    <section class="stack">
      <header class="section-head">
        <p class="muted">{t("panel.snapshots.description")}</p>
        <div class="row">
          <IconButton
            busy={list.loading}
            icon="arrow-clockwise"
            label={t("command.refresh")}
            onClick={list.reload}
          />
          <Button
            busy={create.busy}
            icon="plus"
            onClick={() =>
              void create.run(async () => {
                const created = await call<{ pending: boolean }>(
                  "snapshots.create",
                );
                setPending(created.pending);
                if (!created.pending) list.reload();
              })
            }
            size="xs"
          >
            {t("panel.snapshots.create")}
          </Button>
        </div>
      </header>

      <RestoreStatus onOpenLogs={onOpenLogs} restore={restore} />
      {create.error ? <Failure error={create.error} /> : null}
      {pending ? (
        <Alert intent="info" title={t("panel.snapshots.pending")}>
          {t("panel.snapshots.pendingBody")}
        </Alert>
      ) : null}
      {download.error ? <Failure error={download.error} /> : null}
      {savedTo ? (
        <Alert intent="success" title={t("panel.snapshots.saved")}>
          <span class="mono">{savedTo}</span>
        </Alert>
      ) : null}

      {list.error && !list.data ? (
        <Failure error={list.error} onRetry={list.reload} />
      ) : list.data && !list.data.length ? (
        <EmptyState
          description={t("panel.snapshots.empty.body")}
          icon={NAV_ICON.snapshots}
          title={t("panel.snapshots.empty.title")}
        />
      ) : (
        <Table
          columns={columns}
          empty={t("generic.loading")}
          label={t("panel.snapshots.title")}
          rowKey={(row) => `${row.name}:${row.version_id}`}
          rows={list.data ?? []}
        />
      )}

      <Dialog
        cancelLabel={t("panel.cancel")}
        confirmLabel={t("panel.snapshots.restore")}
        danger
        description={
          confirm
            ? t("panel.snapshots.confirmBody", {
                NAME: name,
                DATE: date(confirm),
              })
            : undefined
        }
        onClose={() => setConfirm(undefined)}
        onConfirm={() => {
          const row = confirm;
          setConfirm(undefined);
          if (row) void restore.start(row);
        }}
        open={Boolean(confirm)}
        title={t("panel.snapshots.confirmTitle")}
      />
    </section>
  );
}
