import { randomBytes } from "node:crypto";
import { t } from "vscode-ext-localisation";

import emptyApps from "../../../resources/illustrations/empty-apps.svg";
import emptyDatabases from "../../../resources/illustrations/empty-databases.svg";
import emptyWorkspaces from "../../../resources/illustrations/empty-workspaces.svg";
import error from "../../../resources/illustrations/error.svg";
import offline from "../../../resources/illustrations/offline.svg";
import outage from "../../../resources/illustrations/outage.svg";
import plan from "../../../resources/illustrations/plan.svg";
import rateLimit from "../../../resources/illustrations/rate-limit.svg";
import session from "../../../resources/illustrations/session.svg";
import {
  escapeHtml,
  illustration,
  squareLogo,
  squareStyles,
  warningIcon,
} from "../shared";

/**
 * Shell for the signed-in sidebar. The host posts a snapshot of the store and
 * the script below renders it — no server-side templating, so a status tick
 * repaints a couple of nodes instead of the whole document.
 */
export function renderDashboard(locale: string): string {
  const nonce = randomBytes(16).toString("base64");

  // Every picture the view can show, cloned by name from a <template>.
  const art = {
    empty: illustration(emptyApps, "empty", t("dashboard.empty.alt")),
    plan: illustration(plan, "plan", t("illustration.plan")),
    databases: illustration(
      emptyDatabases,
      "databases",
      t("illustration.emptyDatabases"),
    ),
    workspaces: illustration(
      emptyWorkspaces,
      "workspaces",
      t("illustration.emptyWorkspaces"),
    ),
    offline: illustration(offline, "offline", t("illustration.offline")),
    rateLimit: illustration(
      rateLimit,
      "rateLimit",
      t("illustration.rateLimit"),
    ),
    outage: illustration(outage, "outage", t("illustration.outage")),
    session: illustration(session, "session", t("illustration.session")),
    error: illustration(error, "error", t("illustration.error")),
  };

  const strings = {
    apps: t("view.apps.title"),
    databases: t("view.databases.title"),
    workspaces: t("view.workspaces.title"),
    noApps: t("apps.noApps.message"),
    emptyBody: t("dashboard.empty.body"),
    planTitle: t("dashboard.plan.title"),
    planBody: t("dashboard.plan.body"),
    pricing: t("apps.noApps.upgrade"),
    noDatabases: t("dashboard.noDatabases"),
    noWorkspaces: t("dashboard.noWorkspaces"),
    createDatabase: t("command.createDatabase"),
    createWorkspace: t("command.createWorkspace"),
    // Kinds without their own words (plan, notFound, ...) read as `error`.
    problem: {
      offline: [t("problem.offline.title"), t("problem.offline.body")],
      rateLimit: [t("problem.rateLimit.title"), t("problem.rateLimit.body")],
      outage: [t("problem.outage.title"), t("problem.outage.body")],
      session: [t("problem.session.title"), t("problem.session.body")],
      error: [t("problem.error.title"), t("problem.error.body")],
    },
    retryIn: t("problem.rateLimit.retryIn"),
    tryAgain: t("setApiKey.panel.retry"),
    connect: t("command.setApiKey"),
    serviceStatus: t("serviceStatus.title"),
    statusPage: t("serviceStatus.openPage"),
    stale: t("dashboard.stale"),
    uploadFirst: t("dashboard.empty.upload"),
    tour: t("dashboard.tour"),
    loading: t("generic.loading"),
    online: t("dashboard.online"),
    offline: t("dashboard.offline"),
    unknown: t("dashboard.unknown"),
    pending: {
      start: t("dashboard.pending.start"),
      stop: t("dashboard.pending.stop"),
      restart: t("dashboard.pending.restart"),
    },
    start: t("command.start"),
    stop: t("command.stop"),
    restart: t("command.restart"),
    logs: t("command.logsEntry"),
    more: t("dashboard.more"),
    ram: t("dashboard.ramUsed"),
    ramUnavailable: t("dashboard.ramUnavailable"),
    favorite: t("command.favorite"),
    unfavorite: t("command.unfavorite"),
    filter: t("dashboard.filter"),
    noMatch: t("dashboard.noMatch"),
    page: t("dashboard.page"),
    prevPage: t("dashboard.prevPage"),
    nextPage: t("dashboard.nextPage"),
    helpLabel: t("dashboard.help.label"),
    help: {
      account: t("dashboard.help.account"),
      apps: t("dashboard.help.apps"),
      databases: t("dashboard.help.databases"),
      workspaces: t("dashboard.help.workspaces"),
    },
    metricsHelp: t("dashboard.help.metrics"),
    fields: {
      id: [t("dashboard.field.id"), t("dashboard.fieldHelp.id")],
      ram: [t("dashboard.field.ram"), t("dashboard.fieldHelp.ram")],
      runtime: [t("dashboard.field.runtime"), t("dashboard.fieldHelp.runtime")],
      cluster: [t("dashboard.field.cluster"), t("dashboard.fieldHelp.cluster")],
      domain: [t("dashboard.field.domain"), t("dashboard.fieldHelp.domain")],
      uptime: [t("dashboard.field.uptime"), t("dashboard.fieldHelp.uptime")],
    },
  };

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>${squareStyles}${styles()}</style>
</head>
<body>
<div id="root" class="enter"></div>
${Object.entries(art)
  .map(([name, svg]) => `<template id="art-${name}">${svg}</template>`)
  .join("")}
<template id="logo">${squareLogo}</template>
<template id="warning-icon">${warningIcon}</template>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const S = ${JSON.stringify(strings)};
/**
 * Times arrive as timestamps and are formatted here: the extension host can
 * run on a remote machine (SSH, WSL, a container) in another timezone.
 */
const LANG = document.documentElement.lang || undefined;
const root = document.getElementById("root");

/** Ids of rows the user opened. Kept across repaints so a poll doesn't collapse them. */
const opened = new Set();
/** Ids already on screen. Only what's genuinely new animates in. */
const seen = new Set();
/** Start/stop/restart clicked here and not yet reflected by the status. */
const pending = new Map();
/** Last values painted, so a change can be shown as a change. */
const last = new Map();
let justOpened = null;
let meterShare = null;
/** Runs after the next reconcile, when new nodes are in the document. */
const mounted = [];
let snapshot = { apps: [], databases: [], workspaces: [], loading: true };

/**
 * Past one page the apps list pages instead of growing: some accounts have a
 * thousand apps, and nobody scrolls a thousand cards. The filter is how you
 * get to one of them; the pages are for browsing.
 */
const PAGE_SIZE = 10;
let page = 0;
let pageCount = 1;
let query = "";

const send = (type, payload) => vscode.postMessage({ type, ...payload });

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Rebuilds a node only when what it shows changed. Untouched nodes stay in the
 * document, so their animations (a pulsing dot, the shimmer) keep running
 * instead of restarting on every status poll.
 */
const cache = new Map();
function memo(key, deps, build) {
  const sig = JSON.stringify(deps);
  const hit = cache.get(key);
  if (hit && hit.sig === sig) return hit.node;
  const node = build();
  cache.set(key, { sig, node });
  // A rebuilt card must not drop the keyboard: once it is in the document,
  // focus goes to the same control on the new one, or to its first control.
  const focused = document.activeElement;
  if (hit?.node.contains(focused) && focused.dataset.focus) {
    mounted.push(() => {
      if (focused.isConnected) return;
      (node.querySelector('[data-focus="' + focused.dataset.focus + '"]') ?? node.querySelector("[data-focus]"))?.focus();
    });
  }
  return node;
}

/**
 * Makes parent's children exactly nodes. What leaves goes first, so what stays
 * is never moved: moving a node takes the keyboard focus out of it.
 */
function reconcile(parent, nodes) {
  const keep = new Set(nodes);
  for (const child of [...parent.children]) if (!keep.has(child)) child.remove();
  nodes.forEach((node, index) => {
    const current = parent.children[index];
    if (current !== node) parent.insertBefore(node, current ?? null);
  });
}

function icon(path) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute("d", path);
  svg.appendChild(shape);
  return svg;
}

