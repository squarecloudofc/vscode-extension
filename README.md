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
2. Grab your API key from the [Square Cloud dashboard](https://squarecloud.app/account/security) (**Account → Security → API/CLI**).
3. Click the **Square Cloud** icon in the activity bar and choose **Set API key** — or run `Square Cloud: Set new API key` from the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
4. The key is validated immediately. Once accepted, your applications, databases and workspaces load into the side bar.

Your key is stored in the OS keychain via VSCode's `SecretStorage` — never written to disk in plaintext. If you used a previous version with the legacy `auth.json` file, it's migrated automatically on first run.

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

The **Applications** view lists every app on your account with live online/offline icons. Expanding a running application reveals CPU, RAM, storage, network and uptime details. Right-click for the full action menu; the most-used actions (refresh, logs, favorite) are inline icons.

### Lifecycle & status

**Start**, **Stop** and **Restart** from the context menu. After each action the extension waits a few seconds for the platform to settle, then re-fetches the app status — no manual refreshing needed. Statuses for all apps are polled in the background (see [Activation & performance](#activation--performance)).

### Logs

**Show logs** fetches the latest application logs into a dedicated per-app output channel with ANSI colors preserved. Each fetch is on demand — nothing streams in the background.

### Realtime stream

**Toggle realtime stream** opens a live Server-Sent Events feed of your application into an output channel. Toggle the same command again to stop it.

- Up to **5 concurrent streams** per account (a platform limit). The extension enforces the cap locally and tells you when you hit it.
- Server-side, each connection lives about 10 minutes. When that TTL closes the stream, the extension **reconnects automatically** after a short pause — you'll see a `[Reconnecting...]` marker in the channel. Stopping the stream yourself never reconnects.
- All streams are cleanly closed when the extension shuts down.

### Metrics

**Show 24h metrics** renders the last 24 hours of CPU / RAM / network samples (288 points, one every 5 minutes) into an output channel. Requires the application to have at least 512 MB of RAM.

### Snapshots

- **Snapshot** — generates a fresh snapshot of the application and saves the zip wherever you choose.
- **Restore snapshot** — lists your stored snapshots (newest first, with size) and restores the selected one after confirmation.
- **Delete** — before an application is deleted, the extension automatically takes a recovery snapshot and offers a **Download snapshot** button afterwards, so a mistaken delete is never fatal.

Snapshot creation is quota-limited per plan per day; when the quota is exhausted you get a clear "try again tomorrow" message rather than a cryptic error.

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

The **Databases** view lists your managed databases with engine, port, cluster and creation date. Available actions:

- **Create database** — guided flow: name → engine (**MongoDB**, **MySQL**, **Redis**, **PostgreSQL**) → memory → version. The version picker only offers versions currently accepted by the platform, so creation can't fail on a stale hardcoded value.
- **One-time credentials** — the connection URL (password embedded) is copied to your clipboard immediately after creation, and a **Copy password** button is offered — these credentials are shown **only once** by the platform and cannot be retrieved later.
- **Start / Stop** — lifecycle control from the context menu.
- **Download TLS certificate** — saves the bundle as `.pem` (raw), plus split `.crt` and `.key` files when present.
- **Delete** — requires typing the database name to confirm.

Databases require a paid plan; the extension surfaces a clear upgrade message if your plan doesn't include them.

---

## Workspaces

The **Workspaces** view shows every workspace you own or joined, with owner, creation date, members (and their roles) and shared applications inline.

- **Create workspace** — name prompt with validation.
- **Generate invite code** — copies a 5-minute invite code to your clipboard.
- **Leave workspace** — for workspaces you're a member of.
- **Delete workspace** — type-the-name confirmation, owners only.

---

## Service status & status bar

- A **status bar item** shows at a glance: whether an API key is set, how many applications are online vs total, and a warning when Square Cloud reports degraded service health. Click it to force a refresh.
- `Square Cloud: Show service status` fetches the current platform health with a one-click link to the [status page](https://status.squarecloud.app/).

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
| Set new API key | `squarecloud.setApiKey` | Command palette, view title menus |
| Upload new application | `squarecloud.uploadApplication` | Command palette, Applications view title bar |
| Show service status | `squarecloud.showServiceStatus` | Command palette, view title menus |
| Create workspace | `squarecloud.createWorkspace` | Command palette, Workspaces view title bar |
| Generate workspace invite code | `squarecloud.generateInviteCode` | Command palette, Workspaces view title bar |
| Create database | `squarecloud.createDatabase` | Command palette, Databases view title bar |

Context-menu actions on an **application**:

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
| `squarecloud.favApps` | `[]` | List of favourited application IDs. Managed by the favorite/unfavorite tree-item actions — usually you don't edit this by hand. |

---

## Localisation

Available in **English**, **Português (Brasil)** and **Español** — every command, prompt, toast and error message. VSCode picks the active locale automatically.

---

## Activation & performance

The extension activates lazily, only when one of the following is true:

- A `squarecloud.app` or `squarecloud.config` file exists in the workspace.
- You open one of the Square Cloud tree views, run a Square Cloud command, or edit a Square Cloud config file.

Until then there is zero background activity — no startup overhead for unrelated VSCode windows.

Once active:

- The full account state refreshes every **60 seconds** — user, application statuses and workspaces fetched in parallel.
- Polling **pauses while the editor window is unfocused** and resumes (with an immediate refresh) when focus returns, so an idle editor doesn't burn API quota.
- Concurrent refreshes are coalesced — a second trigger piggybacks on the in-flight request instead of duplicating it.
- Polling also stops while your account has no applications (empty/paywall state); manual refresh remains available.

---

## Rate limits

The extension is built to stay inside the platform's request budgets, and to degrade politely when a limit is hit:

- Short-burst throttles (the platform's "keep calm" responses) are retried automatically with a backoff for background status refreshes, and surfaced as a "wait a few seconds" toast for user-initiated actions — never retried in a loop.
- Realtime streams respect the 5-connection account cap and reconnect at a measured pace after the server-side TTL.
- Snapshot creation respects the per-plan daily quota with a specific, actionable error message.
- Log fetches are on-demand only; nothing polls logs in the background.

---

## Security & privacy

- The API key lives in VSCode `SecretStorage`, which delegates to the OS keychain (Windows Credential Manager, macOS Keychain, libsecret). It is never written to settings, globalState or disk.
- Database credentials shown at creation are copied to your clipboard only at your request and never persisted by the extension.
- The extension talks exclusively to `squarecloud.app` endpoints via the official [`@squarecloud/api`](https://github.com/squarecloudofc/sdk-api-js) SDK — no telemetry, no third-party services.

---

## Requirements

- **VSCode 1.120** or newer.
- **A Square Cloud account** with an API key.
- Some features (databases, workspaces, edge analytics, GitHub App linkage, snapshots listing) require a paid plan — the extension shows a clear, localized message when your plan doesn't allow an action.

---

## Troubleshooting

**Nothing shows up in the views.**
Check that the API key is set (`Square Cloud: Set new API key`). The Applications view shows a welcome message with a set-key shortcut when no key is registered.

**"Your API key is invalid."**
Keys are revocable; generate a fresh one in the [dashboard security page](https://squarecloud.app/account/security) and set it again.

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
