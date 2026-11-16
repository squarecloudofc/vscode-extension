import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { SidebarItem, SidebarState } from "../protocol";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconButton,
  Input,
  Menu,
  type MenuEntry,
  Skeleton,
  StatusDot,
  type Tone,
  UsageBar,
} from "../components";
import { Icon, Logo } from "../components/icon";
import { type IconName, NAV_ICON } from "../icons";
import { locale, t } from "../l10n";
import { formatBytes, formatBytesParts } from "../lib/format";
import { call, persist, persisted } from "../rpc";
import { SignIn } from "./sign-in";

// The sidebar: the index of the account. Each row opens its panel; the
// lifecycle actions sit on the row, the rest in its ⋯ menu. Every action is
// one of the extension's commands, run by name on the host (src/views/sidebar).

type Kind = "app" | "database";
type Action = "start" | "stop" | "restart";
type Account = NonNullable<SidebarState["account"]>;

/** Past ten rows a section pages instead of growing (kept from 5.x). */
const PAGE_SIZE = 10;

const LIFECYCLE: Record<Kind, Partial<Record<Action, string>>> = {
  app: { start: "startEntry", stop: "stopEntry", restart: "restartEntry" },
  database: { start: "startDatabase", stop: "stopDatabase" },
};

/** The site's plan colours: Hobby grey, Standard blue, Pro red, Enterprise purple. */
const PLAN_TONE: Record<string, "outline" | "primary" | "danger" | "purple"> = {
  hobby: "outline",
  standard: "primary",
  pro: "danger",
  enterprise: "purple",
};

const run = (command: string, id?: string) => call("run", { command, id });
/** "1.2 / 4 GB": the unit once when both share it, as on the site. */
function ramOf(used: number, limit: number): string {
  const [a, b] = [used, limit].map((mb) =>
    formatBytesParts(mb * 1024 ** 2, locale(), 1),
  );
  return !used || a.unit === b.unit
    ? `${used ? a.value : 0} / ${b.value} ${b.unit}`
    : `${a.value} ${a.unit} / ${b.value} ${b.unit}`;
}
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  });

export function Sidebar({ state }: { state: SidebarState | undefined }) {
  if (state?.signIn) return <SignIn state={state.signIn} />;
  if (state?.account) return <Overview account={state.account} state={state} />;
  if (!state?.problem) return <Loading />;
  return (
    <main class="side">
      <Problem problem={state.problem} />
      <Footer service={state.service} />
    </main>
  );
}

function Overview({
  state,
  account,
}: {
  state: SidebarState;
  account: Account;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const match = (item: SidebarItem) =>
    !q || item.name.toLowerCase().includes(q) || item.id.includes(q);
  const apps = state.apps.filter(match);
  const databases = state.databases.filter(match);
  const personal = state.workspace === null;
  const empty = !state.apps.length && !state.databases.length;

  return (
    <main class="side">
      {state.problem ? (
        <Stale at={state.updatedAt} kind={state.problem.kind} />
      ) : null}
      <AccountHeader account={account} />
      {state.mcpReconnect ? <McpHint /> : null}
      <div class="side__tools">
        <Workspaces state={state} />
        {empty ? null : (
          <Input
            aria-label={t("sidebar.filter")}
            icon="magnifying-glass"
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("sidebar.filter")}
            spellcheck={false}
            type="search"
            value={query}
          />
        )}
      </div>

      {empty ? (
        <Empty account={account} personal={personal} />
      ) : q && !apps.length && !databases.length ? (
        <p class="side__note">
          {t("sidebar.noMatch", { QUERY: query.trim() })}
        </p>
      ) : (
        <>
          {apps.length || !q ? (
            <Section
              icon={NAV_ICON.applications}
              items={apps}
              key={`apps:${q}`}
              kind="app"
              title={t("view.apps.title")}
            >
              <p class="side__note">
                {t("sidebar.noApps")}{" "}
                <button
                  class="link-button"
                  onClick={() => run("uploadApplication")}
                  type="button"
                >
                  {t("dashboard.empty.upload")}
                </button>
              </p>
            </Section>
          ) : null}
          {personal && (databases.length || !q) ? (
            <Section
              icon={NAV_ICON.databases}
              items={databases}
              key={`databases:${q}`}
              kind="database"
              title={t("view.databases.title")}
            >
              <p class="side__note">
                {t("dashboard.noDatabases")}{" "}
                <button
                  class="link-button"
                  onClick={() => run("createDatabase")}
                  type="button"
                >
                  {t("command.createDatabase")}
                </button>
              </p>
            </Section>
          ) : null}
        </>
      )}

      {personal && state.blob ? <Blob blob={state.blob} /> : null}
      <Footer service={state.service} />
    </main>
  );
}