const ICONS = {
  start: "M4.5 3.2v9.6l7.5-4.8z",
  stop: "M4.2 4.2h7.6v7.6H4.2z",
  restart: "M8 3.2a4.8 4.8 0 1 0 4.6 6.1h-1.6A3.3 3.3 0 1 1 8 4.7v2.1l3-2.8-3-2.8z",
  logs: "M3 3h10v1.6H3zm0 3.6h10v1.6H3zm0 3.6h6.5v1.6H3z",
  more: "M4 8a1.3 1.3 0 1 1-2.6 0A1.3 1.3 0 0 1 4 8zm5.3 0a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0zm5.3 0a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0z",
  star: "M8 1.9l1.85 3.75 4.15.6-3 2.93.71 4.12L8 11.35l-3.71 1.95.71-4.12-3-2.93 4.15-.6zm0 2.26L6.8 6.58l-2.68.39 1.94 1.89-.46 2.67L8 10.27l2.4 1.26-.46-2.67 1.94-1.89-2.68-.39z",
  starFilled: "M8 1.9l1.85 3.75 4.15.6-3 2.93.71 4.12L8 11.35l-3.71 1.95.71-4.12-3-2.93 4.15-.6z",
  upload: "M8 2.5l3.8 3.8-1.1 1.1-1.9-1.9V11H7.2V5.5L5.3 7.4 4.2 6.3zM3 12.2h10v1.6H3z",
  cpu: "M5.5 1.5h1.2v1.7h2.6V1.5h1.2v1.7H12a.8.8 0 0 1 .8.8v1.5h1.7v1.2h-1.7v2.6h1.7v1.2h-1.7V12a.8.8 0 0 1-.8.8h-1.5v1.7H9.3v-1.7H6.7v1.7H5.5v-1.7H4a.8.8 0 0 1-.8-.8v-1.5H1.5V9.3h1.7V6.7H1.5V5.5h1.7V4a.8.8 0 0 1 .8-.8h1.5zM4.4 4.4v7.2h7.2V4.4zm1.8 1.8h3.6v3.6H6.2z",
  memory: "M1.5 4h13v6.5h-1.3V13H11.9v-2.5H10.6V13H9.3v-2.5H6.7V13H5.4v-2.5H4.1V13H2.8v-2.5H1.5zm1.3 1.3v3.9h10.4V5.3zm1.3 1.1h1.6v1.7H4.1zm3.1 0h1.6v1.7H7.2zm3.1 0h1.6v1.7h-1.6z",
  prev: "M10.6 2.9l1.1 1.1-4 4 4 4-1.1 1.1L5.5 8z",
  next: "M5.4 2.9L4.3 4l4 4-4 4 1.1 1.1L10.5 8z",
};

