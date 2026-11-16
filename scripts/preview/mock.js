// Stands in for VS Code in scripts/preview/index.html: the theme class on
// <body>, acquireVsCodeApi() and mock data for the gallery; with
// ?view=sidebar&state=..., for the sidebar; with ?view=app&tab=...&state=
// default|restoring|scope|week-plan|week-served|stopped, for the app panel,
// whose RPC methods answer from APP_RPC below. The Files tab also takes
// state=empty; the Network tab (tab=network.<section>)
// state=empty|nonweb|nodomain|plan. ?view=database|workspace|blob open the
// other panels (workspace: state=member; blob: state=uploading|noplan|scope);
// the sidebar's state=mcp offers the reconnect. Runs before dist/webview.js.

const THEMES = {
  dark: "vscode-dark",
  light: "vscode-light",
  hc: "vscode-high-contrast",
  "hc-light": "vscode-high-contrast-light",
};
const params = new URLSearchParams(location.search);
const theme = THEMES[params.get("theme")] ? params.get("theme") : "dark";
const sidebar = params.get("view") === "sidebar";
document.body.className = `${THEMES[theme]} ${sidebar ? "surface-sidebar" : "surface-editor"}`;
for (const link of document.querySelectorAll(".preview-bar a")) {
  const next = new URLSearchParams(params);
  next.set("theme", new URLSearchParams(link.search).get("theme"));
  if (next.get("theme") === theme) link.setAttribute("aria-current", "page");
  link.search = `?${next}`;
}
if (params.has("clean")) document.querySelector(".preview-bar")?.remove();

let persisted;
window.acquireVsCodeApi = () => ({
  // No host here: a panel's methods answer from PANEL_RPC; anything
  // else fails the way an unknown method does.
  postMessage(message) {
    if (message.type !== "rpc") return;
    const answer = PANEL_RPC[params.get("view")]?.[message.method]
      ? PANEL_RPC[params.get("view")][message.method](message.params ?? {})
      : {
          error: {
            status: 0,
            code: "PREVIEW",
            message: "No host in the preview",
          },
        };
    setTimeout(
      () =>
        window.postMessage({ type: "rpc-result", id: message.id, ...answer }),
      30,
    );
  },
  getState: () => persisted,
  setState: (state) => {
    persisted = state;
  },
});

// A deterministic wobble, so screenshots stay the same between runs.
const wave = (i, base, amp) =>
  base + amp * Math.sin(i / 3) + (amp / 2) * Math.sin(i / 1.3);

const now = Date.UTC(2026, 10, 15, 15, 0);
const metrics = Array.from({ length: 49 }, (_, i) => ({
  t: now - (48 - i) * 30 * 60 * 1000,
  cpu: Math.max(0.1, wave(i, 0.9, 0.5) + (i > 30 && i < 36 ? 2.4 : 0)),
  ram: Math.round(wave(i, 122, 9)),
}));

const ESC = "\x1b";
const log = [
  ["15:02:11", `${ESC}[32m✓${ESC}[0m Connected to the database`],
  ["15:02:11", "Loaded 14 commands"],
  ["15:02:12", `${ESC}[1mmy-bot${ESC}[22m ready on ${ESC}[36mport 80${ESC}[0m`],
  ["15:04:37", `${ESC}[33mwarn${ESC}[0m  Slow query: guild_settings (812 ms)`],
  [
    "15:05:02",
    `${ESC}[31merror${ESC}[0m Unhandled rejection: fetch failed`,
    true,
  ],
  ["15:05:02", "    at async Client.login (src/index.js:41:5)", true],
  ["15:05:09", `${ESC}[90mRetrying in 5 s${ESC}[0m`],
  ["15:05:14", `${ESC}[32m✓${ESC}[0m Logged in as my-bot#2048`],
];

/** The app's variables: the panel gets the names, a value on request. */
const ENVS = {
  DISCORD_TOKEN: "MTA0Mj.k3Yp9Q.x7Vb2rTqL",
  DATABASE_URL: "postgres://bot@main-pg:5432/bot",
  NODE_ENV: "production",
  GREETING: "'hello world'",
};