function AccountHeader({ account }: { account: Account }) {
  const { ramUsed: used, ramLimit: limit } = account;
  return (
    <section class="side__account">
      <div class="side__who">
        <strong class="side__user" title={account.name}>
          {account.name}
        </strong>
        {account.plan ? (
          <Badge
            class="side__plan"
            size="sm"
            tone={PLAN_TONE[account.plan] ?? "outline"}
          >
            {account.plan}
          </Badge>
        ) : null}
      </div>
      <div class="side__ram">
        <span class="label">{t("dashboard.ramUsed")}</span>
        <span class="mono">
          {limit ? ramOf(used, limit) : t("dashboard.ramUnavailable")}
        </span>
      </div>
      {limit ? <UsageBar percent={(used / limit) * 100} /> : null}
    </section>
  );
}

/**
 * The key can't reach Square Cloud's tools in agent mode: one line that
 * says how to get them, until it's dismissed (remembered by this view).
 */
function McpHint() {
  const [hidden, setHidden] = useState(
    () => persisted<{ mcpHint?: boolean }>().mcpHint === false,
  );
  if (hidden) return null;
  return (
    <div class="side__hint">
      <Icon name="terminal-window" size={14} />
      <button
        class="link-button side__hint-text"
        onClick={() => run("setApiKey")}
        type="button"
      >
        {t("sidebar.mcp.action")}
      </button>
      <IconButton
        icon="x"
        label={t("panel.dismiss")}
        onClick={() => {
          persist({ mcpHint: false });
          setHidden(true);
        }}
      />
    </div>
  );
}

/** Personal, then each workspace; the choice filters the lists and persists. */
function Workspaces({ state }: { state: SidebarState }) {
  const selected = state.workspaces.find((w) => w.id === state.workspace);
  const pick = (id: string | null) => () => void call("workspace", { id });
  const items: MenuEntry[] = [
    {
      label: t("sidebar.workspace.personal"),
      icon: selected ? undefined : "check",
      onSelect: pick(null),
    },
    ...state.workspaces.map((workspace) => ({
      label: workspace.name,
      icon: workspace === selected ? ("check" as const) : undefined,
      onSelect: pick(workspace.id),
    })),
    "separator",
    ...(selected
      ? [
          {
            label: t("sidebar.workspace.open"),
            icon: "arrow-square-out" as const,
            onSelect: () =>
              void call("open", { kind: "workspace", id: selected.id }),
          },
        ]
      : []),
    {
      label: t("command.createWorkspace"),
      icon: "plus",
      onSelect: () => run("createWorkspace"),
    },
    {
      label: t("sidebar.workspace.invite"),
      icon: "copy",
      onSelect: () => run("generateInviteCode"),
    },
    ...(selected
      ? [
          selected.owner
            ? {
                label: t("command.deleteWorkspace"),
                icon: "trash" as const,
                danger: true,
                onSelect: () => run("deleteWorkspace", selected.id),
              }
            : {
                label: t("command.leaveWorkspace"),
                icon: "sign-out" as const,
                danger: true,
                onSelect: () => run("leaveWorkspace", selected.id),
              },
        ]
      : []),
  ];
  return (
    <Menu
      align="start"
      items={items}
      label={t("sidebar.workspace.label")}
      text={
        <>
          <Icon name={NAV_ICON.workspaces} />
          <span class="side__workspace">
            {selected?.name ?? t("sidebar.workspace.personal")}
          </span>
        </>
      }
    />
  );
}