function actionButton(kind, label, onClick) {
  const button = el("button", "action");
  button.dataset.focus = kind;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.appendChild(icon(ICONS[kind]));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

/** A "?" that opens a plain-words explanation, anchored under itself. */
function help(key, text) {
  const wrap = el("span", "help-wrap");
  const button = el("button", "help", "?");
  const id = "help-" + key;
  button.setAttribute("popovertarget", id);
  button.setAttribute("aria-label", S.helpLabel);
  button.title = S.helpLabel;
  button.style.setProperty("anchor-name", "--" + id);
  button.addEventListener("click", (event) => event.stopPropagation());
  const pop = el("div", "help-pop", text);
  pop.id = id;
  pop.setAttribute("popover", "");
  pop.setAttribute("role", "tooltip");
  pop.style.setProperty("position-anchor", "--" + id);
  wrap.append(button, pop);
  return wrap;
}

function skeleton(className) {
  return el("span", "skeleton " + (className || ""));
}

/** A fresh copy of one of the illustrations, sized by className. */
function art(name, className) {
  const svg = document.getElementById("art-" + name).content.firstElementChild.cloneNode(true);
  svg.classList.add(className);
  return svg;
}

/** Runs an allow-listed command on the host (see GLOBAL_COMMANDS). */
function globalButton(className, label, command) {
  const button = el("button", className, label);
  button.addEventListener("click", () => send("global", { command }));
  return button;
}

/**
 * "Try again" stays pressed until the host answers: a success replaces the
 * whole state, a failure arrives with a new problem and rebuilds the button.
 */
function retryButton(className) {
  const button = el("button", className, S.tryAgain);
  button.dataset.focus = "retry";
  button.addEventListener("click", () => {
    button.disabled = true;
    if (className.includes("btn")) button.prepend(el("span", "spinner small"));
    send("global", { command: "refreshCache" });
  });
  return button;
}

/** PlanTag tint: the plan's colour from the site's plan list, grey otherwise. */
const PLAN_RGB = { hobby: "125, 125, 125", standard: "52, 78, 212", pro: "247, 30, 30", enterprise: "102, 36, 209" };
function planTag(name) {
  const tag = el("span", "plan-tag", name);
  const tier = Object.keys(PLAN_RGB).find((id) => name.toLowerCase().startsWith(id));
  tag.style.setProperty("--plan", PLAN_RGB[tier] ?? "125, 125, 125");
  return tag;
}

/** The dashboard's plan bar: blue, turning yellow then red as it fills. */
function meterColor(share) {
  const stops = [[59, 130, 246], [59, 130, 246], [253, 224, 71], [239, 68, 68]];
  const x = Math.min(1, Math.max(0, share)) * 3;
  const i = Math.min(2, Math.floor(x));
  return "rgb(" + stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * (x - i))).join(", ") + ")";
}

function account(user) {
  const card = el("section", "account");
  const head = el("div", "account-head");
  head.appendChild(document.getElementById("logo").content.cloneNode(true));
  const identity = el("div", "identity");
  head.appendChild(identity);
  card.appendChild(head);
  const plan = el("div", "plan-meter");
  card.appendChild(plan);

  if (!user) {
    card.setAttribute("aria-busy", "true");
    card.setAttribute("aria-label", S.loading);
    identity.append(skeleton("bar w-50"), skeleton("bar w-70 thin"));
    head.appendChild(skeleton("tag-skel"));
    plan.append(skeleton("bar thin w-100"), skeleton("meter-skel"));
    return card;
  }

  identity.appendChild(el("strong", "name", user.name));
  identity.appendChild(el("span", "muted email", user.email));
  head.appendChild(planTag(user.plan.name));

  const used = user.plan.memory.used;
  const limit = user.plan.memory.limit;
  const top = el("div", "plan-meter-label");
  const label = el("span", "meter-name", S.ram);
  label.appendChild(help("account", S.help.account));
  top.appendChild(label);
  top.appendChild(el("span", "muted mono", limit ? used + " MB / " + limit + " MB" : S.ramUnavailable));
  plan.appendChild(top);
  // Accounts without hosting memory get the site's "Unavailable", not a bar.
  if (!limit) return card;

  const share = Math.min(100, (used / limit) * 100);
  const meter = el("div", "meter");
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-label", S.ram);
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", String(limit));
  meter.setAttribute("aria-valuenow", String(used));
  const fill = el("div", "meter-fill");
  fill.style.background = meterColor(share / 100);
  // Starts where the last one ended and glides to the new value once mounted.
  fill.style.width = (meterShare ?? 0) + "%";
  mounted.push(() => {
    void fill.offsetWidth;
    fill.style.width = share + "%";
  });
  meterShare = share;
  meter.appendChild(fill);
  plan.appendChild(meter);
  return card;
}

function sectionHeader(key, title, count, text) {
  const header = el("header", "section-head");
  header.appendChild(el("h2", null, title));
  if (count != null) header.appendChild(el("span", "count", String(count)));
  if (text) header.appendChild(help(key, text));
  return header;
}

/** STATUS_TONE on the site: online, offline, or amber while an action runs. */
function statusOf(app) {
  const action = pending.get(app.id)?.action;
  if (action) return { state: "pending", label: S.pending[action] };
  if (app.running === undefined) return { state: "unknown", label: S.unknown };
  return app.running
    ? { state: "online", label: S.online }
    : { state: "offline", label: S.offline };
}

function statusBadge(state, label) {
  const badge = el("span", "status status-" + state);
  badge.appendChild(
    state === "pending" || state === "unknown" ? el("span", "spinner") : el("span", "dot"),
  );
  badge.appendChild(el("span", null, label));
  return badge;
}

/** The site's formatCpu: an idle container reads "<1%" instead of "0%". */
function formatCpu(raw) {
  const cpu = Number.parseFloat(raw ?? "");
  if (Number.isNaN(cpu)) return "—";
  return cpu < 1 ? "<1%" : Math.round(cpu) + "%";
}

function metric(kind, text) {
  const item = el("span", "metric");
  item.append(icon(ICONS[kind]), el("span", null, text));
  return item;
}

/** Lifecycle click: the badge turns amber until the status catches up. */
function act(app, action) {
  pending.set(app.id, { action, running: app.running });
  // A restart doesn't flip "running", and a failed command never will —
  // either way the spinner gives up on its own.
  setTimeout(() => {
    if (pending.get(app.id)?.action !== action) return;
    pending.delete(app.id);
    render();
  }, action === "restart" ? 5000 : 20000);
  send("command", { command: action + "Entry", id: app.id });
  render();
}