const gallery = {
  view: "gallery",
  l10n: {},
  initial: {
    cpu: metrics.slice(-24).map((m) => Number(m.cpu.toFixed(2))),
    metrics,
    logs: log.map(([time, text, stderr], id) => ({ id, time, text, stderr })),
    envs: [
      { key: "DISCORD_TOKEN", value: "MTA0Mj.k3Yp9Q.x7Vb2rTqL" },
      { key: "DATABASE_URL", value: "postgres://bot@main-pg:5432/bot" },
      { key: "NODE_ENV", value: "production" },
    ],
    snapshots: [
      { id: "s1", created: "2026-11-15 03:00", size: 48_365_158 },
      { id: "s2", created: "2026-11-14 03:00", size: 47_931_442 },
      { id: "s3", created: "2026-11-13 03:00", size: 46_102_016 },
    ],
    apps: [
      {
        id: "a1",
        name: "my-bot",
        runtime: "js",
        tone: "green",
        status: "Online",
        usage: "0.4% · 120 MB",
      },
      { id: "a2", name: "site", runtime: "py", tone: "red", status: "Offline" },
      {
        id: "a3",
        name: "api-gateway",
        runtime: "go",
        tone: "green",
        status: "Online",
        usage: "1.8% · 64 MB",
      },
      {
        id: "a4",
        name: "worker",
        runtime: "rs",
        tone: "amber",
        status: "Starting",
      },
      {
        id: "a5",
        name: "dashboard",
        runtime: "js",
        tone: "green",
        status: "Online",
        usage: "0.2% · 210 MB",
      },
      {
        id: "a6",
        name: "cron-jobs",
        runtime: "py",
        tone: "muted",
        status: "Unknown",
      },
    ],
  },
};
// The sidebar in each state the extension can put it in.
const app = (id, name, type, status, cpu, ram, extra) => ({
  id,
  name,
  type,
  status,
  ...(cpu ? { cpu, ram } : {}),
  ...extra,
});
const account = {
  account: { name: "Alex Rivera", plan: "pro", ramUsed: 1229, ramLimit: 4096 },
  workspaces: [
    { id: "w1", name: "Acme team", owner: true },
    { id: "w2", name: "Side projects", owner: false },
  ],
  workspace: null,
  apps: [
    app("a1", "my-bot", "javascript", "online", "0.4%", "120.4MB", {
      favorite: true,
    }),
    app("a2", "api-gateway", "go", "online", "1.8%", "64.2MB", {
      website: true,
    }),
    app("a3", "billing", "java", "online", "2.6%", "412MB"),
    app("a4", "cron-jobs", "python", "unknown"),
    app("a5", "dashboard", "typescript", "online", "0.2%", "210MB", {
      website: true,
    }),
    app("a6", "docs", "static", "online", "0.0%", "18MB", { website: true }),
    app("a7", "image-resizer", "rust", "offline"),
    app("a8", "invoices", "php", "online", "0.7%", "96MB", { website: true }),
    app("a9", "mailer", "elixir", "offline"),
    app("a10", "metrics-agent", "csharp", "online", "0.3%", "88MB"),
    app("a11", "ruby-api", "ruby", "online", "1.1%", "154MB"),
    app("a12", "worker", "kotlin", "offline"),
  ],
  databases: [
    app("d1", "cache", "redis", "online", "0.1%", "24MB"),
    app("d2", "events", "mongo", "offline"),
    app("d3", "main-pg", "postgres", "online", "0.3%", "180MB"),
  ],
  blob: { storage: 3435973837, objects: 1204 },
  service: { summary: "online", incidents: [] },
  updatedAt: now,
};
const SIDEBAR = {
  "signed-in": account,
  "signed-out": { signIn: { step: "choose", reconnecting: false } },
  waiting: {
    signIn: {
      step: "waiting",
      code: "A7F3C21B",
      expiresAt: now + 10 * 60_000,
      reconnecting: false,
    },
  },
  degraded: {
    ...account,
    service: {
      summary: "degraded",
      incidents: [
        { title: "Elevated API latency", status: "degraded" },
        {
          title: "Planned maintenance on example-cluster",
          status: "maintenance",
        },
      ],
    },
  },
  empty: {
    ...account,
    account: { name: "Alex Rivera", plan: "hobby", ramUsed: 0, ramLimit: 2048 },
    workspaces: [],
    apps: [],
    databases: [],
    blob: null,
  },
  problem: {
    problem: { kind: "offline", at: now },
    service: { summary: "unknown", incidents: [] },
  },
  loading: {},
  mcp: { ...account, mcpReconnect: true },
};
const empty = {
  workspaces: [],
  workspace: null,
  apps: [],
  databases: [],
  blob: null,
};