function Section({
  kind,
  title,
  icon,
  items,
  children,
}: {
  kind: Kind;
  title: string;
  icon: IconName;
  items: SidebarItem[];
  /** What an empty section says instead. */
  children: ComponentChildren;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return (
    <section class="side__section">
      <h2 class="label side__heading">
        <Icon name={icon} size={14} />
        {title}
        <span class="side__count mono">{items.length}</span>
      </h2>
      {items.length ? (
        <ul class="side__list">
          {items
            .slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
            .map((item) => (
              <Row item={item} key={item.id} kind={kind} />
            ))}
        </ul>
      ) : (
        children
      )}
      {pages > 1 ? (
        <nav class="side__pager">
          <IconButton
            disabled={current === 0}
            icon="caret-left"
            label={t("dashboard.prevPage")}
            onClick={() => setPage(current - 1)}
          />
          <span class="mono" aria-live="polite">
            {t("dashboard.page", { PAGE: current + 1, PAGES: pages })}
          </span>
          <IconButton
            disabled={current >= pages - 1}
            icon="caret-right"
            label={t("dashboard.nextPage")}
            onClick={() => setPage(current + 1)}
          />
        </nav>
      ) : null}
    </section>
  );
}

function Row({ item, kind }: { item: SidebarItem; kind: Kind }) {
  // Clicked and not yet reflected by the status: amber, in words. It holds
  // until the status flips, or 3 s after the action answered (a restart
  // never flips; a refused start is reported by the host).
  const [pending, setPending] = useState<{ action: Action; from: string }>();
  useEffect(() => {
    if (pending && item.status !== pending.from) setPending(undefined);
  }, [item.status, pending]);

  const act = (action: Action) => () => {
    const command = LIFECYCLE[kind][action];
    if (!command) return;
    setPending({ action, from: item.status });
    void run(command, item.id).finally(() =>
      setTimeout(() => setPending(undefined), action === "restart" ? 0 : 3000),
    );
  };

  const [tone, label] = pending
    ? (["amber", PENDING[pending.action]()] as const)
    : STATUS[item.status]();
  const usage =
    !pending && item.status === "online" && item.cpu
      ? `${item.cpu} · ${shortRam(item.ram)}`
      : undefined;

  const quick: { action: Action; icon: IconName; label: string }[] =
    item.status === "online"
      ? [
          ...(kind === "app"
            ? [
                {
                  action: "restart" as const,
                  icon: "arrow-clockwise" as const,
                  label: t("command.restart"),
                },
              ]
            : []),
          { action: "stop", icon: "square", label: t("command.stop") },
        ]
      : item.status === "offline"
        ? [{ action: "start", icon: "play", label: t("command.start") }]
        : [
            { action: "start", icon: "play", label: t("command.start") },
            { action: "stop", icon: "square", label: t("command.stop") },
          ];

  return (
    <li class="side-row">
      <button
        class="side-row__open"
        onClick={() => call("open", { kind, id: item.id })}
        title={item.name}
        type="button"
      >
        <Logo kind={kind} value={item.type} />
        <span class="side-row__name">
          <span class="side-row__label">{item.name}</span>
          {item.favorite ? (
            <Icon class="side-row__star" fill name="star" size={12} />
          ) : null}
        </span>
        {/* Online with numbers: the dot and the usage say it. The word stays
            for screen readers, and comes back where the usage has no room. */}
        <StatusDot
          class="side-row__meta"
          label={
            usage ? (
              <>
                <span class="side-row__word">{label}</span>
                <span class="side-row__usage mono">{usage}</span>
              </>
            ) : (
              label
            )
          }
          tone={tone}
        />
      </button>
      <div class="side-row__actions">
        {quick.map((entry) => (
          <IconButton
            disabled={Boolean(pending)}
            icon={entry.icon}
            key={entry.action}
            label={entry.label}
            onClick={act(entry.action)}
          />
        ))}
        <Menu
          items={kind === "app" ? appMenu(item, act) : databaseMenu(item)}
          label={t("dashboard.more")}
        />
      </div>
    </li>
  );
}

/** "120.4MB" from the API as "120 MB" ("120 Mo" in fr): whole megabytes fit the row. */
const shortRam = (ram = "") =>
  ram.replace(/^([\d.]+)\s*MB$/i, (_, mb: string) =>
    formatBytes(Math.round(Number(mb)) * 1024 ** 2, locale(), 1),
  );

const STATUS: Record<SidebarItem["status"], () => readonly [Tone, string]> = {
  online: () => ["green", t("dashboard.online")],
  offline: () => ["red", t("dashboard.offline")],
  unknown: () => ["muted", t("serviceStatus.unknown")],
};

const PENDING: Record<Action, () => string> = {
  start: () => t("dashboard.pending.start"),
  stop: () => t("dashboard.pending.stop"),
  restart: () => t("dashboard.pending.restart"),
};

/**
 * What a row's ⋯ offers: the lifecycle, the panel's main tabs, and the few
 * account-side actions. Everything else lives in the panel.
 */
function appMenu(
  item: SidebarItem,
  act: (action: Action) => () => void,
): MenuEntry[] {
  const entry = (
    command: string,
    label: string,
    icon?: IconName,
    danger?: boolean,
  ): MenuEntry => ({
    label,
    icon,
    danger,
    onSelect: () => run(command, item.id),
  });
  const tab = (id: string, label: string, icon: IconName): MenuEntry => ({
    label,
    icon,
    onSelect: () => call("open", { kind: "app", id: item.id, tab: id }),
  });
  // As the row's own buttons: start what isn't running, restart and stop
  // what is; an unknown status gets start and stop.
  const lifecycle: MenuEntry[] = [];
  if (item.status !== "online")
    lifecycle.push({
      label: t("command.start"),
      icon: "play",
      onSelect: act("start"),
    });
  if (item.status === "online")
    lifecycle.push({
      label: t("command.restart"),
      icon: "arrow-clockwise",
      onSelect: act("restart"),
    });
  if (item.status !== "offline")
    lifecycle.push({
      label: t("command.stop"),
      icon: "square",
      onSelect: act("stop"),
    });
  return [
    ...lifecycle,
    "separator",
    tab("logs", t("panel.tab.logs"), NAV_ICON.logs),
    tab("metrics", t("panel.tab.metrics"), NAV_ICON.metrics),
    tab("variables", t("panel.tab.variables"), NAV_ICON.env),
    tab("snapshots", t("panel.tab.snapshots"), NAV_ICON.snapshots),
    tab("deploys", t("panel.tab.deploys"), NAV_ICON.deploys),
    tab("files", t("panel.tab.files"), NAV_ICON.files),
    ...(item.website
      ? [tab("network", t("panel.tab.network"), NAV_ICON.network)]
      : []),
    "separator",
    entry("copyIdEntry", t("command.copyId"), "copy"),
    item.favorite
      ? entry("unfavoriteEntry", t("command.unfavoriteEntry"), "star")
      : entry("favoriteEntry", t("command.favoriteEntry"), "star"),
    entry("openEntry", t("command.open"), "arrow-square-out"),
    "separator",
    entry("deleteEntry", t("command.delete"), "trash", true),
  ];
}

function databaseMenu(item: SidebarItem): MenuEntry[] {
  return [
    {
      label: t("panel.tab.metrics"),
      icon: NAV_ICON.metrics,
      onSelect: () => run("databaseMetrics", item.id),
    },
    {
      label: t("database.certDownload"),
      icon: "download-simple",
      onSelect: () => run("downloadDatabaseCertificate", item.id),
    },
    "separator",
    {
      label: t("database.delete"),
      icon: "trash",
      danger: true,
      onSelect: () => run("deleteDatabase", item.id),
    },
  ];
}

function Blob({ blob }: { blob: NonNullable<SidebarState["blob"]> }) {
  const objects = new Intl.NumberFormat(locale()).format(blob.objects);
  return (
    <section class="side__section">
      <h2 class="label side__heading">
        <Icon name={NAV_ICON.blob} size={14} />
        Blob
      </h2>
      {/* A row like the ones above: the count where the name goes, the size
          under the usage column. */}
      <ul class="side__list">
        <li class="side-row">
          <button
            class="side-row__open"
            onClick={() => call("open", { kind: "blob", id: "account" })}
            type="button"
          >
            <Icon name="folder" size={16} />
            <span class="side-row__name">
              <span class="side-row__label">
                {new Intl.PluralRules(locale()).select(blob.objects) === "one"
                  ? t("sidebar.blob.object", { COUNT: objects })
                  : t("sidebar.blob.objects", { COUNT: objects })}
              </span>
            </span>
            <span class="side-row__size mono">
              {formatBytes(blob.storage, locale(), 1)}
            </span>
          </button>
        </li>
      </ul>
    </section>
  );
}

/** Nothing to list yet: the one step that fixes it. */
function Empty({ account, personal }: { account: Account; personal: boolean }) {
  if (!personal)
    return (
      <EmptyState
        class="side__empty"
        description={t("sidebar.workspaceEmpty.body")}
        icon={NAV_ICON.workspaces}
        title={t("sidebar.workspaceEmpty.title")}
      />
    );
  if (!account.ramLimit)
    return (
      <EmptyState
        action={
          <Button onClick={() => call("link", { key: "pricing" })}>
            {t("problem.plan.action")}
          </Button>
        }
        class="side__empty"
        description={t("sidebar.plan.body")}
        icon={NAV_ICON.applications}
        title={t("dashboard.plan.title")}
      />
    );
  return (
    <EmptyState
      action={
        <div class="side__empty-actions">
          <Button icon="upload-simple" onClick={() => run("uploadApplication")}>
            {t("dashboard.empty.upload")}
          </Button>
          <button
            class="link-button"
            onClick={() => run("createDatabase")}
            type="button"
          >
            {t("command.createDatabase")}
          </button>
        </div>
      }
      class="side__empty"
      description={t("sidebar.empty.body")}
      icon={NAV_ICON.applications}
      title={t("sidebar.empty.title")}
    />
  );
}

/** Ticks once a second while `until` is ahead. */
function useCountdown(until: number | undefined): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until || until <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return until ? Math.max(0, until - now) : 0;
}