function appRow(app, index) {
  const row = el("article", "row");
  // Repaints happen on every status tick; replaying the entrance on rows that
  // were already there is exactly what looked like flicker.
  if (!seen.has(app.id)) {
    row.classList.add("fresh");
    row.style.animationDelay = Math.min(index, 12) * 22 + "ms";
  }
  const isOpen = opened.has(app.id);
  if (isOpen) row.classList.add("open");

  const main = el("div", "row-main");
  const toggle = () => {
    if (opened.has(app.id)) {
      opened.delete(app.id);
      justOpened = null;
      send("collapse", { id: app.id });
    } else {
      opened.add(app.id);
      justOpened = app.id;
      send("inspect", { id: app.id });
    }
    render();
  };
  main.addEventListener("click", toggle);
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    send("menu", { kind: "app", id: app.id });
  });

  const label = el("div", "row-label");

  // The star sits with the name, like on the site's application card.
  const title = el("div", "row-title");
  const name = el("span", "row-name", app.name);
  // The name is the keyboard handle for opening the row.
  name.tabIndex = 0;
  name.dataset.focus = "name";
  name.setAttribute("role", "button");
  name.setAttribute("aria-expanded", String(isOpen));
  name.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      send("menu", { kind: "app", id: app.id });
    }
  });
  title.appendChild(name);
  const star = actionButton(
    app.favorited ? "starFilled" : "star",
    app.favorited ? S.unfavorite : S.favorite,
    () =>
      send("command", {
        command: app.favorited ? "unfavoriteEntry" : "favoriteEntry",
        id: app.id,
      }),
  );
  star.classList.add("star");
  star.dataset.focus = "star";
  if (app.favorited) star.classList.add("starred");
  title.appendChild(star);
  label.appendChild(title);
  label.appendChild(el("span", "row-sub", app.domain || app.language));
  main.appendChild(label);

  const actions = el("div", "row-actions");
  actions.appendChild(
    app.running
      ? actionButton("stop", S.stop, () => act(app, "stop"))
      : actionButton("start", S.start, () => act(app, "start")),
  );
  if (app.running) {
    actions.appendChild(actionButton("restart", S.restart, () => act(app, "restart")));
  }
  actions.appendChild(
    actionButton("logs", S.logs, () => send("command", { command: "logsEntry", id: app.id })),
  );
  actions.appendChild(
    actionButton("more", S.more, () => send("menu", { id: app.id })),
  );
  main.appendChild(actions);
  row.appendChild(main);

  if (isOpen) {
    const detail = el("dl", "detail");
    if (justOpened === app.id) detail.classList.add("fresh");
    const pairs = [
      ["id", app.id],
      ["ram", app.ram + " MB"],
      ["runtime", app.language],
      ["cluster", app.cluster],
    ];
    if (app.domain) pairs.push(["domain", app.domain]);
    if (app.uptime) pairs.push(["uptime", new Date(app.uptime).toLocaleString(LANG)]);
    for (const [field, value] of pairs) {
      const [name, explanation] = S.fields[field];
      const term = el("dt", null, name);
      term.title = explanation;
      detail.appendChild(term);
      detail.appendChild(el("dd", null, String(value)));
    }
    row.appendChild(detail);
  }

  // Footer like the site's card: CPU (only while running), RAM, status.
  const { state, label: stateLabel } = statusOf(app);
  const previous = last.get(app.id);
  const foot = el("div", "row-foot");
  const metrics = el("div", "metrics");
  metrics.title = S.metricsHelp;
  if (app.running) metrics.appendChild(metric("cpu", formatCpu(app.cpu)));
  const used = app.running && app.ramUsage ? app.ramUsage.replace(/\\s*MB$/i, "") : "—";
  metrics.appendChild(metric("memory", used + " / " + app.ram + " MB"));
  const usage = metrics.textContent;
  if (previous && previous.usage !== usage) metrics.classList.add("tick");
  foot.appendChild(metrics);
  const badge = statusBadge(state, stateLabel);
  if (previous && previous.state !== state) badge.classList.add("changed");
  foot.appendChild(badge);
  row.appendChild(foot);
  last.set(app.id, { state, usage });

  return row;
}

function simpleRow(entry, kind, index) {
  const row = el("article", "row static");
  if (!seen.has(entry.id)) {
    row.classList.add("fresh");
    row.style.animationDelay = Math.min(index, 12) * 22 + "ms";
  }
  const main = el("div", "row-main");
  main.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    send("menu", { kind, id: entry.id });
  });
  const label = el("div", "row-label");
  label.appendChild(el("span", "row-name", entry.name));
  label.appendChild(el("span", "row-sub", entry.meta));
  main.appendChild(label);

  const actions = el("div", "row-actions");
  actions.appendChild(
    actionButton("more", S.more, () => send("menu", { kind, id: entry.id })),
  );
  main.appendChild(actions);

  row.appendChild(main);
  return row;
}

/** Card-shaped placeholders, like the site's list-renderer-skeleton. */
function skeletonRows() {
  const box = el("div", "skeleton-rows");
  box.setAttribute("aria-busy", "true");
  box.setAttribute("aria-label", S.loading);
  for (const width of ["w-60", "w-45", "w-70"]) {
    const row = el("div", "row skeleton-row");
    const main = el("div", "row-main");
    const label = el("div", "row-label");
    label.append(skeleton("bar " + width), skeleton("bar thin w-40"));
    main.appendChild(label);
    const foot = el("div", "row-foot");
    foot.append(skeleton("bar w-40"), skeleton("badge-skel"));
    row.append(main, foot);
    box.appendChild(row);
  }
  return box;
}

function tourButton() {
  const button = el("button", "btn tertiary sm", S.tour);
  button.addEventListener("click", () => send("global", { command: "getStarted" }));
  return button;
}

/** The site's Empty: a picture, what it means, then the one step to take. */
function emptyState(name, title, body) {
  const box = el("div", "empty-state");
  box.appendChild(art(name, "empty-art"));
  const header = el("div", "empty-header");
  header.appendChild(el("p", "empty-title", title));
  header.appendChild(el("p", "muted", body));
  box.appendChild(header);
  return box;
}

/** No applications yet, with a plan to host them: upload the first one. */
function emptyApps() {
  const box = emptyState("empty", S.noApps, S.emptyBody);
  const upload = el("button", "btn primary shine");
  upload.appendChild(icon(ICONS.upload));
  upload.appendChild(el("span", null, S.uploadFirst));
  upload.addEventListener("click", () => send("global", { command: "uploadApplication" }));
  box.append(upload, tourButton());
  return box;
}

