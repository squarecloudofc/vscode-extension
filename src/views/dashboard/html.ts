import { randomBytes } from "node:crypto";
import { t } from "vscode-ext-localisation";

/**
 * Shell for the signed-in sidebar. The host posts a snapshot of the store and
 * the script below renders it — no server-side templating, so a status tick
 * repaints a couple of nodes instead of the whole document.
 */
export function renderDashboard(): string {
  const nonce = randomBytes(16).toString("base64");

  const strings = {
    apps: t("view.apps.title"),
    databases: t("view.databases.title"),
    workspaces: t("view.workspaces.title"),
    noApps: t("apps.noApps.message"),
    noAppsHint: t("apps.noApps.description"),
    noDatabases: t("database.empty"),
    noWorkspaces: t("workspace.empty"),
    loading: t("generic.loading"),
    online: t("dashboard.online"),
    offline: t("dashboard.offline"),
    unknown: t("dashboard.unknown"),
    start: t("command.start"),
    stop: t("command.stop"),
    restart: t("command.restart"),
    logs: t("command.logsEntry"),
    more: t("dashboard.more"),
    ram: t("dashboard.ramUsed"),
    favorite: t("command.favorite"),
    unfavorite: t("command.unfavorite"),
  };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>${styles()}</style>
</head>
<body>
<div id="root" class="enter"></div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const S = ${JSON.stringify(strings)};
const root = document.getElementById("root");

/** Ids of rows the user opened. Kept across repaints so a poll doesn't collapse them. */
const opened = new Set();
/** Ids already on screen. Only what's genuinely new animates in. */
const seen = new Set();
let justOpened = null;
let snapshot = { apps: [], databases: [], workspaces: [], loading: true };

const send = (type, payload) => vscode.postMessage({ type, ...payload });

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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
  pulse: "M6.1 2.4l2.5 8.1 1.6-4.1h4.3v1.4h-3.3l-2.4 6.1-2.5-8.2-1.5 4h-3.3V8.3h2.3z",
};

function actionButton(kind, label, onClick) {
  const button = el("button", "action");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.appendChild(icon(ICONS[kind]));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function account(user) {
  const card = el("section", "account");
  if (!user) {
    card.appendChild(el("p", "muted", S.loading));
    return card;
  }

  const head = el("div", "account-head");
  const identity = el("div", "identity");
  identity.appendChild(el("strong", "name", user.name));
  identity.appendChild(el("span", "muted email", user.email));
  head.appendChild(identity);
  head.appendChild(el("span", "pill", user.plan.name));
  card.appendChild(head);

  const used = user.plan.memory.used;
  const limit = user.plan.memory.limit || 1;
  const meter = el("div", "meter");
  const fill = el("div", "meter-fill");
  fill.style.width = Math.min(100, (used / limit) * 100) + "%";
  meter.appendChild(fill);
  card.appendChild(meter);

  card.appendChild(
    el("p", "muted meter-label", S.ram + " " + used + " / " + limit + " MB"),
  );
  return card;
}

function sectionHeader(title, count) {
  const header = el("header", "section-head");
  header.appendChild(el("h2", null, title));
  if (count !== undefined) header.appendChild(el("span", "count", String(count)));
  return header;
}

function appRow(app, index) {
  const row = el("article", "row");
  // Repaints happen on every status tick; replaying the entrance on rows that
  // were already there is exactly what looked like flicker.
  if (!seen.has(app.id)) {
    row.classList.add("fresh");
    row.style.animationDelay = Math.min(index, 12) * 22 + "ms";
  }
  if (opened.has(app.id)) row.classList.add("open");

  const main = el("div", "row-main");
  const toggle = () => {
    if (opened.has(app.id)) {
      opened.delete(app.id);
      justOpened = null;
    } else {
      opened.add(app.id);
      justOpened = app.id;
      send("inspect", { id: app.id });
    }
    render();
  };
  main.addEventListener("click", toggle);
  main.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    send("menu", { kind: "app", id: app.id });
  });

  const state =
    app.running === undefined ? "unknown" : app.running ? "online" : "offline";
  const dot = el("span", "dot dot-" + state);
  dot.title = S[state];
  main.appendChild(dot);

  const label = el("div", "row-label");

  // The star sits with the name, not off in the action strip — it labels the
  // app, it isn't something you do to it.
  const title = el("div", "row-title");
  title.appendChild(el("span", "row-name", app.name));
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
  if (app.favorited) star.classList.add("starred");
  title.appendChild(star);
  label.appendChild(title);

  if (app.running && app.cpu) {
    label.appendChild(el("span", "muted metrics", app.cpu + " · " + app.ramUsage));
  }
  main.appendChild(label);

  const actions = el("div", "row-actions");
  actions.appendChild(
    app.running
      ? actionButton("stop", S.stop, () => send("command", { command: "stopEntry", id: app.id }))
      : actionButton("start", S.start, () => send("command", { command: "startEntry", id: app.id })),
  );
  if (app.running) {
    actions.appendChild(
      actionButton("restart", S.restart, () =>
        send("command", { command: "restartEntry", id: app.id }),
      ),
    );
  }
  actions.appendChild(
    actionButton("logs", S.logs, () => send("command", { command: "logsEntry", id: app.id })),
  );
  actions.appendChild(
    actionButton("more", S.more, () => send("menu", { id: app.id })),
  );
  main.appendChild(actions);

  row.appendChild(main);

  if (opened.has(app.id)) {
    const detail = el("dl", "detail");
    if (justOpened === app.id) detail.classList.add("fresh");
    const pairs = [
      ["ID", app.id],
      [S.ram, app.ram + " MB"],
      ["Runtime", app.language],
      ["Cluster", app.cluster],
    ];
    if (app.domain) pairs.push(["Domain", app.domain]);
    if (app.uptime) pairs.push(["Uptime", app.uptime]);
    for (const [key, value] of pairs) {
      detail.appendChild(el("dt", null, key));
      detail.appendChild(el("dd", null, String(value)));
    }
    row.appendChild(detail);
  }

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
  main.appendChild(el("span", "dot dot-idle"));
  const label = el("div", "row-label");
  label.appendChild(el("span", "row-name", entry.name));
  label.appendChild(el("span", "muted metrics", entry.meta));
  main.appendChild(label);

  const actions = el("div", "row-actions");
  actions.appendChild(
    actionButton("more", S.more, () => send("menu", { kind, id: entry.id })),
  );
  main.appendChild(actions);

  row.appendChild(main);
  return row;
}