const PROBLEMS: Record<string, () => [string, string]> = {
  offline: () => [t("problem.offline.title"), t("problem.offline.body")],
  rateLimit: () => [t("problem.rateLimit.title"), t("problem.rateLimit.body")],
  outage: () => [t("problem.outage.title"), t("problem.outage.body")],
  session: () => [t("problem.session.title"), t("problem.session.body")],
  error: () => [t("problem.error.title"), t("problem.error.body")],
};

/** The account never loaded: why, and what happens next. Calm, no art. */
function Problem({
  problem,
}: {
  problem: NonNullable<SidebarState["problem"]>;
}) {
  const [title, body] = (PROBLEMS[problem.kind] ?? PROBLEMS.error)();
  const left = useCountdown(problem.retryAt);
  const seconds = Math.ceil(left / 1000);
  return (
    <EmptyState
      action={
        <div class="side__empty-actions">
          {problem.kind === "session" ? (
            <Button onClick={() => run("setApiKey")}>
              {t("command.setApiKey")}
            </Button>
          ) : (
            <Button onClick={() => call("refresh")} variant="secondary">
              {t("setApiKey.panel.retry")}
            </Button>
          )}
          <button
            class="link-button"
            onClick={() => run("showServiceStatus")}
            type="button"
          >
            {t("serviceStatus.title")}
          </button>
        </div>
      }
      class="side__empty"
      description={
        <>
          {body}
          {seconds > 0 ? (
            <span class="side__retry mono" role="timer">
              {t("problem.rateLimit.retryIn", {
                TIME: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
              })}
            </span>
          ) : null}
        </>
      }
      icon={problem.kind === "offline" ? "cell-tower" : "warning-circle"}
      title={title}
    />
  );
}

