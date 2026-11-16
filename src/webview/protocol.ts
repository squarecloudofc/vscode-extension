// The messages between the extension host and the webview bundle. Shared by
// both sides (types only, plus one guard the host runs on everything the
// webview sends). Plain TypeScript with no imports: `node --test` loads it.

/** Each screen the bundle can draw. Panels are named after their resource. */
export type ViewName =
  | "sidebar"
  | "app"
  | "database"
  | "workspace"
  | "blob"
  | "gallery";

/** A resource that opens in its own editor panel. */
export type ResourceKind = "app" | "database" | "workspace" | "blob";

export const RESOURCE_KINDS: readonly ResourceKind[] = [
  "app",
  "database",
  "workspace",
  "blob",
];

/**
 * The code of a panel call made without a stored key: it fails quietly and
 * the panel offers "Connect account" (never opened from a poll).
 */
export const SIGNED_OUT = "SIGNED_OUT";

/** Why a host handler failed. `status` is the HTTP status, 0 without one. */
export type RpcErrorBody = { status: number; code: string; message: string };

/**
 * Host → webview. `state` is merged shallowly into a panel's state, so a
 * panel can be sent a single field (`{tab: "logs"}`) as well as all of it;
 * the sidebar's replaces the old one whole. `event` is for what must not be
 * merged away, such as each batch of live log lines.
 */
export type HostMessage =
  | { type: "state"; view: ViewName; state: unknown }
  | { type: "event"; view: ViewName; name: string; data: unknown }
  | { type: "rpc-result"; id: number; result?: unknown; error?: RpcErrorBody };

/** Webview → host. `ready` once the view has mounted and listens. */
export type ViewMessage =
  | { type: "ready" }
  | { type: "rpc"; id: number; method: string; params: unknown };

/**
 * A panel's initial state: which resource it shows and on which tab. The
 * webview persists it (`vscode.setState`), which is what the panel
 * serializer gets back after a reload.
 */
export type PanelInit = { id: string; tab?: string };

/** What the shell embeds in `<script id="sq-boot">` for `main.tsx`. */
export type Boot = {
  view: ViewName;
  l10n: Record<string, string>;
  initial: unknown;
  /** Webview URL of `resources/brand` (runtime and database logos). */
  brand?: string;
};

/**
 * The platform's health in one word (src/lib/utils/service-status.ts). It
 * shows in three looks: online, a warning (maintenance or degraded), or
 * unknown ("couldn't check"), never an error look.
 */
export type ServiceSummary = "online" | "maintenance" | "degraded" | "unknown";

/** The sign-in screen. Titles and bodies arrive already localised. */
export type SignInState = {
  step: "choose" | "starting" | "waiting" | "error";
  /** The 8-character code, while waiting. */
  code?: string;
  /** Unix ms at which the code stops working. */
  expiresAt?: number;
  /** Something the wait recovers from (key limit, rate limit). */
  warning?: { title: string; body: string; keyLimit: boolean };
  error?: { title: string; body: string };
  /** A calm line on the first step, e.g. after a cancel. */
  notice?: string;
  /** A key is stored: offer the way back instead of a dead end. */
  reconnecting: boolean;
};

/** One row of the sidebar: an application or a database. */
export type SidebarItem = {
  /** What actions and panels take; `<appId>-<workspaceId>` for a shared app. */
  id: string;
  name: string;
  /** The app's `lang` or the database's engine, for its logo. */
  type: string;
  status: "online" | "offline" | "unknown";
  cpu?: string;
  ram?: string;
  favorite?: boolean;
  /** Serves a domain, so the edge actions apply. */
  website?: boolean;
};

/** The sidebar view, sent whole on every change. */
export type SidebarState = {
  /** Present while signed out or reconnecting: the sign-in screen shows. */
  signIn?: SignInState;
  account?: {
    name: string;
    /** Plan tier (`hobby`, `standard`, `pro`, `enterprise`); null without one. */
    plan: string | null;
    /** MB. */
    ramUsed: number;
    ramLimit: number;
  };
  workspaces: { id: string; name: string; owner: boolean }[];
  /** The workspace on screen; null is Personal. */
  workspace: string | null;
  apps: SidebarItem[];
  databases: SidebarItem[];
  /** Bytes and objects; null when the key or the plan has no Blob. */
  blob: { storage: number; objects: number } | null;
  /**
   * The key can't reach Square Cloud's tools in agent mode (MCP): one
   * connected before 6.0, or pasted. Only with a plan, which MCP needs.
   */
  mcpReconnect?: boolean;
  service?: {
    summary: ServiceSummary;
    /** Open maintenances and incidents, as titled on the status page. */
    incidents: { title: string; status: string }[];
  };
  /** Why the last refresh failed (ProblemKind), and when it retries. */
  problem?: { kind: string; at: number; retryAt?: number };
  /** Unix ms of the last refresh that worked. */
  updatedAt?: number;
};