function emptyState(message) {
  return el("p", "muted empty", message);
}

function render() {
  const next = document.createDocumentFragment();
  next.appendChild(account(snapshot.user));

  const apps = el("section", "group");
  apps.appendChild(sectionHeader(S.apps, snapshot.apps.length));
  if (snapshot.loading && !snapshot.apps.length) {
    apps.appendChild(emptyState(S.loading));
  } else if (!snapshot.apps.length) {
    apps.appendChild(emptyState(S.noApps));
  } else {
    snapshot.apps.forEach((app, index) => apps.appendChild(appRow(app, index)));
  }
  next.appendChild(apps);

  if (snapshot.databases.length) {
    const databases = el("section", "group");
    databases.appendChild(sectionHeader(S.databases, snapshot.databases.length));
    snapshot.databases.forEach((db, index) =>
      databases.appendChild(
        simpleRow(
          { id: db.id, name: db.name, meta: db.type + " · " + db.ram + " MB" },
          "database",
          index,
        ),
      ),
    );
    next.appendChild(databases);
  }

  if (snapshot.workspaces.length) {
    const workspaces = el("section", "group");
    workspaces.appendChild(sectionHeader(S.workspaces, snapshot.workspaces.length));
    snapshot.workspaces.forEach((ws, index) =>
      workspaces.appendChild(
        simpleRow(
          { id: ws.id, name: ws.name, meta: ws.members + " · " + ws.apps },
          "workspace",
          index,
        ),
      ),
    );
    next.appendChild(workspaces);
  }

  if (snapshot.service) {
    const footer = el("footer", "service");
    footer.title = snapshot.service.message;
    footer.appendChild(icon(ICONS.pulse));
    footer.appendChild(el("span", null, snapshot.service.message));
    if (snapshot.service.operational) footer.classList.add("ok");
    footer.addEventListener("click", () => send("service"));
    next.appendChild(footer);
  }

  root.replaceChildren(next);

  // Everything painted this pass counts as established; the next repaint is a
  // silent update, not an arrival.
  for (const app of snapshot.apps) seen.add(app.id);
  for (const db of snapshot.databases) seen.add(db.id);
  for (const ws of snapshot.workspaces) seen.add(ws.id);
  justOpened = null;
}

window.addEventListener("message", (event) => {
  snapshot = event.data;
  render();
});

