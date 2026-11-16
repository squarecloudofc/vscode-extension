import { useEffect, useState } from "preact/hooks";

import {
  Alert,
  Button,
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
import { formatBytes } from "../../lib/format";
import { isFinal } from "../../lib/restore";
import {
  APP_TABS,
  type AppInfo,
  type AppPanelState,
  type AppTab,
  NETWORK_SECTIONS,
  type NetworkSection,
} from "../../protocol";
import { call, onHostMessage, persist, RpcError } from "../../rpc";
import { MetricsPanel } from "../shared/metrics";
import { Failure, useRpc, useTask } from "../shared/rpc";
import { RestoreLine, SnapshotsPanel, useRestore } from "../shared/snapshots";
import { DeploysTab } from "./deploys";
import { FilesTab } from "./files";
import { LogsTab, useLogs } from "./logs";
import { NetworkTab } from "./network";
import { OverviewTab } from "./overview";
import { runtimeName } from "./runtime";
import { SettingsTab } from "./settings";
import { VariablesTab } from "./variables";

// The app panel (sketch in PLANO-ATUALIZACAO-2026-11.md §8): identity and
// lifecycle on top, the sections as tabs. The host side is src/panels/app.

type Action = "start" | "stop" | "restart";

/** `logs`, or `network.errors`: a tab and, for Network, its section. */
function parseTab(tab: unknown): [AppTab, NetworkSection | undefined] {
  const [head, sub] = typeof tab === "string" ? tab.split(".") : [];
  const valid = APP_TABS.includes(head as AppTab)
    ? (head as AppTab)
    : "overview";
  const section = NETWORK_SECTIONS.includes(sub as NetworkSection)
    ? (sub as NetworkSection)
    : undefined;
  return [valid, section];
}
const validTab = (tab: unknown) => parseTab(tab)[0];

const TABS: Record<AppTab, { icon: NavIconName; label: () => string }> = {
  overview: {
    icon: NAV_ICON.applications,
    label: () => t("panel.tab.overview"),
  },
  metrics: { icon: NAV_ICON.metrics, label: () => t("panel.tab.metrics") },
  logs: { icon: NAV_ICON.logs, label: () => t("panel.tab.logs") },
  deploys: { icon: NAV_ICON.deploys, label: () => t("panel.tab.deploys") },
  variables: { icon: NAV_ICON.env, label: () => t("panel.tab.variables") },
  files: { icon: NAV_ICON.files, label: () => t("panel.tab.files") },
  snapshots: {
    icon: NAV_ICON.snapshots,
    label: () => t("panel.tab.snapshots"),
  },
  network: { icon: NAV_ICON.network, label: () => t("panel.tab.network") },
  settings: { icon: NAV_ICON.settings, label: () => t("panel.tab.settings") },
};

const PENDING: Record<Action, () => string> = {
  start: () => t("dashboard.pending.start"),
  stop: () => t("dashboard.pending.stop"),
  restart: () => t("dashboard.pending.restart"),
};

/** A refused start or stop that only says it was already so. */
const INFORMATIONAL = new Set([
  "CONTAINER_ALREADY_STARTED",
  "CONTAINER_ALREADY_STOPPED",
]);

export function AppPanel({ state }: { state: AppPanelState | undefined }) {
  const [tab, setTabState] = useState<AppTab>(validTab(state?.tab));
  const [section, setSection] = useState<NetworkSection>(
    parseTab(state?.tab)[1] ?? "analytics",
  );
  const info = useRpc<AppInfo>("info");
  const logs = useLogs();
  const restore = useRestore(state?.live?.restoring);
  const action = useTask();
  const [pending, setPending] = useState<Action>();
  const [copied, setCopied] = useState(false);

  const setTab = (next: AppTab) => {
    setTabState(next);
    persist({ tab: next });
  };

  useEffect(() => {
    // `openResource(…, tab)` on an open panel: the host sends the tab.
    const off = onHostMessage((message) => {
      const next = (message as { state?: { tab?: unknown } }).state?.tab;
      if (message.type !== "state" || typeof next !== "string") return;
      const [tab, sub] = parseTab(next);
      setTabState(tab);
      if (sub) setSection(sub);
    });
    void call("live.start").catch(() => undefined);
    return off;
  }, []);

  if (info.error && !info.data)
    return (
      <main class="page">
        <Failure
          error={info.error}
          onRetry={info.reload}
          title={t("app.loadError")}
        />
      </main>
    );
  if (!info.data) return <PanelSkeleton />;

  const app = info.data;
  const lang = locale();
  const live = state?.live;
  const running = live?.running;
  const restoring =
    Boolean(live?.restoring) ||
    Boolean(restore.follow && !isFinal(restore.follow.phase));
  const [tone, word]: readonly [Tone, string] = pending
    ? ["amber", PENDING[pending]()]
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
      .finally(() => setPending(undefined));
  };
  const copyId = () =>
    void call("copy", { text: app.id }).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  const informational =
    action.error instanceof RpcError && INFORMATIONAL.has(action.error.code);

  return (
    <main class="page">
      <header class="page__head">
        <div class="page__identity">
          <span class="page__logo">
            <Logo kind="app" size={24} value={app.lang} />
          </span>
          <div class="page__names">
            <div class="row">
              <h1 class="page__title">{app.name}</h1>
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
                {copied ? t("app.copied") : app.id}
              </button>
              <span>{runtimeName(app.lang)}</span>
              <span class="mono">
                {formatBytes(app.ram * 1024 ** 2, lang, 1)}
              </span>
              {app.domain ? (
                <button
                  class="link-button page__domain"
                  onClick={() => void call("open", { target: "site" })}
                  type="button"
                >
                  {app.domain}
                </button>
              ) : null}
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
            icon="arrow-clockwise"
            label={t("command.restart")}
            onClick={() => act("restart")}
          />
          <IconButton
            disabled={busy || running === false}
            icon="square"
            label={t("command.stop")}
            onClick={() => act("stop")}
          />
          {app.domain ? (
            <Button
              icon="arrow-square-out"
              onClick={() => void call("open", { target: "site" })}
              size="xs"
              variant="secondary"
            >
              {t("app.open")}
            </Button>
          ) : null}
          <Menu
            items={[
              { label: t("command.copyId"), icon: "copy", onSelect: copyId },
              {
                label: t("command.open"),
                icon: "arrow-square-out",
                onSelect: () => void call("open", { target: "dashboard" }),
              },
              {
                label: t("command.refresh"),
                icon: "arrow-clockwise",
                onSelect: () => {
                  info.reload();
                  logs.history.reload();
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
        informational ? (
          <Alert intent="info" title={(action.error as Error).message} />
        ) : (
          <Failure error={action.error} />
        )
      ) : null}

      <Tabs
        items={APP_TABS.map((id) => ({
          id,
          icon: TABS[id].icon,
          label: TABS[id].label(),
        }))}
        label={t("panel.tabs")}
        onChange={(id) => setTab(validTab(id))}
        value={tab}
      />

      {tab === "overview" ? (
        <OverviewTab
          busy={busy}
          info={app}
          live={live}
          logs={logs}
          onOpenLogs={() => setTab("logs")}
          stream={state?.stream}
        />
      ) : tab === "metrics" ? (
        <MetricsPanel week={app.week} />
      ) : tab === "logs" ? (
        <LogsTab logs={logs} running={running} stream={state?.stream} />
      ) : tab === "deploys" ? (
        <DeploysTab />
      ) : tab === "variables" ? (
        <VariablesTab />
      ) : tab === "snapshots" ? (
        <SnapshotsPanel
          name={app.name}
          onOpenLogs={() => setTab("logs")}
          restore={restore}
        />
      ) : tab === "files" ? (
        <FilesTab />
      ) : tab === "network" ? (
        <NetworkTab
          info={app}
          onInfoChanged={info.reload}
          onOpenLogs={() => setTab("logs")}
          onSection={setSection}
          section={section}
        />
      ) : (
        <SettingsTab name={app.name} />
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