/**
 * The sidebar's RPC methods (`call(name, params)`), handled by
 * src/views/sidebar. `run` takes an allow-listed command name.
 */
export type SidebarMethod =
  | "signIn.connect"
  | "signIn.paste"
  | "signIn.cancel"
  | "signIn.copy"
  | "signIn.open"
  | "signIn.security"
  | "refresh"
  | "open"
  | "run"
  | "workspace"
  | "link";

/**
 * An app panel's tabs; `openResource("app", id, tab)` takes one of these,
 * or `network.<section>` for a Network section (NETWORK_SECTIONS).
 */
export const APP_TABS = [
  "overview",
  "metrics",
  "logs",
  "deploys",
  "variables",
  "files",
  "snapshots",
  "network",
  "settings",
] as const;
export type AppTab = (typeof APP_TABS)[number];

export const NETWORK_SECTIONS = [
  "analytics",
  "domains",
  "logs",
  "errors",
  "performance",
] as const;
export type NetworkSection = (typeof NETWORK_SECTIONS)[number];

/** The app as the panel's header and details show it (`info`). */
export type AppInfo = {
  id: string;
  name: string;
  desc?: string;
  /** The runtime, for its logo. */
  lang: string;
  /** MB. */
  ram: number;
  /** As the API names it. */
  cluster: string;
  /** The custom domain, else the default one; null for an app without. */
  domain: string | null;
  /** The default `<subdomain>.squareweb.app` host; null for a non-web app. */
  subdomain: string | null;
  custom: string | null;
  createdAt: string;
  /**
   * The 7-day metrics: open, or closed by the owner's plan (Pro and
   * Enterprise have them) or by the app's memory (from 512 MB).
   */
  week: "on" | "plan" | "small";
};

/** Live readings, from realtime status frames or `apps.status`. */
export type AppLive = {
  running?: boolean;
  /** A snapshot restore is queued or running. */
  restoring?: boolean;
  /** % of the plan's CPU. */
  cpu?: number;
  /** MB. */
  ramUsed?: number;
  ramLimit?: number;
  /** Bytes per second. */
  netIn?: number;
  netOut?: number;
  /** Bytes; null without a reading. */
  storage?: number | null;
  /** Unix ms of the last start. */
  uptime?: number | null;
  /** When this was read. */
  at?: number;
};

/** The realtime stream: delivering, opening, or off (`code` says why). */
export type StreamState = {
  state: "live" | "connecting" | "off";
  code?: string;
};

/** What the host sends an app panel, merged into its PanelInit. */
export type AppPanelState = PanelInit & {
  live?: AppLive;
  stream?: StreamState;
};

/** A live log line; `at` is when it arrived (Unix ms). */
export type LogLine = { text: string; stderr?: boolean; at: number };

/**
 * The `event` named `logs`. `replay`: the first batch of a connection,
 * which starts with recent lines the panel may already have.
 */
export type LogBatch = { lines: LogLine[]; replay: boolean };

/**
 * The app panel's RPC methods (src/panels/app). The `metrics` and
 * `snapshots*` ones come from src/panels/resource.ts, which the database
 * panel shares.
 */
export type AppMethod =
  | "info"
  | "live.start"
  | "action"
  | "open"
  | "copy"
  | "reconnect"
  | "logs"
  | "logs.save"
  | "metrics"
  | "snapshots"
  | "snapshots.create"
  | "snapshots.download"
  | "snapshots.restore"
  | "snapshots.restoreState"
  | "envs"
  | "envs.reveal"
  | "envs.copy"
  | "envs.set"
  | "envs.delete"
  | "envs.import"
  | "deploys"
  | "deploys.link"
  | "deploys.unlink"
  | "deploys.webhook"
  | "commit"
  | "delete"
  | "files.list"
  | "files.open"
  | "files.create"
  | "files.rename"
  | "files.delete"
  | "files.download"
  | "files.upload"
  | "files.openFolder"
  | "network.analytics"
  | "network.errors"
  | "network.logs"
  | "network.performance"
  | "network.dns"
  | "network.domain"
  | "network.purge";

