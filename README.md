<div align="center">
  <img alt="Square Cloud Banner" src="https://cdn.squarecloud.app/png/github-readme.png">
</div>

<h1 align="center">Square Cloud for VSCode</h1>

<p align="center">
  Deploy, manage and monitor your <a href="https://squarecloud.app" target="_blank">Square Cloud</a> applications, databases and workspaces — without leaving the editor.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=squarecloud.squarecloud"><img alt="VS Marketplace" src="https://badgen.net/vs-marketplace/v/squarecloud.squarecloud?label=VS%20Marketplace&color=blue"></a>
  <a href="https://open-vsx.org/extension/squarecloud/squarecloud"><img alt="Open VSX" src="https://img.shields.io/open-vsx/v/squarecloud/squarecloud?label=Open%20VSX&color=purple"></a>
  <a href="https://github.com/squarecloudofc/vscode-extension/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-green"></a>
</p>

---

## Table of contents

- [Getting started](#getting-started)
- [Deploying from VSCode](#deploying-from-vscode)
  - [Upload a new application](#upload-a-new-application)
  - [Commit changes to an existing application](#commit-changes-to-an-existing-application)
  - [Ignore rules](#ignore-rules)
- [Managing applications](#managing-applications)
  - [Lifecycle & status](#lifecycle--status)
  - [Logs](#logs)
  - [Realtime stream](#realtime-stream)
  - [Metrics](#metrics)
  - [Snapshots](#snapshots)
  - [Environment variables](#environment-variables)
  - [GitHub App integration](#github-app-integration)
  - [Edge network tools](#edge-network-tools-website-applications)
- [Databases](#databases)
- [Workspaces](#workspaces)
- [Service status & status bar](#service-status--status-bar)
- [Configuration file IntelliSense](#configuration-file-intellisense)
- [Command reference](#command-reference)
- [Settings](#settings)
- [Localisation](#localisation)
- [Activation & performance](#activation--performance)
- [Rate limits](#rate-limits)
- [Security & privacy](#security--privacy)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Getting started

1. Install **Square Cloud** from the [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=squarecloud.squarecloud) or [Open VSX](https://open-vsx.org/extension/squarecloud/squarecloud).
2. Click the **Square Cloud** icon in the activity bar and press **Connect account** — or run `Square Cloud: Connect account` from the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Approve it in the browser. The side bar shows an eight-character code and copies it to your clipboard; the approval page asks for it. **Only approve if the code on the page matches the one in your editor** — that check is what stops someone else's approval from linking your editor to their account.
4. Done. The side bar confirms which account you connected as, then loads your applications, databases and workspaces.

The extension gets an authorization of its own — scoped to what it actually uses, valid for **90 days**, and revocable at any time under **Account → Security** in the dashboard. You never paste your account's master key.

If you'd rather use a token created by hand in the dashboard (a machine without a browser, for instance), **Other ways to sign in** takes it. Either way the secret is stored in the OS keychain via VSCode's `SecretStorage` — never written to disk in plaintext. If you used a previous version with the legacy `auth.json` file, it's migrated automatically on first run.

---

## Deploying from VSCode

### Upload a new application

`Square Cloud: Upload new application` — available from the command palette or the cloud-upload icon in the **Applications** view title bar.

The flow, end to end:

1. **Pick a folder.** Your open workspace folders are offered first (the common case: deploy the project you're editing). Choose **Browse...** to pick any other folder from disk.
2. **Config validation.** The folder must contain a [`squarecloud.app` / `squarecloud.config`](https://docs.squarecloud.app/getting-started/config-file) file. If it's missing, you get an error with a one-click link to the documentation — nothing is uploaded.
3. **Ignore rules applied.** Files matching the built-in defaults (`node_modules`, `.git`, caches, …) plus your project's `squarecloud.ignore` (or `.gitignore` as a fallback) are excluded. See [Ignore rules](#ignore-rules).
4. **Zip & upload.** The folder is compressed in memory with live file-count progress — cancellable at any point. Zips are limited to 100 MB; oversized bundles fail fast with a hint to extend your ignore file, before any bytes leave your machine.
5. **Done.** The success toast shows the detected runtime (language and version) and offers **Open dashboard** and **Copy ID** shortcuts. The Applications view refreshes automatically.

If the config file declares a `SUBDOMAIN`, the application is reachable at `https://<subdomain>.squareweb.app` once it starts.

### Commit changes to an existing application

Right-click an application → **Commit**. Pick a single file or a whole folder; folders are zipped with the same ignore handling as upload. You choose whether to restart the application after the commit — the status refreshes automatically either way.

**Upload vs Commit:** *Upload* creates a brand-new application (new ID, new plan slot). *Commit* pushes files into an application that already exists, preserving its ID, domain and configuration.

### Ignore rules

When zipping (upload and folder commits), exclusions are resolved in this order:

1. **Built-in defaults** — `node_modules`, `.git`, `__pycache__`, common caches and build artifacts.
2. **`squarecloud.ignore`** in the project root, if present — same syntax as `.gitignore`.
3. **`.gitignore`** as a silent fallback when no `squarecloud.ignore` exists.

If everything in the folder ends up ignored, the upload aborts with an explicit "empty folder" error instead of shipping an empty zip.

---

## Managing applications

The side bar lists every app on your account with a live status dot and its current CPU and RAM. Click a row to expand its ID, memory, runtime, cluster, domain and uptime. Hovering a row reveals start/stop, restart and logs; the star marks a favourite and pins it to the top. **Right-click a row — or use its ⋯ button — for the full action menu**, grouped by purpose, with destructive actions kept apart at the bottom.

Actions the extension can already tell will fail are not offered at all: edge analytics only appear for applications that serve a domain, and metrics only above 512 MB.

### Lifecycle & status

**Start**, **Stop** and **Restart** from the row itself or the action menu. After each action the extension follows the status until it actually changes — checking at 600ms, 1.8s and 4s, and stopping as soon as it flips — so a stopped application reads as stopped almost immediately. Statuses for all apps are polled in the background (see [Activation & performance](#activation--performance)).

### Logs

**Show logs** fetches the latest application logs into a dedicated per-app output channel with ANSI colors preserved. Each fetch is on demand — nothing streams in the background.

### Realtime stream

**Toggle realtime stream** opens a live Server-Sent Events feed of your application into an output channel. Toggle the same command again to stop it.

- The platform allows up to **5 concurrent streams** per account. When the cap is reached, the refusal is surfaced as a clear message instead of a silent failure.
- Server-side, each connection lives about 10 minutes. When that TTL closes the stream, the extension **reconnects automatically** after a short pause — you'll see a `[Reconnecting...]` marker in the channel. Stopping the stream yourself never reconnects, and streams that are refused or die immediately are not retried in a loop.
- The stream multiplexes log lines with resource metrics (cpu, ram, network, several frames a second). Only your application's own output is printed — the metrics are filtered out so they don't bury it.
- All streams are cleanly closed when the extension shuts down.

### Metrics

**Show 24h metrics** renders the last 24 hours of CPU / RAM / network samples (288 points, one every 5 minutes) into an output channel. Requires the application to have at least 512 MB of RAM.

### Snapshots

- **Snapshot** — generates a fresh snapshot of the application and saves the zip wherever you choose.
- **Restore snapshot** — lists your stored snapshots (newest first, with size) and restores the selected one after confirmation.
- **Delete** — before an application is deleted, the extension automatically takes a recovery snapshot and offers a **Download snapshot** button afterwards, so a mistaken delete is never fatal.

Snapshot creation is quota-limited per plan per day; hitting a limit surfaces a clear rate-limit message rather than a cryptic error.

### Environment variables

**Environment variables** opens a QuickPick-based manager: list all variables, add new ones (with key-format validation), edit a value, delete one, or wipe them all (with confirmation). Changes apply immediately via the API.

### GitHub App integration

**Link GitHub App repository** connects a repository (`owner/repo` + branch) for automatic deploys on push. **Unlink** removes the connection. Requires the [Square Cloud GitHub App](https://docs.squarecloud.app) to be installed on your GitHub account.

### Edge network tools (website applications)

For applications with a domain, the context menu exposes the edge analytics suite:

- **Edge errors** — aggregated 4xx/5xx breakdown for a chosen time range (1h / 6h / 24h / 7d).
- **Edge logs** — per-request edge logs.
- **Edge performance** — latency and cache performance summaries.
- **Purge edge cache** — invalidates the entire edge cache after confirmation.

Non-website applications get a friendly "no domain" message instead of an API error.

---

## Databases

The **Databases** section lists your managed databases with engine and memory. Right-click one, or use its ⋯ button, for:

- **Create database** — guided flow: name → engine (**MongoDB**, **MySQL**, **Redis**, **PostgreSQL**) → memory → version. The version picker suggests the versions currently accepted by the platform, with an **Other version...** escape hatch for typing any value.
- **One-time credentials** — the connection URL (password embedded) is copied to your clipboard immediately after creation, and a **Copy password** button is offered — these credentials are shown **only once** by the platform and cannot be retrieved later.
- **Start / Stop** — lifecycle control from the action menu.
- **Download TLS certificate** — saves the bundle as `.pem` (raw), plus split `.crt` and `.key` files when present.
- **Delete** — requires typing the database name to confirm.

Databases require a paid plan; the extension surfaces a clear upgrade message if your plan doesn't include them.

---

## Workspaces

The **Workspaces** section shows every workspace you own or joined, with its member and application counts. Right-click one, or use its ⋯ button, for:

- **Create workspace** — name prompt with validation.
- **Generate invite code** — copies a 5-minute invite code to your clipboard.
- **Leave workspace** — for workspaces you're a member of.
- **Delete workspace** — type-the-name confirmation, owners only.

---

## Service status & status bar

- Platform health sits in the **footer of the side bar**, always visible — green when everything is operational. Click it for the detail and a one-click link to the [status page](https://status.squarecloud.app/).
- A **status bar item** shows at a glance: whether an account is connected, how many applications are online vs total, and a warning when Square Cloud reports degraded service health. Click it to force a refresh.

---

## Configuration file IntelliSense

`squarecloud.app` and `squarecloud.config` files get full editor support — no JSON schema or external language server required.

### Inline diagnostics

- Missing required keys (`MAIN`, `VERSION`, `MEMORY`, `DISPLAY_NAME`) underlined as errors.
- Duplicate keys flagged on the second occurrence.
- Value bounds: `DISPLAY_NAME ≤ 32`, `DESCRIPTION ≤ 280`, `START ≤ 256`, `SUBDOMAIN ≤ 63` characters.
- `MAIN` resolves the referenced file against the workspace and warns if it doesn't exist, is outside the project, or sits inside `node_modules` / `__pycache__` / dotfiles.
- `MEMORY` validates against the official minimum (256 MB bot / 512 MB site) **and** your plan's available memory — the diagnostic ships with an "Upgrade plan" link when you exceed your quota.
- `SUBDOMAIN` rejects characters outside `[a-zA-Z0-9-]`.
- `RUNTIME` validates against the 15 accepted aliases from the docs (`nodejs`, `javascript`, `typescript`, `python`, `dotnet`, `csharp`, `c#`, `java`, `elixir`, `rust`, `php`, `go`, `golang`, `static`, `html`).
- `VERSION` accepts `recommended` or `latest`.
- `MAIN` becomes optional automatically when `START` is set, matching the docs.

### Auto-completion

- Key suggestions on empty lines — required fields pinned to the top.
- Triggered on `=`:
  - `MAIN=` lists every file in the workspace matching a runtime-aware extension allowlist.
  - `RUNTIME=` shows all valid runtime aliases.
  - `VERSION=` shows `recommended` / `latest`.
  - `AUTORESTART=` shows `true` / `false`.
  - `MEMORY=` shows tier-aware presets (256 MB, 512 MB, 1 GB, 2 GB, …) and automatically hides values under 512 MB once `SUBDOMAIN` is declared.

### Quick-fixes

Lightbulb actions on diagnostics for `AUTORESTART`, `VERSION` and `RUNTIME` insert a valid value with one click.

### Syntax highlighting & file icons

Custom file icons for `squarecloud.app`, `squarecloud.config` and `squarecloud.ignore`, plus a TextMate grammar for keyword/value coloring.

---

## Command reference

Palette commands (prefix **Square Cloud:**):

| Command | ID | Where |
|---|---|---|
| Connect account | `squarecloud.setApiKey` | Command palette, sign-in view |
| Disconnect account | `squarecloud.logout` | Command palette, side bar title menu |
| Upload new application | `squarecloud.uploadApplication` | Command palette, side bar title bar |
| Show service status | `squarecloud.showServiceStatus` | Command palette, side bar footer |
| Create workspace | `squarecloud.createWorkspace` | Command palette, side bar title menu |
| Generate workspace invite code | `squarecloud.generateInviteCode` | Command palette, workspace action menu |
| Create database | `squarecloud.createDatabase` | Command palette, side bar title menu |

Action-menu entries on an **application** (right-click or ⋯):

| Group | Actions |
|---|---|
| Inline icons | Refresh, Show logs, Favorite/Unfavorite |
| Lifecycle | Start, Restart, Stop |
| Deploy | Commit, Snapshot, Restore snapshot |
| Inspect | Show 24h metrics, Toggle realtime stream, Environment variables, View on dashboard |
| Edge | Edge errors, Edge logs, Edge performance, Purge edge cache |
| Integration | Link / Unlink GitHub App repository |
| Meta | Copy ID |
| Danger | Delete (with automatic recovery snapshot) |

Context-menu actions on a **database**: Start, Stop, Download TLS certificate, Delete.
Context-menu actions on a **workspace**: Leave, Delete.

Favorited applications also appear in a compact **Square Cloud** view inside the Explorer container, so you can act on your main app without switching activity bar tabs.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `squarecloud.favApps` | `[]` | List of favourited application IDs. Managed by the star on each application row — usually you don't edit this by hand. |

---

## Localisation

Available in **English**, **Português (Brasil)** and **Español** — every command, prompt, toast and error message. VSCode picks the active locale automatically.

---

## Activation & performance

The extension activates lazily, only when one of the following is true:

- A `squarecloud.app` or `squarecloud.config` file exists in the workspace.
- You open the Square Cloud side bar, run a Square Cloud command, or edit a Square Cloud config file.

Until then there is zero background activity — no startup overhead for unrelated VSCode windows.

Once active:

- The full account state refreshes every **60 seconds** — user, application statuses and workspaces fetched in parallel.
- Polling **pauses while the editor window is unfocused** and resumes (with an immediate refresh) when focus returns, so an idle editor doesn't burn API quota.
- Concurrent refreshes are coalesced — a second trigger piggybacks on the in-flight request instead of duplicating it.
- Polling also stops while your account has no applications (empty/paywall state); manual refresh remains available.

---

## Rate limits

The extension is built to stay inside the platform's request budgets, and to degrade politely when a limit is hit:

- Rate-limited background status refreshes are retried once with a backoff; user-initiated actions surface a clear "wait a moment" toast — never retried in a loop.
- Realtime streams reconnect at a measured pace after the server-side TTL, and refusals (including the 5-connection account cap) stop the stream with a message instead of retrying.
- Log fetches are on-demand only; nothing polls logs in the background.

---

## Security & privacy

- Connecting grants the extension an authorization scoped to what it actually calls, valid for 90 days and revocable in the dashboard — your account's master key never enters the editor.
- The approval code is shown in the editor and typed into the page; it never travels in a URL, so seeing the link is not enough to approve on your behalf.
- The credential lives in VSCode `SecretStorage`, which delegates to the OS keychain (Windows Credential Manager, macOS Keychain, libsecret). It is never written to settings, globalState or disk.
- Database credentials shown at creation are copied to your clipboard only at your request and never persisted by the extension.
- The extension talks exclusively to `squarecloud.app` endpoints via the official [`@squarecloud/api`](https://github.com/squarecloudofc/sdk-api-js) SDK — no telemetry, no third-party services.

---

## Requirements

- **VSCode 1.125** or newer.
- **A Square Cloud account.**
- Some features (databases, workspaces, edge analytics, GitHub App linkage, snapshots listing) require a paid plan — the extension shows a clear, localized message when your plan doesn't allow an action.

---

## Troubleshooting

**Nothing shows up in the side bar.**
Check that an account is connected — with none, the side bar shows the sign-in screen instead of your applications. A failed refresh now reports the reason instead of leaving the panel loading.

**"Your authorization expired."**
Authorizations last 90 days and cannot be refreshed silently; run `Square Cloud: Connect account` again. You can revoke one at any time under **Account → Security** in the dashboard.

**The approval page shows a different code than the editor.**
Do not approve it. That mismatch means the page is completing someone else's request; close it and start over.

**Upload fails with a missing config error.**
The chosen folder needs a `squarecloud.app` or `squarecloud.config` at its root. The error toast links to the [config file documentation](https://docs.squarecloud.app/getting-started/config-file); the extension's IntelliSense will validate the file as you write it.

**Upload fails because the zip is too large.**
Zips are capped at 100 MB. Add build artifacts, caches and dependency folders to `squarecloud.ignore` — dependencies are installed on the platform from your manifest, they don't need to be uploaded.

**A command failed with a rate-limit message.**
Wait a few seconds and retry. Background polling already backs off automatically; hammering retry will only extend the throttle.

**Diagnosing anything else.**
Open `View → Output` and pick the **Square Cloud** channel for structured logs (info/warn/error) of every API interaction — include them when reporting bugs. Friendly toasts map the common error codes; less common codes fall back to a generic message with the raw code included, and the full detail is always in the output channel.

**Stale state.**
Click the status bar item or the refresh icon in a view title bar to force a refresh. Remember polling pauses while the window is unfocused.

---

## Contributing

Issues, suggestions and PRs are welcome at the [GitHub repository](https://github.com/squarecloudofc/vscode-extension). See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, lint and build instructions.

```bash
git clone https://github.com/squarecloudofc/vscode-extension
cd vscode-extension
pnpm install
pnpm watch     # incremental build + typecheck
# press F5 in VSCode to launch the Extension Development Host
```

---

## License

MIT — see [`LICENSE`](./LICENSE).