/** Loaded before, but the last refresh did not: what's on screen is old. */
function Stale({ at, kind }: { at?: number; kind: string }) {
  return (
    <Alert
      action={
        <button
          class="link-button"
          onClick={() => call("refresh")}
          type="button"
        >
          {t("setApiKey.panel.retry")}
        </button>
      }
      class="side__stale"
      intent={kind === "offline" ? "info" : "warning"}
    >
      {t("dashboard.stale", { TIME: at ? clock(at) : "—" })}
    </Alert>
  );
}

const SUMMARY: Record<string, () => [Tone, string]> = {
  online: () => ["green", t("serviceStatus.summary.online")],
  maintenance: () => ["amber", t("serviceStatus.summary.maintenance")],
  degraded: () => ["amber", t("serviceStatus.summary.degraded")],
  unknown: () => ["muted", t("serviceStatus.summary.unknown")],
};

const INCIDENT_STATUS: Record<string, () => string> = {
  maintenance: () => t("serviceStatus.maintenance"),
  degraded: () => t("serviceStatus.degraded"),
  outage: () => t("serviceStatus.outage"),
  operational: () => t("serviceStatus.online"),
  unknown: () => t("serviceStatus.unknown"),
};

/** The links at the foot of the dashboard's sidebar on the site. */
const FOOTER_LINKS: {
  key: "dashboard" | "docs" | "support";
  label: () => string;
}[] = [
  { key: "dashboard", label: () => t("sidebar.links.dashboard") },
  { key: "docs", label: () => t("sidebar.links.docs") },
  { key: "support", label: () => t("sidebar.links.support") },
];