/** A database panel's tabs (`openResource("database", id, tab)`). */
export const DATABASE_TABS = [
  "overview",
  "metrics",
  "snapshots",
  "settings",
] as const;
export type DatabaseTab = (typeof DATABASE_TABS)[number];

/**
 * The database as its panel shows it (`info`). No password: the API gives
 * it only when it's made or reset, and the host keeps a fresh one until
 * the user reveals or copies it.
 */
export type DatabaseInfo = {
  id: string;
  name: string;
  /** The engine (`postgres`, `mongo`…), for its logo and name. */
  type: string;
  /** MB. */
  ram: number;
  port: number;
  cluster: string;
  createdAt: string;
  host: string;
  user: string;
  /** The connection URL with `<password>` where the password goes. */
  url: string;
  /** 7-day metrics: open, or closed by the plan (Pro and Enterprise). */
  week: "on" | "plan";
  /** MB: the engine's least, and the most the plan leaves for it (null: unknown). */
  ramMin: number;
  ramMax: number | null;
};

/** `status`: a database's readings (`databases.status` with raw numbers). */
export type DatabaseStatus = {
  running: boolean;
  restoring?: boolean;
  /** %. */
  cpu: number;
  /** MB. */
  ram: number;
  /** Bytes. */
  storage: number;
  /** Bytes per second, in and out. */
  network: [number, number];
  /** Unix ms of the last start; null when stopped. */
  uptime: number | null;
};

/** A workspace panel's tabs. */
export const WORKSPACE_TABS = ["members", "applications", "settings"] as const;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

/** What a member can do, from most to least (`owner` is never assigned). */
export const WORKSPACE_GROUPS = [
  "admin",
  "maintain",
  "manager",
  "view",
] as const;
export type WorkspaceGroup = (typeof WORKSPACE_GROUPS)[number];

/** The workspace as its panel shows it (`info`). */
export type WorkspaceInfo = {
  id: string;
  name: string;
  createdAt: string;
  /** You own it: you manage its members and can delete it. */
  owner: boolean;
  /** Your account's ID, to mark your own row. */
  you: string | null;
  members: {
    id: string;
    /** null for a deleted account. */
    name: string | null;
    group: WorkspaceGroup | "owner";
    joinedAt: string;
  }[];
  apps: {
    id: string;
    name: string;
    lang: string;
    /** MB. */
    ram: number;
    /** One of yours: you can take it out. */
    mine: boolean;
  }[];
  /** Your apps not in it yet, to add. */
  yours: { id: string; name: string; lang: string }[];
};

/** Blob's account numbers (`stats`). Bytes. */
export type BlobStats = {
  storage: number;
  objects: number;
  /** Storage the plan includes. */
  included: number;
  /** The account has an active plan: uploads and temporary links need one. */
  plan: boolean;
};

/** One object in a folder. `id` is opaque: the host gets it back as-is. */
export type BlobObject = {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  expiresAt?: string;
  private: boolean;
  /** The public URL; null for a private object. */
  url: string | null;
};

/** One page of a folder (`list`): its subfolders as full prefixes (`docs/2026/`). */
export type BlobPage = {
  objects: BlobObject[];
  folders: string[];
  /** The next page's cursor; absent on the last. */
  cursor?: string;
};

/** The `event` named `upload`: one file's progress, by its upload's key. */
export type BlobUpload = {
  key: string;
  name: string;
  /** Bytes. */
  sent: number;
  total: number;
  state: "queued" | "sending" | "done" | "error";
  /** Why it failed, in words. */
  message?: string;
};

/** The webview is untrusted input: anything else is dropped by the host. */
export function isViewMessage(value: unknown): value is ViewMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  if (message.type === "ready") return true;
  return (
    message.type === "rpc" &&
    Number.isInteger(message.id) &&
    typeof message.method === "string"
  );
}

export function isPanelInit(value: unknown): value is PanelInit {
  if (typeof value !== "object" || value === null) return false;
  const init = value as Record<string, unknown>;
  return (
    typeof init.id === "string" &&
    init.id.length > 0 &&
    (init.tab === undefined || typeof init.tab === "string")
  );
}