/** No hosting memory yet: nothing can run until a plan is picked. */
function planState() {
  const box = emptyState("plan", S.planTitle, S.planBody);
  const pricing = el("button", "btn primary shine", S.pricing);
  pricing.addEventListener("click", () => send("open", { key: "pricing" }));
  box.append(pricing, tourButton());
  return box;
}

/** An empty databases or workspaces section: one line and how to start. */
function emptyTile(name, text, label, command) {
  const tile = el("div", "empty-state tile");
  tile.appendChild(art(name, "tile-art"));
  const body = el("div", "tile-body");
  body.append(el("p", "muted", text), globalButton("link", label, command));
  tile.appendChild(body);
  return tile;
}

/** The countdown to the automatic retry after a rate limit. */
let ticker;

/**
 * The account never loaded, so there is nothing to show but why — and what
 * happens next. A rate limit counts down to the automatic retry.
 */
function problemState(problem) {
  const kind = S.problem[problem.kind] ? problem.kind : "error";
  const [title, body] = S.problem[kind];
  const box = emptyState(kind, title, body);
  box.querySelector(".empty-header").setAttribute("role", "alert");
  if (kind === "rateLimit" && problem.retryAt) {
    const line = el("p", "muted small countdown");
    line.setAttribute("role", "timer");
    const tick = () => {
      const left = Math.max(0, problem.retryAt - Date.now());
      const seconds = Math.ceil(left / 1000);
      line.textContent = S.retryIn.replace("{{TIME}}", Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0"));
      line.hidden = !left;
      return left > 0;
    };
    tick();
    clearInterval(ticker);
    // Ticks once the card is in the document; stops when it leaves.
    mounted.push(() => {
      ticker = setInterval(() => {
        if (!tick() || !line.isConnected) clearInterval(ticker);
      }, 1000);
    });
    box.appendChild(line);
  }
  // Retrying cannot fix an authorization that was refused; reconnecting can.
  box.appendChild(
    kind === "session"
      ? globalButton("btn primary", S.connect, "setApiKey")
      : retryButton("btn primary"),
  );
  const status = el("button", "btn tertiary sm", S.serviceStatus);
  status.addEventListener("click", () => send("service"));
  box.appendChild(status);
  return box;
}

/** The account loaded before but the last refresh did not. */
function staleBanner() {
  const box = el("div", "alert warning banner");
  box.setAttribute("role", "status");
  box.appendChild(document.getElementById("warning-icon").content.firstElementChild.cloneNode(true));
  const time = snapshot.updatedAt
    ? new Date(snapshot.updatedAt).toLocaleTimeString(LANG, { hour: "2-digit", minute: "2-digit" })
    : "—";
  const text = el("span", null, S.stale.replace("{{TIME}}", time) + " ");
  text.appendChild(retryButton("link"));
  box.appendChild(text);
  return box;
}

/** Square Cloud reports trouble: say so first, with the page that explains. */
function degradedBanner(service) {
  const box = el("div", "alert warning banner");
  box.setAttribute("role", "status");
  box.appendChild(art("outage", "banner-art"));
  box.appendChild(el("strong", null, S.problem.outage[0]));
  box.appendChild(el("span", null, service.message));
  const page = el("button", "link", S.statusPage);
  page.addEventListener("click", () => send("open", { key: "status" }));
  box.appendChild(page);
  return box;
}

function serviceFooter(service) {
  const footer = el("footer", "service");
  footer.title = service.message;
  footer.tabIndex = 0;
  footer.setAttribute("role", "button");
  footer.appendChild(el("span", "dot"));
  footer.appendChild(el("span", null, service.message));
  footer.classList.add(service.operational ? "ok" : "degraded");
  footer.addEventListener("click", () => send("service"));
  footer.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      send("service");
    }
  });
  return footer;
}

/** Section containers live for the whole session; only their rows change. */
const groups = {};
function group(key, title, text, rows, count = rows.length) {
  const node = (groups[key] ??= el("section", "group"));
  reconcile(node, [
    memo(key + ":head", [title, count], () => sectionHeader(key, title, count, text)),
    ...rows,
  ]);
  return node;
}

/*
 * The filter, the page's cards and the pager are built once and kept: typing
 * or paging swaps the cards inside their own box, so the input and the arrow
 * never leave the document and keep focus across repaints.
 */
const appList = el("div", "rows");
let filterBox;
function appFilter() {
  if (filterBox) return filterBox;
  filterBox = el("input", "filter");
  filterBox.type = "search";
  filterBox.placeholder = S.filter;
  filterBox.setAttribute("aria-label", S.filter);
  filterBox.addEventListener("input", () => {
    query = filterBox.value.trim();
    page = 0;
    render();
  });
  return filterBox;
}

let pagerNode;
function pager() {
  if (!pagerNode) {
    pagerNode = el("nav", "pager");
    const label = el("span", "pager-label");
    label.setAttribute("aria-live", "polite");
    pagerNode.append(
      actionButton("prev", S.prevPage, () => turn(-1)),
      label,
      actionButton("next", S.nextPage, () => turn(1)),
    );
  }
  const [prev, label, next] = pagerNode.children;
  // aria-disabled rather than disabled: a disabled button drops the focus of
  // whoever just paged to the end with the keyboard.
  prev.setAttribute("aria-disabled", String(page === 0));
  next.setAttribute("aria-disabled", String(page >= pageCount - 1));
  label.textContent = S.page.replace("{{PAGE}}", page + 1).replace("{{PAGES}}", pageCount);
  return pagerNode;
}

function turn(step) {
  const target = Math.min(pageCount - 1, Math.max(0, page + step));
  if (target === page) return;
  page = target;
  render();
  // The new page reads from its first card, not from wherever the last ended.
  if (groups.apps.getBoundingClientRect().top < 0) groups.apps.scrollIntoView();
}