// The app panel. Hourly or 5-minute points, newest first, like the API.
const MB = 1024 * 1024;
const appState = params.get("state") ?? "default";
const appId = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
function points(hours, stepMin, weekly) {
  const count = Math.floor((hours * 60) / stepMin);
  let net = [0, 0];
  let disk = [0, 0];
  const out = [];
  for (let i = 0; i <= count; i++) {
    const t = now - (count - i) * stepMin * 60_000;
    // A restart two thirds in: the counters start over.
    if (i === Math.floor(count * 0.66)) {
      net = [0, 0];
      disk = [0, 0];
    }
    net = [
      net[0] + Math.round(wave(i, 1300, 500) * stepMin * 60),
      net[1] + Math.round(wave(i, 380, 160) * stepMin * 60),
    ];
    disk = [
      disk[0] + Math.round(wave(i, 40_000, 20_000)),
      disk[1] + Math.round(wave(i, 90_000, 40_000)),
    ];
    const cpu = Math.max(0.1, wave(i / 2, 0.9, 0.5) + (i % 37 === 5 ? 2.4 : 0));
    const ram = Math.round(wave(i / 3, 122, 9));
    out.push({
      date: new Date(t).toISOString(),
      cpu: Number(cpu.toFixed(2)),
      ram,
      net: [...net],
      disk: [...disk],
      storage: Math.round((80 + (i / count) * 4) * MB),
      ...(weekly
        ? { cpu_max: Number((cpu * 2.6).toFixed(2)), ram_max: ram + 30 }
        : {}),
    });
  }
  return out.reverse();
}
const ok = (result) => ({ result });
const fail = (status, code, message) => ({ error: { status, code, message } });
const snapshot = (when, size, version, origin) => ({
  name: `${appId}_javascript_${origin}`,
  size,
  modified: when,
  version_id: version,
  runtime: "javascript",
  origin,
});
const APP_RPC = {
  info: () =>
    ok({
      id: appId,
      name: "my-bot",
      desc: "Discord bot for the Acme community server.",
      lang: "javascript",
      ram: 512,
      cluster: "example-cluster",
      domain:
        appState === "nonweb"
          ? null
          : appState === "nodomain"
            ? "my-bot.squareweb.app"
            : "shop.example.com",
      subdomain: appState === "nonweb" ? null : "my-bot.squareweb.app",
      custom:
        appState === "nonweb" || appState === "nodomain"
          ? null
          : "shop.example.com",
      createdAt: "2026-03-02T14:20:00Z",
      week: appState === "week-plan" ? "plan" : "on",
    }),
  "live.start": () => ok(undefined),
  logs: () => ok(log.map(([, text]) => text).join("\n")),
  metrics: ({ range }) =>
    ok(
      range === "7d" && appState !== "week-served"
        ? points(24 * 7, 60, true)
        : points(24, 5, false),
    ),
  snapshots: () =>
    ok([
      snapshot(
        "2026-11-15T13:42:00Z",
        48_365_158,
        "3HL4kqtJlcpXroDT",
        "manual",
      ),
      snapshot(
        "2026-11-15T03:00:00Z",
        47_931_442,
        "8sKd02LmQpWx7Zr1",
        "automatic",
      ),
      snapshot(
        "2026-11-14T03:00:00Z",
        46_102_016,
        "Qw3Er5Ty7Ui9Op1A",
        "automatic",
      ),
      snapshot(
        "2026-11-13T03:00:00Z",
        45_870_220,
        "Zx8Cv6Bn4Mm2Ll0K",
        "automatic",
      ),
    ]),
  "snapshots.restoreState": () =>
    ok(
      appState === "restoring"
        ? { state: "running", step: "unzip", started_at: now - 40_000 }
        : { state: "none" },
    ),
  envs: () =>
    appState === "scope"
      ? fail(
          403,
          "MISSING_SCOPE",
          window.__PREVIEW_L10N?.["apiError.MISSING_SCOPE"] ?? "MISSING_SCOPE",
        )
      : ok(Object.keys(ENVS)),
  "envs.reveal": ({ key }) => ok(ENVS[key] ?? null),
  "envs.copy": () => ok(undefined),
  deploys: () =>
    ok({
      current: {
        app: { id: 1, name: "acme/my-bot", branch: "main" },
        webhook: "https://api.squarecloud.app/v2/git/webhook/9f8e7d6c5b4a",
      },
      history: [
        [
          { id: "4f2a9c1e7b", state: "pending", date: "2026-11-15T12:10:00Z" },
          {
            id: "4f2a9c1e7b",
            state: "clone",
            date: "2026-11-15T12:10:04Z",
            branch: "main",
          },
          {
            id: "4f2a9c1e7b",
            state: "commit",
            date: "2026-11-15T12:10:09Z",
            files: {
              added: ["src/ping.js"],
              removed: [],
              modified: ["src/index.js", "package.json"],
            },
          },
          { id: "4f2a9c1e7b", state: "success", date: "2026-11-15T12:10:20Z" },
        ],
        [
          {
            id: "b71d03e5aa",
            state: "clone",
            date: "2026-11-14T18:31:00Z",
            branch: "main",
          },
          {
            id: "b71d03e5aa",
            state: "error",
            date: "2026-11-14T18:31:07Z",
            code: "CLONE_FAILED",
            message: "Branch main was not found",
          },
        ],
        [
          {
            id: "09cc5e12f4",
            state: "clone",
            date: "2026-11-12T09:02:00Z",
            branch: "main",
          },
          { id: "09cc5e12f4", state: "success", date: "2026-11-12T09:02:30Z" },
        ],
      ],
    }),
};
// The Files tab: a small tree, read a folder at a time.
const file = (name, size, minutesAgo) => ({
  name,
  type: "file",
  size,
  lastModified: now - minutesAgo * 60_000,
});
const dir = (name) => ({ name, type: "directory" });
const TREE = {
  "/": [
    dir("node_modules"),
    dir("public"),
    dir("src"),
    file(".gitignore", 64, 60 * 24 * 30),
    file("package-lock.json", 182_311, 60 * 26),
    file("package.json", 1_204, 60 * 26),
    file("README.md", 3_870, 60 * 24 * 9),
    file("squarecloud.app", 142, 60 * 24 * 9),
  ],
  "/src": [
    dir("commands"),
    dir("events"),
    file("config.json", 512, 95),
    file("index.js", 4_391, 12),
  ],
  "/src/commands": [
    file("help.js", 2_112, 60 * 50),
    file("ping.js", 830, 60 * 50),
  ],
  "/src/events": [],
  "/public": [file("banner.png", 14_680_064, 60 * 24 * 40)],
};

