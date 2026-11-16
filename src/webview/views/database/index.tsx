import { useCallback, useEffect, useState } from "preact/hooks";

import {
  Alert,
  IconButton,
  Menu,
  Skeleton,
  StatusDot,
  Tabs,
  type Tone,
} from "../../components";
import { Logo } from "../../components/icon";
import { NAV_ICON, type NavIconName } from "../../icons";
import { locale, t } from "../../l10n";
import { engineName } from "../../lib/database";
import { formatBytes } from "../../lib/format";
import { isFinal } from "../../lib/restore";
import {
  DATABASE_TABS,
  type DatabaseInfo,
  type DatabaseStatus,
  type DatabaseTab,
  type PanelInit,
} from "../../protocol";
import { call, onHostMessage, persist, RpcError } from "../../rpc";
import { MetricsPanel } from "../shared/metrics";
import { Failure, useRpc, useTask } from "../shared/rpc";
import { RestoreLine, SnapshotsPanel, useRestore } from "../shared/snapshots";
import { OverviewTab } from "./overview";
import { SettingsTab } from "./settings";

// The database panel: identity and start/stop on top, the sections as
// tabs, like the app panel. The host side is src/panels/database.ts.

type Action = "start" | "stop";

/** The status is read again this often while the panel is on screen. */
const STATUS_POLL_MS = 15_000;
const MB = 1024 * 1024;

const validTab = (tab: unknown): DatabaseTab =>
  DATABASE_TABS.includes(tab as DatabaseTab)
    ? (tab as DatabaseTab)
    : "overview";

const TABS: Record<DatabaseTab, { icon: NavIconName; label: () => string }> = {
  overview: {
    icon: NAV_ICON.databases,
    label: () => t("panel.tab.overview"),
  },
  metrics: { icon: NAV_ICON.metrics, label: () => t("panel.tab.metrics") },
  snapshots: {
    icon: NAV_ICON.snapshots,
    label: () => t("panel.tab.snapshots"),
  },
  settings: { icon: NAV_ICON.settings, label: () => t("panel.tab.settings") },
};

/**
 * A refused start or stop, said calmly: already so, a restore holding it,
 * or a node that didn't answer in time. Anything else is a Failure.
 */
const CALM: Record<string, { intent: "info" | "warning"; text: () => string }> =
  {
    CONTAINER_ALREADY_STARTED: {
      intent: "info",
      text: () => t("database.panel.alreadyStarted"),
    },
    CONTAINER_ALREADY_STOPPED: {
      intent: "info",
      text: () => t("database.panel.alreadyStopped"),
    },
    RESTORE_IN_PROGRESS: {
      intent: "info",
      text: () => t("database.panel.restoring"),
    },
    ACTION_FAILED: {
      intent: "warning",
      text: () => t("database.panel.actionFailed"),
    },
  };

/**
 * `status`, read now and every 15 s while the panel is visible: the host
 * sends `{visible}` as it changes (a hidden webview keeps running). Read
 * again as soon as it's back on screen.
 */