/** The filter, one page of cards and the pager, for an account that has apps. */
function appPage() {
  const needle = query.toLowerCase();
  const matches = needle
    ? snapshot.apps.filter((app) => [app.name, app.domain, app.id].join(" ").toLowerCase().includes(needle))
    : snapshot.apps;
  pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  // A deleted app or a narrower filter can leave the page past the end.
  page = Math.min(page, pageCount - 1);
  const start = page * PAGE_SIZE;
  reconcile(
    appList,
    matches.length
      ? matches.slice(start, start + PAGE_SIZE).map((app, index) =>
          memo(
            "app:" + app.id,
            [app, opened.has(app.id), justOpened === app.id, statusOf(app).state],
            () => appRow(app, index),
          ),
        )
      : [memo("no-match", [query], () => el("p", "muted no-match", S.noMatch.replace("{{QUERY}}", () => query)))],
  );
  const nodes = [appList];
  // Still shown while a filter is typed, or it would hide the only way out.
  if (snapshot.apps.length > PAGE_SIZE || query) nodes.unshift(appFilter());
  if (pageCount > 1) nodes.push(pager());
  return nodes;
}

function render() {
  const { user, problem, service } = snapshot;
  // Nothing loaded to fall back on: the problem is the whole view.
  const blocked = problem && !user;
  const nodes = [];
  if (service && !service.operational && !(blocked && problem.kind === "outage")) {
    nodes.push(memo("degraded", [service.message], () => degradedBanner(service)));
  }
  if (blocked) {
    nodes.push(memo("problem", [problem], () => problemState(problem)));
    if (service) nodes.push(memo("service", [service], () => serviceFooter(service)));
    reconcile(root, nodes);
    for (const run of mounted.splice(0)) run();
    return;
  }
  if (problem) {
    nodes.push(memo("stale", [snapshot.updatedAt, problem.at], staleBanner));
  }
  nodes.push(memo("account", [user], () => account(user)));

  let appRows;
  if (snapshot.loading && !snapshot.apps.length) {
    appRows = [memo("skeleton", [], skeletonRows)];
  } else if (!snapshot.apps.length && user && !user.plan.memory.limit) {
    appRows = [memo("plan", [], planState)];
  } else if (!snapshot.apps.length) {
    appRows = [memo("empty", [], emptyApps)];
  } else {
    appRows = appPage();
  }
  // Skeleton and empty state are not rows — the count is the real one, and
  // there is none to show until the list has loaded. null, not undefined:
  // undefined would fall back to group()'s default and count the skeleton.
  const appCount = snapshot.loading && !snapshot.apps.length ? null : snapshot.apps.length;
  nodes.push(group("apps", S.apps, S.help.apps, appRows, appCount));

  // Both sections stay once the account is in, empty or not, so there is
  // always a way to create the first one.
  if (user) {
    nodes.push(
      group(
        "databases",
        S.databases,
        S.help.databases,
        snapshot.databases.length
          ? snapshot.databases.map((db, index) =>
              memo("db:" + db.id, [db], () =>
                simpleRow(
                  { id: db.id, name: db.name, meta: db.type + " · " + db.ram + " MB" },
                  "database",
                  index,
                ),
              ),
            )
          : [memo("no-databases", [], () => emptyTile("databases", S.noDatabases, S.createDatabase, "createDatabase"))],
        snapshot.databases.length,
      ),
    );
    nodes.push(
      group(
        "workspaces",
        S.workspaces,
        S.help.workspaces,
        snapshot.workspaces.length
          ? snapshot.workspaces.map((ws, index) =>
              memo("ws:" + ws.id, [ws], () =>
                simpleRow(
                  { id: ws.id, name: ws.name, meta: ws.members + " · " + ws.apps },
                  "workspace",
                  index,
                ),
              ),
            )
          : [memo("no-workspaces", [], () => emptyTile("workspaces", S.noWorkspaces, S.createWorkspace, "createWorkspace"))],
        snapshot.workspaces.length,
      ),
    );
  }

  if (service) {
    nodes.push(memo("service", [service], () => serviceFooter(service)));
  }
  if (snapshot.apps.length || snapshot.loading) {
    nodes.push(memo("tour", [], () => {
      const wrap = el("div", "tour");
      wrap.appendChild(tourButton());
      return wrap;
    }));
  }

  reconcile(root, nodes);
  for (const run of mounted.splice(0)) run();

  // Everything painted this pass counts as established; the next repaint is a
  // silent update, not an arrival.
  for (const app of snapshot.apps) seen.add(app.id);
  for (const db of snapshot.databases) seen.add(db.id);
  for (const ws of snapshot.workspaces) seen.add(ws.id);
  justOpened = null;
}

window.addEventListener("message", (event) => {
  snapshot = event.data;
  // A start/stop is settled once "running" moves off what it was when clicked.
  for (const app of snapshot.apps) {
    const waiting = pending.get(app.id);
    if (waiting && waiting.action !== "restart" && app.running !== waiting.running) {
      pending.delete(app.id);
    }
  }
  render();
});