// The Network tab: a day of hourly edge data, in the API's shapes.
const hourly = (n, fn) =>
  Array.from({ length: n }, (_, i) =>
    fn(i, new Date(now - (n - 1 - i) * 3600_000).toISOString()),
  );
const bucket = (type, requests, visits = Math.round(requests / 3)) => ({
  type,
  requests,
  visits,
  bytes: requests * 18_400,
});
const ANALYTICS = {
  visits: hourly(24, (i, date) => [
    // Desktop and mobile come as separate rows of the same hour.
    {
      date,
      visits: Math.round(wave(i, 120, 50) * (i > 8 && i < 20 ? 1.6 : 1)),
      requests: Math.round(wave(i, 900, 300) * (i > 8 && i < 20 ? 1.6 : 1)),
      bytes: Math.round(wave(i, 22e6, 8e6)),
      bytes_in: Math.round(wave(i, 1.4e6, 6e5)),
    },
    {
      date,
      visits: Math.round(wave(i + 3, 60, 25)),
      requests: Math.round(wave(i + 3, 380, 120)),
      bytes: Math.round(wave(i + 3, 9e6, 3e6)),
      bytes_in: Math.round(wave(i + 3, 4e5, 2e5)),
    },
  ]).flat(),
  countries: [
    bucket("BR", 14_210),
    bucket("US", 6_904),
    bucket("PT", 2_311),
    bucket("DE", 1_480),
    bucket("JP", 702),
    bucket("T1", 88),
    bucket("XX", 41),
  ],
  paths: [
    bucket("/", 9_820),
    bucket("/api/guilds", 6_112),
    bucket("/api/commands", 3_044),
    bucket("/assets/app.js", 2_960),
    bucket("/login", 1_204),
    bucket("/wp-login.php", 312),
  ],
  referers: [
    bucket("Direct", 15_023),
    bucket("google.com", 5_310),
    bucket("discord.com", 3_402),
    bucket("github.com", 960),
  ],
  providers: [
    bucket("CLARO S.A. (28573)", 8_120),
    bucket("GOOGLE (15169)", 2_340),
    bucket("COMCAST-7922 (7922)", 1_903),
  ],
  os: [
    bucket("Windows", 11_200),
    bucket("Android", 7_302),
    bucket("iOS", 3_120),
    bucket("macOS", 2_410),
    bucket("Linux", 704),
  ],
  browsers: [
    bucket("Chrome", 15_880),
    bucket("Safari", 3_904),
    bucket("Firefox", 2_140),
    bucket("Edge", 1_712),
  ],
  protocols: [
    bucket("HTTP/2", 17_420),
    bucket("HTTP/3", 5_940),
    bucket("HTTP/1.1", 2_376),
  ],
  status_codes: [
    bucket("200", 21_840),
    bucket("304", 2_410),
    bucket("301", 640),
    bucket("404", 1_102),
    bucket("403", 188),
    bucket("500", 64),
    bucket("502", 21),
  ],
  content_types: [
    bucket("html", 9_904),
    bucket("json", 9_216),
    bucket("js", 3_120),
    bucket("css", 1_740),
    bucket("image", 1_100),
  ],
  devices: [],
  methods: [],
  ips: [],
  bots: [],
};
const ERRORS = {
  summary: { total: 1_375, by_class: { "4xx": 1_290, "5xx": 85 } },
  by_status: [
    { status: 404, requests: 1_102 },
    { status: 403, requests: 188 },
    { status: 500, requests: 64 },
    { status: 502, requests: 21 },
  ],
  timeseries: hourly(24, (i, date) => ({
    date,
    buckets: {
      404: Math.round(wave(i, 46, 18)),
      403: Math.round(wave(i + 5, 8, 4)),
      500: i === 14 ? 31 : Math.max(0, Math.round(wave(i, 1.5, 1.5))),
      502: i === 15 ? 12 : 0,
    },
    total: 0,
  })),
  top_paths: [
    {
      path: "/wp-login.php",
      method: "GET",
      total: 612,
      by_status: { 404: 612 },
    },
    {
      path: "/api/guilds",
      method: "POST",
      total: 91,
      by_status: { 500: 64, 502: 21, 403: 6 },
    },
    { path: "/.env", method: "GET", total: 182, by_status: { 403: 182 } },
    {
      path: "/favicon.ico",
      method: "GET",
      total: 140,
      by_status: { 404: 140 },
    },
  ],
  by_method: [],
};
const ROUTES = [
  ["GET", "/", 200],
  ["GET", "/api/guilds", 200],
  ["POST", "/api/guilds", 201],
  ["GET", "/assets/app.js", 304],
  ["GET", "/wp-login.php", 404],
  ["GET", "/login", 301],
];
const LOGS = Array.from({ length: 36 }, (_, i) => {
  const [method, path, ok200] = ROUTES[i % ROUTES.length];
  const status = method === "POST" && i % 4 === 2 ? 500 : ok200;
  return {
    timestamp: new Date(now - i * 97_000).toISOString(),
    client: {
      ip: `203.0.113.${(i * 37) % 254}`,
      country: ["BR", "US", "PT", "DE", "BR", "JP"][i % 6],
      location: null,
      asn: "28573",
      agent: "Mozilla/5.0",
      category: null,
    },
    request: {
      mitigated: false,
      method,
      host: "shop.example.com",
      path,
      query: path === "/api/guilds" && method === "GET" ? "page=2" : null,
      protocol: "HTTP/2",
      referer: null,
    },
    response: {
      status,
      contentType: "html",
      cache: status === 304 ? "hit" : null,
    },
  };
});
const pct = (p50, p95, p99) => ({ p50, p95, p99 });
const PERFORMANCE = {
  summary: {
    edge: pct(38, 142, 388),
    origin: pct(61, 290, 812),
    requests: 25_736,
  },
  timeseries: hourly(24, (i, date) => ({
    date,
    requests: 1000,
    edge: pct(30, Math.round(wave(i, 140, 40)), 380),
    origin: pct(
      55,
      Math.round(wave(i + 2, 280, 90) + (i === 14 ? 420 : 0)),
      800,
    ),
  })),
  countries: [
    { type: "BR", p50: 32, p95: 120, requests: 14_210 },
    { type: "US", p50: 48, p95: 168, requests: 6_904 },
    { type: "PT", p50: 51, p95: 190, requests: 2_311 },
    { type: "JP", p50: 140, p95: 410, requests: 702 },
  ],
  colos: [],
  slowest_paths: [
    { path: "/api/guilds", p95: 1_240, p99: 2_870, requests: 6_112 },
    { path: "/api/commands", p95: 610, p99: 1_020, requests: 3_044 },
    { path: "/login", p95: 380, p99: 720, requests: 1_204 },
    { path: "/", p95: 190, p99: 412, requests: 9_820 },
  ],
};
const DNS = [
  {
    type: "cname",
    name: "shop.example.com",
    value: "my-bot.squareweb.app",
    status: "active",
  },
  {
    type: "txt",
    name: "_cf-custom-hostname.shop.example.com",
    value: "7a1f3c2e-9b4d-4e1a-8c55-2f0d6b9e1a77",
    status: "pending",
    errors: ["custom hostname does not CNAME to this zone."],
  },
  {
    type: "txt",
    name: "_acme-challenge.shop.example.com",
    value: "kX3nU0pQ9vW1yZ5aB7cD2eF4gH6iJ8lM0nO2pQ4rS6t",
    status: "pending",
  },
  {
    type: "cname",
    name: "_acme-challenge.shop.example.com",
    value: "shop.example.com.dcv.example-edge.net",
    status: "pending",
    fallback: true,
  },
];
const blank = appState === "empty";
const upgrade = () =>
  fail(
    403,
    "UPGRADE_REQUIRED",
    window.__PREVIEW_L10N?.["apiError.UPGRADE_REQUIRED"] ?? "UPGRADE_REQUIRED",
  );