function useStatus() {
  const [status, setStatus] = useState<DatabaseStatus>();
  const [visible, setVisible] = useState(true);
  const read = useCallback(
    () =>
      call<DatabaseStatus>("status").then(setStatus, () => {
        // The last reading stays on screen; the next one tries again.
      }),
    [],
  );
  useEffect(
    () =>
      onHostMessage((message) => {
        const next = (message as { state?: { visible?: unknown } }).state
          ?.visible;
        if (message.type === "state" && typeof next === "boolean")
          setVisible(next);
      }),
    [],
  );
  useEffect(() => {
    if (!visible) return;
    void read();
    const timer = setInterval(() => void read(), STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [read, visible]);
  return { status, read };
}

export function DatabasePanel({ state }: { state: PanelInit | undefined }) {
  const [tab, setTabState] = useState<DatabaseTab>(validTab(state?.tab));
  const info = useRpc<DatabaseInfo>("info");
  const { status, read } = useStatus();
  const restore = useRestore(status?.restoring);
  const action = useTask();
  const [pending, setPending] = useState<Action>();
  const [copied, setCopied] = useState(false);

  const setTab = (next: DatabaseTab) => {
    setTabState(next);
    persist({ tab: next });
  };

  // `openResource("database", id, tab)` on an open panel sends the tab.
  useEffect(
    () =>
      onHostMessage((message) => {
        const next = (message as { state?: { tab?: unknown } }).state?.tab;
        if (message.type === "state" && typeof next === "string")
          setTabState(validTab(next));
      }),
    [],
  );

  if (info.error && !info.data)
    return (
      <main class="page">
        <Failure
          error={info.error}
          onRetry={info.reload}
          title={t("database.panel.loadError")}
        />
      </main>
    );
  if (!info.data) return <PanelSkeleton />;

  const db = info.data;
  const lang = locale();
  const running = status?.running;
  const restoring =
    Boolean(status?.restoring) ||
    Boolean(restore.follow && !isFinal(restore.follow.phase));
  const [tone, word]: readonly [Tone, string] = pending
    ? [
        "amber",
        pending === "start"
          ? t("dashboard.pending.start")
          : t("dashboard.pending.stop"),
      ]
    : restoring
      ? ["amber", t("panel.snapshots.restoring")]
      : running === true
        ? ["green", t("dashboard.online")]
        : running === false
          ? ["red", t("dashboard.offline")]
          : ["muted", t("dashboard.unknown")];
  const busy = Boolean(pending) || restoring;

  const act = (next: Action) => {
    setPending(next);
    void action
      .run(() => call("action", { action: next }))
      // Also after a refusal ("already running"): the screen was stale.
      .finally(() => read().finally(() => setPending(undefined)));
  };
  const copyId = () =>
    void call("copy", { text: db.id }).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  const calm =
    action.error instanceof RpcError && Object.hasOwn(CALM, action.error.code)
      ? CALM[action.error.code]
      : undefined;

  return (
    <main class="page">
      <header class="page__head">
        <div class="page__identity">
          <span class="page__logo">
            <Logo kind="database" size={24} value={db.type} />
          </span>
          <div class="page__names">
            <div class="row">
              <h1 class="page__title">{db.name}</h1>
              <StatusDot label={word} tone={tone} />
              <RestoreLine restore={restore} />
            </div>
            <p class="page__meta">
              <button
                class="page__id mono"
                onClick={copyId}
                title={t("command.copyId")}
                type="button"
              >
                {copied ? t("app.copied") : db.id}
              </button>
              <span>{engineName(db.type)}</span>
              <span class="mono">{formatBytes(db.ram * MB, lang, 1)}</span>
            </p>
          </div>
        </div>
        <div class="page__actions">
          <IconButton
            disabled={busy || running === true}
            icon="play"
            label={t("command.start")}
            onClick={() => act("start")}
          />
          <IconButton
            disabled={busy || running === false}
            icon="square"
            label={t("command.stop")}
            onClick={() => act("stop")}
          />
          <Menu
            items={[
              { label: t("command.copyId"), icon: "copy", onSelect: copyId },
              {
                label: t("command.refresh"),
                icon: "arrow-clockwise",
                onSelect: () => {
                  info.reload();
                  void read();
                },
              },
              "separator",
              {
                label: t("command.delete"),
                icon: "trash",
                danger: true,
                onSelect: () => setTab("settings"),
              },
            ]}
            label={t("dashboard.more")}
          />
        </div>
      </header>

      {action.error ? (
        calm ? (
          <Alert intent={calm.intent} title={calm.text()} />
        ) : (
          <Failure error={action.error} />
        )
      ) : null}

      <Tabs
        items={DATABASE_TABS.map((id) => ({
          id,
          icon: TABS[id].icon,
          label: TABS[id].label(),
        }))}
        label={t("panel.tabs")}
        onChange={(id) => setTab(validTab(id))}
        value={tab}
      />

      {tab === "overview" ? (
        <OverviewTab busy={busy} info={db} status={status} />
      ) : tab === "metrics" ? (
        <MetricsPanel week={db.week} />
      ) : tab === "snapshots" ? (
        <SnapshotsPanel name={db.name} restore={restore} />
      ) : (
        <SettingsTab info={db} onSaved={info.reload} />
      )}
    </main>
  );
}

function PanelSkeleton() {
  return (
    <main aria-busy="true" class="page">
      <header class="page__head">
        <div class="page__identity">
          <Skeleton height={40} width={40} />
          <div class="page__names">
            <Skeleton height={20} width={180} />
            <Skeleton height={14} width={320} />
          </div>
        </div>
      </header>
      <Skeleton height={40} />
      <div class="row row--fill">
        {[0, 1, 2, 3].map((col) => (
          <Skeleton col={col} height={104} key={col} />
        ))}
      </div>
    </main>
  );
}