render();
send("ready");
</script>
</body>
</html>`;
}

/**
 * Layout for the dashboard; colours, buttons, badges, skeletons and motion come
 * from `squareStyles`. Cards follow the site's application cards: bg-card,
 * 1px border, rounded-lg, blue border on hover.
 */
function styles(): string {
  return `
  body { padding: 12px 10px 24px; }
  .mono { font-family: var(--sq-mono); font-variant-numeric: tabular-nums; }

  /* The whole panel arrives at once — it is the other half of the sign-in
     handover, so it should look like a continuation, not a reload. */
  .enter { animation: rise 0.34s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* Header row: logo, who is signed in, and the PlanTag. */
  .account { margin-bottom: 18px; }
  .account-head { display: flex; align-items: center; gap: 10px; }
  .identity { min-width: 0; flex: 1; display: grid; gap: 3px; }
  .name {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--sq-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .email {
    display: block;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  body { --plan-from: 0.25; --plan-to: 0.075; }
  body.vscode-light { --plan-from: 0.38; --plan-to: 0.13; }
  .plan-tag {
    flex: none;
    padding: 1px 6px;
    border: 1px solid rgba(var(--plan), 0.35);
    border-radius: 4px;
    background: linear-gradient(rgba(var(--plan), var(--plan-from)), rgba(var(--plan), var(--plan-to)));
    font-size: 12px;
    font-weight: 500;
    color: var(--sq-foreground);
    text-transform: capitalize;
    white-space: nowrap;
  }
  .tag-skel { flex: none; width: 58px; height: 20px; border-radius: 4px; }

  /* plan-progress-bar.tsx: a bordered box, muted xs text, a thin bar. */
  .plan-meter {
    display: grid;
    gap: 6px;
    margin-top: 12px;
    padding: 9px 10px 10px;
    border: 1px solid var(--sq-border);
    border-radius: var(--sq-radius);
    font-size: 12px;
  }
  .plan-meter-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .meter-name { display: inline-flex; align-items: center; gap: 6px; color: var(--sq-text-secondary); font-weight: 500; }
  .meter {
    position: relative;
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: color-mix(in oklab, var(--sq-text-muted) 30%, transparent);
  }
  .meter-fill {
    height: 100%;
    border-radius: inherit;
    transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.7s ease;
  }
  body:not(.vscode-dark):not(.vscode-light) .meter-fill { background: var(--sq-blue) !important; }
  .meter-skel { height: 6px; border-radius: 999px; }

  /* Loading placeholders in the shape of what is coming. */
  .bar { height: 12px; border-radius: 4px; }
  .bar.thin { height: 9px; }
  .w-40 { width: 40%; } .w-45 { width: 45%; } .w-50 { width: 50%; }
  .w-60 { width: 60%; } .w-70 { width: 70%; } .w-100 { width: 100%; }
  .badge-skel { flex: none; width: 64px; height: 20px; border-radius: 4px; }
  .skeleton-rows { display: grid; gap: 8px; }
  .skeleton-row .row-label { gap: 8px; padding: 2px 0; }
  .skeleton-row:hover { border-color: var(--sq-border); }

  .group { display: grid; gap: 8px; margin-bottom: 18px; }
  /* The page's cards sit in the group's grid as if the box weren't there. */
  .rows { display: contents; }
  .filter {
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--sq-border);
    border-radius: var(--sq-radius);
    background: var(--sq-input);
    color: var(--sq-foreground);
    font: inherit;
  }
  .filter::placeholder { color: var(--sq-text-muted); }
  .no-match { margin: 0; padding: 6px 2px; font-size: 12px; overflow-wrap: anywhere; }
  .pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 2px; }
  .pager-label { font-size: 12px; color: var(--sq-text-muted); font-variant-numeric: tabular-nums; }
  .pager .action[aria-disabled="true"] { opacity: 0.4; cursor: default; }
  .pager .action[aria-disabled="true"]:hover { background: none; color: var(--sq-text-secondary); }
  .section-head { display: flex; align-items: center; gap: 6px; padding: 0 2px; }
  .section-head h2 { margin: 0; font-size: 13px; font-weight: 600; color: var(--sq-foreground); }
  .count {
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--sq-text-secondary);
    background: var(--sq-muted);
    border: 1px solid var(--sq-border);
  }

  /* "?" help: the site's tooltip — popover surface, border, shadow-md. */
  .help-wrap { display: inline-flex; }
  .help {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 1px solid var(--sq-border);
    border-radius: 50%;
    background: var(--sq-muted);
    font: 600 10px/1 var(--sq-font);
    color: var(--sq-text-muted);
    cursor: help;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .help:hover { color: var(--sq-foreground); border-color: var(--sq-text-muted); }
  .help-pop {
    margin: 0;
    inset: auto;
    /* Under its "?", as wide as the sidebar allows — a narrow view has no room
       for a floating bubble anyway. */
    top: anchor(bottom);
    left: 10px;
    right: 10px;
    position-try-fallbacks: flip-block;
    margin-top: 6px;
    padding: 8px 12px;
    border-radius: var(--sq-radius);
    border: 1px solid var(--sq-border);
    background: var(--sq-popover);
    color: var(--sq-text-secondary);
    box-shadow: 0 0 12px 4px var(--sq-shadow);
    font-size: 12px;
    font-weight: 400;
    line-height: 1.5;
    transform-origin: top center;
  }
  .help-pop:popover-open { animation: tip-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes tip-in {
    from { opacity: 0; transform: translateY(-5px) scale(0.75); }
    to { opacity: 1; transform: none; }
  }

  /* One card per application, like workspace-applications/item. */
  .row {
    border: 1px solid var(--sq-border);
    border-radius: var(--sq-radius-lg);
    background: var(--sq-card);
    transition: border-color 0.15s ease;
  }
  .row:hover, .row.open { border-color: color-mix(in oklab, var(--sq-blue) 40%, var(--sq-border)); }
  .row.fresh { animation: rise 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .row-main {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 10px 12px;
    cursor: pointer;
  }
  .row.static .row-main, .skeleton-row .row-main { cursor: default; }
  .row-label { min-width: 0; flex: 1; display: grid; gap: 2px; }
  .row-title { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .row-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-radius: 3px;
    font-weight: 600;
    color: var(--sq-foreground);
  }
  .row-sub {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: var(--sq-text-secondary);
  }

  /* Filled yellow and always visible once set; an outline that only shows on
     hover otherwise, so unfavourited rows stay quiet. */
  .action.star { width: 20px; height: 20px; flex: none; opacity: 0; }
  .action.star svg { width: 13px; height: 13px; }
  .action.starred { opacity: 1; color: var(--sq-star); }
  .row-main:hover .action.star, .action.star:focus-visible { opacity: 1; }

  /* Actions stay out of the way until the card is pointed at — the list reads
     as names first, controls second. */
  .row-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.13s ease; }
  .row-main:hover .row-actions,
  .row-main:focus-within .row-actions { opacity: 1; }
  .action {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--sq-control-border);
    border-radius: 6px;
    background: none;
    color: var(--sq-text-secondary);
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease, transform 0.1s ease;
  }
  .action svg { width: 14px; height: 14px; fill: currentColor; }
  .action:hover { background: var(--sq-muted); color: var(--sq-foreground); }
  .action:active { transform: scale(0.92); }

  /* Footer: font-mono CPU / RAM on the left, status badge on the right. */
  .row-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 6px 10px;
    padding: 8px 10px 8px 12px;
    border-top: 1px solid var(--sq-border);
  }
  .metrics {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 10px;
    min-width: 0;
    font-family: var(--sq-mono);
    font-size: 11px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--sq-text-secondary);
  }
  .metric { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  .metric svg { width: 13px; height: 13px; flex: none; fill: currentColor; opacity: 0.8; }
  .metrics.tick { animation: tick 0.6s ease-out; }
  @keyframes tick { from { opacity: 0.35; } to { opacity: 1; } }

  /* EntityStatusBadge: tinted, bordered, uppercase, dot or spinner. */
  .status {
    --tone: var(--sq-text-muted);
    --tone-text: var(--sq-text-muted);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 20px;
    padding: 0 7px;
    border: 1px solid color-mix(in oklab, var(--tone) 25%, transparent);
    border-radius: 4px;
    background: color-mix(in oklab, var(--tone) 10%, transparent);
    color: var(--tone-text);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .status-online { --tone: var(--sq-green); --tone-text: var(--sq-green-text); }
  .status-offline { --tone: var(--sq-red); --tone-text: var(--sq-red-text); }
  .status-pending { --tone: var(--sq-amber); --tone-text: var(--sq-amber-text); }
  .status .spinner {
    width: 10px;
    height: 10px;
    border-width: 1.5px;
    border-color: color-mix(in oklab, currentColor 25%, transparent);
    border-left-color: currentColor;
  }
  .status.changed { animation: pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
  .dot {
    position: relative;
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tone);
  }
  /* animate-ping on the online dot, like the site. */
  .status-online .dot::after, .service.ok .dot::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: inherit;
    animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
  @keyframes ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }

  /* Details: a small key/value card, like the site's MetricTile surface. */
  .detail {
    display: grid;
    /* A plain 1fr floors at the item's min-content, and a 32-char application
       id is wider than a narrow sidebar — minmax(0, 1fr) lets it shrink. */
    grid-template-columns: auto minmax(0, 1fr);
    gap: 5px 12px;
    margin: 0 10px 10px 12px;
    padding: 9px 10px;
    border: 1px solid var(--sq-border);
    border-radius: var(--sq-radius);
    background: color-mix(in oklab, var(--sq-muted) 30%, transparent);
    font-size: 12px;
  }
  .detail.fresh { animation: unfold 0.24s ease both; }
  .detail dt {
    color: var(--sq-text-muted);
    white-space: nowrap;
    cursor: help;
    text-decoration: underline dotted color-mix(in oklab, var(--sq-text-muted) 60%, transparent);
    text-underline-offset: 3px;
  }
  .detail dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    font-family: var(--sq-mono);
    font-size: 11px;
    line-height: 1.6;
    color: var(--sq-text-primary);
  }
  @keyframes unfold {
    from { opacity: 0; transform: translateY(-3px); }
    to { opacity: 1; transform: none; }
  }

  /* Above everything else: the platform is in trouble, or the data is old. */
  .banner { margin-bottom: 14px; animation: rise 0.34s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* feedback/empty.tsx: dashed border, centred, media / header / content. */
  .empty-state {
    display: grid;
    justify-items: center;
    gap: 14px;
    padding: 20px 14px;
    border: 1px dashed var(--sq-border);
    border-radius: var(--sq-radius-lg);
    text-align: center;
    text-wrap: balance;
    animation: rise 0.34s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .empty-art { display: block; width: min(180px, 80%); height: auto; }
  .empty-header { display: grid; gap: 6px; }
  .empty-title { margin: 0; font-size: 15px; font-weight: 500; letter-spacing: -0.01em; color: var(--sq-foreground); }
  .empty-state p { margin: 0; line-height: 1.6; }
  .empty-state .small { font-size: 12px; }
  .empty-state .btn.primary { max-width: 100%; }
  .empty-state .btn span { overflow: hidden; text-overflow: ellipsis; }
  .empty-state .spinner.small { width: 14px; height: 14px; border-width: 1.5px; border-color: color-mix(in oklab, currentColor 30%, transparent); border-left-color: currentColor; }
  .countdown { font-variant-numeric: tabular-nums; }
  /* The same Empty, compact: a small picture beside one line and its action. */
  .empty-state.tile {
    grid-template-columns: 88px minmax(0, 1fr);
    align-items: center;
    justify-items: start;
    gap: 12px;
    padding: 10px 12px;
    text-align: left;
    text-wrap: pretty;
  }
  .tile-art { display: block; width: 88px; height: auto; }
  .tile-body { display: grid; gap: 4px; justify-items: start; min-width: 0; }
  .tile-body .link { font-size: 12px; }
  .tour { display: flex; justify-content: center; margin-top: 4px; }

  /* Ambient, like the status line on the web dashboard: always there, never in
     the way, and it says the answer instead of making you go ask for it. */
  .service {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding: 10px 4px;
    border-top: 1px solid var(--sq-border);
    font-size: 12px;
    color: var(--sq-text-muted);
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .service:hover { color: var(--sq-foreground); }
  .service.ok { --tone: var(--sq-green); }
  .service.degraded { --tone: var(--sq-amber); }

  @media (prefers-reduced-motion: reduce) {
    /* A still ring keeps "live" readable without the ping. */
    .status-online .dot::after, .service.ok .dot::after { display: none; }
    .status-online .dot, .service.ok .dot { box-shadow: 0 0 0 2px color-mix(in oklab, var(--tone) 35%, transparent); }
  }
  `;
}