Object.assign(APP_RPC, {
  "files.list": ({ path }) =>
    appState === "empty"
      ? ok([])
      : TREE[path]
        ? ok(TREE[path])
        : fail(404, "FILE_NOT_FOUND", "File not found."),
  "files.open": () => ok(undefined),
  "network.analytics": () => ok(blank ? null : ANALYTICS),
  "network.errors": ({ include4xx }) =>
    ok(
      blank
        ? null
        : include4xx
          ? ERRORS
          : {
              ...ERRORS,
              summary: { total: 85, by_class: { "4xx": 0, "5xx": 85 } },
              by_status: ERRORS.by_status.filter((s) => s.status >= 500),
              top_paths: ERRORS.top_paths.slice(1, 2),
            },
    ),
  "network.logs": () =>
    appState === "plan" ? upgrade() : ok(blank ? [] : LOGS),
  "network.performance": () =>
    appState === "plan" ? upgrade() : ok(blank ? null : PERFORMANCE),
  "network.dns": () => ok(blank ? [] : DNS),
});
const appBoot = {
  view: "app",
  l10n: window.__PREVIEW_L10N ?? {},
  initial: {
    id: appId,
    tab: params.get("tab") ?? "overview",
    stream: appState === "stopped" ? { state: "off" } : { state: "live" },
    live:
      appState === "stopped"
        ? { running: false, storage: 84 * MB, at: now }
        : {
            running: true,
            restoring: appState === "restoring",
            cpu: 0.4,
            ramUsed: 120,
            ramLimit: 512,
            netIn: 1228,
            netOut: 307,
            storage: 84 * MB,
            uptime: now - 3 * 3600_000,
            at: now,
          },
  },
  brand: "../../resources/brand",
};
if (params.get("view") === "app")
  // A live batch after the history, as the stream would send it.
  setTimeout(
    () =>
      window.postMessage({
        type: "event",
        view: "app",
        name: "logs",
        data: {
          replay: false,
          lines: [
            {
              text: `${ESC}[36mGET${ESC}[0m /health 200 2ms`,
              at: now + 61_000,
            },
            { text: "Heartbeat ok (42 ms)", at: now + 62_000 },
          ],
        },
      }),
    400,
  );

