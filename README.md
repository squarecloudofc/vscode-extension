<div align="center">
  <img alt="Square Cloud Banner" src="https://cdn.squarecloud.app/png/github-readme.png">
</div>

<h1 align="center">Square Cloud for VSCode</h1>

<p align="center">
  Manage your <a href="https://squarecloud.app" target="_blank">Square Cloud</a> applications, databases and workspaces without leaving the editor.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=squarecloud.squarecloud"><img alt="VS Marketplace" src="https://badgen.net/vs-marketplace/v/squarecloud.squarecloud?label=VS%20Marketplace&color=blue"></a>
  <a href="https://open-vsx.org/extension/squarecloud/squarecloud"><img alt="Open VSX" src="https://img.shields.io/open-vsx/v/squarecloud/squarecloud?label=Open%20VSX&color=purple"></a>
  <a href="https://github.com/squarecloudofc/vscode-extension/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-green"></a>
</p>

---

## Getting started

1. Install **Square Cloud** from the [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=squarecloud.squarecloud) or [Open VSX](https://open-vsx.org/extension/squarecloud/squarecloud).
2. Grab your API key from the [Square Cloud dashboard](https://squarecloud.app/account/security).
3. Open the **Square Cloud** activity bar icon → click **Set API key** (or run `Square Cloud: Set new API key` from the command palette).

Your key is stored in the OS keychain via VSCode's `SecretStorage` — never written to disk in plaintext. If you used a previous version with the legacy `auth.json` file, it's migrated automatically on first run.

---

## Features

### Application management

- **Lifecycle** — start, stop, restart with a single click. Status auto-refreshes after each action.
- **Commit** — push files or a whole folder to an existing app. Respects `squarecloud.ignore` and offers to use `.gitignore` as a fallback.
- **Upload** — create a brand new application from a local folder. Validates `squarecloud.app`/`squarecloud.config` client-side before zipping.
- **Snapshots** — download the latest snapshot, or restore the app to any previous one.
- **Environment variables** — list, add, edit, delete or wipe all env vars through a QuickPick.
- **24h metrics** — CPU/RAM/network time series rendered into an output channel (288 samples, every 5 min).
- **Realtime stream** — Server-Sent Events from the app surfaced into a dedicated output channel. Toggle with one command.
- **GitHub App integration** — link or unlink a repository for automatic deploys.
- **Logs** — fetch the latest app logs with ANSI colour preserved.
- **Edge analytics** (website applications) — inspect errors, edge logs, performance breakdowns, or purge the edge cache.

### Databases

Create, start, stop and delete managed databases (MongoDB, MySQL, Redis, Postgres). Download the TLS bundle as `.pem` + `.crt` + `.key` (private keys are split out only when present).

### Workspaces

Create workspaces, generate invite codes, leave or delete them. View members and shared applications inline.

### Configuration file IntelliSense

`squarecloud.app` and `squarecloud.config` files get full editor support — no JSON schema or external language server required.

**Inline diagnostics**

- Missing required keys (`MAIN`, `VERSION`, `MEMORY`, `DISPLAY_NAME`) underlined as errors.
- Duplicate keys flagged on the second occurrence.
- Value bounds: `DISPLAY_NAME ≤ 32`, `DESCRIPTION ≤ 280`, `START ≤ 256`, `SUBDOMAIN ≤ 63` characters.
- `MAIN` resolves the referenced file against the workspace and warns if it doesn't exist, is outside the project, or sits inside `node_modules` / `__pycache__` / dotfiles.
- `MEMORY` validates against the official minimum (256 MB bot / 512 MB site) **and** your plan's available memory — the diagnostic ships with an "Upgrade plan" link when you exceed your quota.
- `SUBDOMAIN` rejects characters outside `[a-zA-Z0-9-]`.
- `RUNTIME` validates against the 15 accepted aliases from the docs (`nodejs`, `javascript`, `typescript`, `python`, `dotnet`, `csharp`, `c#`, `java`, `elixir`, `rust`, `php`, `go`, `golang`, `static`, `html`).
- `VERSION` accepts `recommended` or `latest`.
- `MAIN` becomes optional automatically when `START` is set, matching the docs.

**Auto-completion**

- Key suggestions on empty lines — required fields are pinned to the top.
- Triggered on `=`:
  - `MAIN=` lists every file in the workspace that matches a runtime-aware extension allowlist.
  - `RUNTIME=` shows all valid runtime aliases.
  - `VERSION=` shows `recommended` / `latest`.
  - `AUTORESTART=` shows `true` / `false`.
  - `MEMORY=` shows tier-aware presets (256 MB, 512 MB, 1 GB, 2 GB, …) and automatically hides values under 512 MB once `SUBDOMAIN` is declared.

**Quick-fixes**

Lightbulb actions on diagnostics for `AUTORESTART`, `VERSION` and `RUNTIME` insert a valid value with one click.

**Syntax highlighting & file icons**

Custom file icons for `squarecloud.app`, `squarecloud.config` and `squarecloud.ignore`, plus a small TextMate grammar for keyword/value coloring.

### Status bar

A status bar item shows at a glance whether the API key is set, how many apps are online vs total, and whether Square Cloud's service is degraded. Click it to refresh.

### Localisation

Available in **English**, **Português (Brasil)** and **Español**. VSCode picks the active locale automatically.

---

## Commands

| Command | Where |
|---|---|
| `Square Cloud: Set new API key` | Command palette |
| `Square Cloud: Upload new application` | Apps view title bar, command palette |
| `Square Cloud: Show service status` | Apps/User view title bar, command palette |
| `Square Cloud: Create workspace` | Workspaces view title bar, command palette |
| `Square Cloud: Generate workspace invite code` | Workspaces view title bar |
| `Square Cloud: Create database` | Databases view title bar, command palette |
| Start, Stop, Restart, Logs, Commit, Snapshot, Restore snapshot, Metrics, Realtime, Env vars, Link/Unlink GitHub App, Edge errors/logs/performance, Purge cache, Copy ID, Delete | Right-click an app in the Applications view |
| Start, Stop, Delete, Download TLS certificate | Right-click a database |
| Leave, Delete | Right-click a workspace |

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `squarecloud.favApps` | `[]` | List of favourited application IDs. Managed by the favourite/unfavourite tree-item actions — usually you don't edit this by hand. |

---

## Activation

The extension activates lazily when one of the following is true:

- A `squarecloud.app` or `squarecloud.config` file exists in the workspace.
- You open one of the Square Cloud tree views, run a Square Cloud command, or edit a Square Cloud config file.

No background activity until then — startup overhead for unrelated VSCode windows is zero.

---

## Requirements

- **VSCode 1.120** or newer.
- **An active Square Cloud account** with an API key.
- Some commands (databases, workspaces, edge analytics, GitHub App linkage) require a paid plan — the extension shows a clear error if your plan doesn't allow the action.

---

## Troubleshooting

- **Logs** — open `View → Output` and pick `Square Cloud` to see structured logs (info/warn/error). Useful when reporting bugs.
- **API errors** — friendly toasts map common SDK codes (`INVALID_API_TOKEN`, `RATE_LIMIT_EXCEEDED`, `APP_NOT_FOUND`, …). Less common codes fall back to a generic message; the raw code is always in the output channel.
- **Stale state** — click the status bar item or run `Square Cloud: Refresh` to force a refresh. Polling pauses when the editor is unfocused and resumes when it gets focus back.

---

## Contributing

Issues, suggestions and PRs are welcome at the [GitHub repository](https://github.com/squarecloudofc/vscode-extension). See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, lint and build instructions.

---

## License

MIT — see [`LICENSE`](./LICENSE).