render();
send("ready");
</script>
</body>
</html>`;
}

function styles(): string {
  return `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 10px 8px 24px;
    font-family: var(--vscode-font-family);
    font-size: 12px;
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    /* The sidebar scrolls vertically; nothing here should ever scroll sideways. */
    overflow-x: hidden;
  }
  .muted { color: var(--vscode-descriptionForeground); }

  /* The whole panel arrives at once — it is the other half of the sign-in
     handover, so it should look like a continuation, not a reload. */
  .enter { animation: rise 0.34s cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }

  .account {
    padding: 10px;
    margin-bottom: 16px;
    border: 1px solid color-mix(in srgb, var(--vscode-foreground) 10%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--vscode-foreground) 4%, transparent);
  }
  .account-head { display: flex; align-items: center; gap: 8px; }
  .identity { min-width: 0; flex: 1; }
  .name { display: block; font-size: 12px; }
  .email {
    display: block;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pill {
    flex: none;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    text-transform: capitalize;
    color: var(--vscode-badge-foreground);
    background: var(--vscode-badge-background);
  }
  .meter {
    height: 3px;
    margin-top: 10px;
    border-radius: 3px;
    overflow: hidden;
    background: color-mix(in srgb, var(--vscode-foreground) 12%, transparent);
  }
  .meter-fill {
    height: 100%;
    border-radius: inherit;
    background: var(--vscode-textLink-foreground);
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .meter-label { margin: 6px 0 0; font-size: 10px; }

  .group { margin-bottom: 18px; }
  .section-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px 6px;
  }
  .section-head h2 {
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
  }
  .count {
    padding: 0 5px;
    border-radius: 999px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    background: color-mix(in srgb, var(--vscode-foreground) 10%, transparent);
  }

  .row { border-radius: 8px; }
  .row.fresh { animation: rise 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .row-main {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.13s ease;
  }
  .row.static .row-main { cursor: default; }
  .row-main:hover { background: var(--vscode-list-hoverBackground); }
  .row.open .row-main { background: var(--vscode-list-hoverBackground); }

  .dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--vscode-descriptionForeground);
  }
  .dot-online {
    background: var(--vscode-testing-iconPassed, #3fb950);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--vscode-testing-iconPassed, #3fb950) 60%, transparent);
    animation: beat 2.4s ease-out infinite;
  }
  .dot-offline { background: color-mix(in srgb, var(--vscode-foreground) 30%, transparent); }
  .dot-unknown { animation: fade 1.2s ease-in-out infinite alternate; }
  @keyframes beat {
    0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--vscode-testing-iconPassed, #3fb950) 55%, transparent); }
    70%, 100% { box-shadow: 0 0 0 5px transparent; }
  }
  @keyframes fade { from { opacity: 0.3; } to { opacity: 0.9; } }

  .row-label { min-width: 0; flex: 1; display: grid; }
  .row-title { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .metrics { font-size: 10px; font-variant-numeric: tabular-nums; }

  /* Filled and always visible once set; an outline that only shows on hover
     otherwise, so unfavourited rows stay quiet. */
  .action.star { width: 18px; height: 18px; flex: none; opacity: 0; }
  .action.star svg { width: 11px; height: 11px; }
  .action.starred { opacity: 1; color: var(--vscode-charts-yellow, #d7ba7d); }
  .row-main:hover .action.star { opacity: 1; }

  /* Actions stay out of the way until the row is pointed at — the list should
     read as names first, controls second. */
  .row-actions { display: flex; gap: 1px; opacity: 0; transition: opacity 0.13s ease; }
  .row-main:hover .row-actions,
  .row-actions:focus-within { opacity: 1; }
  .action {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 5px;
    background: none;
    color: var(--vscode-icon-foreground, var(--vscode-foreground));
    cursor: pointer;
    transition: background 0.12s ease, transform 0.1s ease;
  }
  .action svg { width: 13px; height: 13px; fill: currentColor; }
  .action:hover { background: color-mix(in srgb, var(--vscode-foreground) 14%, transparent); }
  .action:active { transform: scale(0.92); }
  .action:focus-visible { outline: 1px solid var(--vscode-focusBorder); }

  .detail {
    display: grid;
    /* A plain 1fr floors at the item's min-content, and a 32-char application
       id is wider than a narrow sidebar — that is what pushed a scrollbar
       across the whole view. minmax(0, 1fr) lets the column actually shrink. */
    grid-template-columns: auto minmax(0, 1fr);
    gap: 3px 10px;
    margin: 0;
    padding: 4px 6px 10px 21px;
    font-size: 10px;
  }
  .detail.fresh { animation: unfold 0.24s ease both; }
  .detail dt { color: var(--vscode-descriptionForeground); white-space: nowrap; }
  .detail dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  @keyframes unfold {
    from { opacity: 0; transform: translateY(-3px); }
    to { opacity: 1; transform: none; }
  }

  .empty { padding: 4px 6px; font-size: 11px; }

  /* Ambient, like the status line on the web dashboard: always there, never in
     the way, and it says the answer instead of making you go ask for it. */
  .service {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 4px;
    padding: 8px 6px;
    border-top: 1px solid color-mix(in srgb, var(--vscode-foreground) 9%, transparent);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
  }
  .service:hover { color: var(--vscode-foreground); }
  .service svg { width: 13px; height: 13px; flex: none; fill: currentColor; }
  .service.ok { color: var(--vscode-testing-iconPassed, #3fb950); }
  .service.ok:hover { color: var(--vscode-testing-iconPassed, #3fb950); }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }
  `;
}