// The database panel (?view=database&tab=...): a running Postgres.
const dbId = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
const DATABASE_RPC = {
  info: () =>
    ok({
      id: dbId,
      name: "main-pg",
      type: "postgres",
      ram: 1024,
      port: 7091,
      cluster: "example-cluster",
      createdAt: "2026-04-18T09:12:00Z",
      host: `square-cloud-db-${dbId}.squareweb.app`,
      user: "squarecloud",
      url: `postgresql://squarecloud:<password>@square-cloud-db-${dbId}.squareweb.app:7091`,
      week: "on",
      ramMin: 1024,
      ramMax: 3891,
    }),
  status: () =>
    ok({
      running: appState !== "stopped",
      cpu: 0.3,
      ram: 180,
      storage: 412 * MB,
      network: [2048, 5120],
      uptime: appState === "stopped" ? null : now - 26 * 3600_000,
    }),
  metrics: APP_RPC.metrics,
  snapshots: APP_RPC.snapshots,
  "snapshots.restoreState": APP_RPC["snapshots.restoreState"],
  copy: () => ok(undefined),
  reset: () => ok(undefined),
  action: () => ok(undefined),
  // The preview's made-up password; the host keeps the real one to itself.
  secret: ({ mode, what }) =>
    ok(
      mode !== "reveal"
        ? null
        : what === "url"
          ? `postgresql://squarecloud:Vq7mR2xK9pLt4sWz@square-cloud-db-${dbId}.squareweb.app:7091`
          : "Vq7mR2xK9pLt4sWz",
    ),
};