/** The site's links, then the platform's status with what it lists as open. */
function Footer({ service }: { service: SidebarState["service"] }) {
  const [tone, label] = (
    SUMMARY[service?.summary ?? "unknown"] ?? SUMMARY.unknown
  )();
  return (
    <footer class="side__footer">
      <nav aria-label={t("sidebar.links.label")} class="side__links">
        {FOOTER_LINKS.map((link) => (
          <button
            class="side__link"
            key={link.key}
            onClick={() => call("link", { key: link.key })}
            type="button"
          >
            {link.label()}
          </button>
        ))}
      </nav>
      <button
        aria-label={`${label}. ${t("serviceStatus.openPage")}`}
        class="side__service"
        onClick={() => call("link", { key: "status" })}
        type="button"
      >
        <StatusDot label={label} pulse={false} tone={tone} />
        <Icon name="arrow-square-out" size={12} />
      </button>
      {service?.incidents.length ? (
        <ul class="side__incidents">
          {service.incidents.map((incident) => (
            <li key={incident.title}>
              <span class="side__incident">{incident.title}</span>
              <span class="muted">
                {(
                  INCIDENT_STATUS[incident.status] ?? (() => incident.status)
                )()}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </footer>
  );
}

/** The first paint: the account's shape, swept twice, then still. */
function Loading() {
  return (
    <main aria-busy="true" aria-label={t("generic.loading")} class="side">
      <div class="side__account">
        <Skeleton height={14} width="55%" />
        <Skeleton col={1} height={12} width="80%" />
        <Skeleton col={2} height={4} />
      </div>
      <div class="side__tools">
        <Skeleton height={28} width={120} />
        <Skeleton col={1} height={28} />
      </div>
      <div class="side__skeleton">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton col={i} height={18} key={i} />
        ))}
      </div>
    </main>
  );
}