// The workspace panel (?view=workspace&tab=...&state=owner|member).
const wsOwner = appState !== "member";
const WORKSPACE = {
  id: "w1",
  name: "Acme team",
  createdAt: "2026-02-10T12:00:00Z",
  owner: wsOwner,
  you: wsOwner ? "u1" : "u3",
  members: [
    {
      id: "u1",
      name: "Alex Rivera",
      group: "owner",
      joinedAt: "2026-02-10T12:00:00Z",
    },
    {
      id: "u2",
      name: "Sam Okafor",
      group: "admin",
      joinedAt: "2026-02-14T16:40:00Z",
    },
    {
      id: "u3",
      name: "Mia Chen",
      group: "maintain",
      joinedAt: "2026-05-03T08:15:00Z",
    },
    {
      id: "u4",
      name: "Jordan Lee",
      group: "view",
      joinedAt: "2026-09-21T19:02:00Z",
    },
    {
      id: "u5",
      name: null,
      group: "manager",
      joinedAt: "2026-03-01T10:00:00Z",
    },
  ],
  apps: [
    { id: "a1", name: "my-bot", lang: "javascript", ram: 512, mine: wsOwner },
    { id: "a2", name: "api-gateway", lang: "go", ram: 256, mine: wsOwner },
    { id: "a9", name: "landing", lang: "static", ram: 128, mine: false },
  ],
  yours: [
    { id: "a3", name: "billing", lang: "java" },
    { id: "a5", name: "dashboard", lang: "typescript" },
  ],
};
const WORKSPACE_RPC = {
  info: () => ok(WORKSPACE),
  invite: () => ok("SQ-7K2M-9QXA"),
  copy: () => ok(undefined),
};

// The Blob panel (?view=blob&state=default|uploading|noplan|scope).
const blobUrl = (name) => `https://public-blob.squarecloud.dev/u1/${name}`;
const object = (name, size, minutesAgo, extra) => ({
  id: `u1/${name}`,
  name: name.slice(name.lastIndexOf("/") + 1),
  size,
  createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
  private: false,
  url: blobUrl(name),
  ...extra,
});
const BLOB_TREE = {
  "": {
    folders: ["avatars/", "backups/", "docs/"],
    objects: [
      object("logo.svg", 18_204, 35),
      object("hero.webp", 412_880, 220),
      object("invoice-2026-10.pdf", 96_512, 1_440, {
        private: true,
        url: null,
      }),
      object("export.csv", 2_481_920, 4_320, {
        expiresAt: new Date(now + 6 * 86_400_000).toISOString(),
      }),
    ],
  },
  "docs/": {
    folders: ["docs/2026/"],
    objects: [object("docs/handbook.pdf", 1_204_224, 9_000)],
  },
};
const BLOB_RPC = {
  stats: () =>
    appState === "scope"
      ? fail(403, "MISSING_SCOPE", "")
      : ok({
          storage: appState === "noplan" ? 0 : 3_435_973_837,
          objects: appState === "noplan" ? 0 : 1_204,
          included: appState === "noplan" ? 0 : 10 * 1024 ** 3,
          plan: appState !== "noplan",
        }),
  list: ({ prefix }) => ok(BLOB_TREE[prefix] ?? { folders: [], objects: [] }),
  info: ({ id }) => {
    const found = Object.values(BLOB_TREE)
      .flatMap((page) => page.objects)
      .find((o) => o.id === id);
    return found
      ? ok({
          ...found,
          contentType: "image/svg+xml",
          expiresAt: found.expiresAt ?? null,
          originalName: "Acme logo (final).svg",
        })
      : fail(404, "OBJECT_NOT_FOUND", "Object not found.");
  },
  copy: () => ok(undefined),
};
if (params.get("view") === "blob" && appState === "uploading")
  // A finished file, a large one going up in parts, and one waiting.
  setTimeout(() => {
    for (const data of [
      {
        key: "1",
        name: "release-notes.md",
        sent: 8_204,
        total: 8_204,
        state: "done",
      },
      {
        key: "2",
        name: "backup-2026-11-15.tar.gz",
        sent: 141 * MB,
        total: 312 * MB,
        state: "sending",
      },
      {
        key: "3",
        name: "screenshot.png",
        sent: 0,
        total: 640_118,
        state: "queued",
      },
      {
        key: "4",
        name: "tiny.txt",
        sent: 0,
        total: 120,
        state: "error",
        message:
          window.__PREVIEW_L10N?.["apiError.FILE_TOO_SMALL"] ??
          "FILE_TOO_SMALL",
      },
    ])
      window.postMessage({ type: "event", view: "blob", name: "upload", data });
  }, 300);

const PANEL_RPC = {
  app: APP_RPC,
  database: DATABASE_RPC,
  workspace: WORKSPACE_RPC,
  blob: BLOB_RPC,
};
const panelBoot = (view, id, tab) => ({
  view,
  l10n: window.__PREVIEW_L10N ?? {},
  initial: { id, tab },
  brand: "../../resources/brand",
});

// No strings in a file:// page: the screenshot script injects package.nls.json
// as window.__PREVIEW_L10N; opened by hand, the sidebar shows its keys.
const view = params.get("view");
const boot =
  view === "app"
    ? appBoot
    : view === "database"
      ? panelBoot(view, dbId, params.get("tab") ?? "overview")
      : view === "workspace"
        ? panelBoot(view, "w1", params.get("tab") ?? "members")
        : view === "blob"
          ? panelBoot(view, "account")
          : sidebar
            ? {
                view: "sidebar",
                l10n: window.__PREVIEW_L10N ?? {},
                initial: {
                  ...empty,
                  ...SIDEBAR[params.get("state") ?? "signed-in"],
                },
                brand: "../../resources/brand",
              }
            : gallery;
document.getElementById("sq-boot").textContent = JSON.stringify(boot);
