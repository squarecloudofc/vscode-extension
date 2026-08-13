# Changelog

All notable changes to this project will be documented in this file.

## 5.2.0

Sign-in without handing over the account's master key, and a sidebar that shows
the account instead of four collapsible trees.

### Added

- **Connect account** — the extension now gets its own scoped authorization through `/v2/account/authorize`, valid for 90 days and revocable in the dashboard, instead of asking for a pasted API key. PKCE (S256) over a loopback redirect; the approval code is shown in the sidebar and copied to the clipboard, never carried in the URL.
- **Authorization polling** — `claim` is polled at the interval the server hands back (±15% jitter, stops at `expires_in`). The loopback redirect only shortens the wait, so the flow also completes on Remote SSH and Codespaces, where `127.0.0.1` is not the same machine as the browser. `AUTHORIZATION_PENDING` is treated as the normal state; `INVALID_VERIFIER` and friends fail immediately rather than burning the grant's five attempts.
- **Sign-in view** — a webview replacing the input box, with the approval code, a countdown driven by the grant's own `expires_in`, and a warning line for recoverable states (account at its authorization limit, rate limit) that keeps waiting instead of giving up.
- **Dashboard view** — the four tree views are replaced by one webview: account header with plan and RAM meter, applications with live status and inline actions, databases, workspaces, and a service-status footer. Per-row overflow (or right-click) opens a grouped menu of the same commands as before.
- **Disconnect account** — replaces "Set API key" in the signed-in toolbar; clears the stored authorization and everything fetched with it.
- **Three self-checks** — `check-authorize` drives the real flow against a stub API and a live loopback hit; `check-strings` asserts every translation key used in the source and the manifest resolves in all three locales; `check-realtime` runs the documented SSE wire format through the console parser. All run in `build`.

### Fixes

- **A failed refresh no longer looks like a pending one.** When `user.get()` was rejected the refresh returned without marking the load as finished, so every view sat on "Loading..." forever, silently. The state is now always settled and the failure is surfaced once.
- **A network blip no longer deletes a working authorization.** The stored key was dropped on *any* failed check; only an actual rejection from the API drops it now. Pasting a bad key no longer deletes the one already stored either.
- **`APIKEY_EXPIRED` triggers re-authorization** rather than reporting an invalid key.
- **Lifecycle actions follow the status** at 600ms/1.8s/4s and stop as soon as it flips, instead of a single fixed refresh seven seconds later.
- **Impossible actions are no longer offered** — edge analytics only for applications with a domain, metrics only above 512 MB, and only the half of start/stop that applies.
- **Favouriting works and is visible** — the star renders next to the application name; the sidebar previously never repainted on the change.
- **The realtime console shows output again.** The stream carries `status` frames (cpu/ram/netIO, several times a second) alongside `logs`, and the SSE `event:` name was being ignored — every frame was printed, so metrics buried the application's own output. Only `logs` and `error` are printed now, the stdout/stderr prefix byte is stripped, and exactly one space is removed after `data:` so indented stack traces keep their shape.
- **Commit, Snapshot and Unfavorite had wrong or untranslated titles** in the manifest (`Unfavorite` read "Favorite"; the first two were hardcoded English with no key at all).
- One refresh writes six store slices, which used to cause six full repaints in a row; they now collapse into one frame.

### Changes

- The API client is no longer validated on every call — a full `user.get()` ran per client fetch, doubling every poll and every command's request count.
- The credential lives in `SecretStorage` alongside the account it belongs to, so an approval from a different account is detected and confirmed before it overwrites the current one.
- `src/treeviews` and the `copyText` command are gone with the views that hosted them, along with the `favapp-view` contribution no provider ever registered.

### Docs

- README updated for the new sign-in and side bar: connecting an account and what the 90-day authorization covers, the code-matching check on the approval page, row actions and the grouped action menu, service health in the footer, and troubleshooting entries for an expired authorization and a mismatched approval code.

### Dependencies

- Biome 2.5.8, esbuild 0.28.2, `@types/node` 26.2.0, concurrently 10.0.4, ovsx 1.1.1.
- `@types/vscode` intentionally kept at 1.120 to match `engines.vscode` — bumping it would raise the minimum supported VSCode version.

## 5.1.1

### Fixes

- Database version picker now offers the major version keys documented by the API (PostgreSQL 17, MySQL 9, MongoDB 8, Redis 7) instead of full point releases.

## 5.1.0

Migration to `@squarecloud/api` v5 plus a smoother upload flow and smarter rate-limit handling.

### Added

- **Upload: workspace folder picker** — open workspace folders are offered first when uploading a new application; "Browse..." still opens the OS dialog for any other folder.
- **Upload: post-upload actions** — the success toast now shows the detected runtime (language + version) and offers **Open dashboard** and **Copy ID** buttons.
- **Upload: client-side size guard** — zips over 100 MB fail fast with a hint to extend `squarecloud.ignore`, before any bytes are uploaded.
- **Realtime: automatic reconnection** — when the server-side connection TTL closes the stream, the extension reconnects after a short backoff (with a `[Reconnecting...]` marker) instead of silently ending. Stopping the stream yourself never reconnects.
- **Realtime: robust error handling** — HTTP refusals from the stream endpoint (connection limit reached, deleted app) now surface a localized message and stop cleanly; streams that die immediately are treated as refusals instead of being reconnected in a loop.
- **Database creation: version picker** — the free-text version prompt was replaced with a QuickPick of versions currently accepted per engine (PostgreSQL 17, MySQL 9, MongoDB 8, Redis 7), plus an **Other version...** escape hatch so the command keeps working when the platform rotates versions.
- **Database creation: copy password** — alongside the connection URL (still copied automatically), a **Copy password** button is offered, since credentials are shown only once at creation.
- **Localised messages for the standardized error codes** — plan limits (applications/members/workspaces/load balancers), insufficient memory, upload aborted/too large, domain validation, metrics support, realtime connection cap, snapshot processing/restore in progress, and cluster maintenance — in all three languages.

### Changes

- Migrated to `@squarecloud/api` v5 (`^4.0.1` → `^5.0.0`).
- Unknown error codes now fall back through the SDK's canonical alias table before showing the generic message, so legacy code names still map to friendly messages during the API's naming transition.
- Background status refreshes rejected with a rate limit are retried once after a 10s backoff instead of waiting for the next poll cycle.
- Post-action toasts (upload, delete, database created, certificate downloaded) share a single locale-safe action-button helper instead of per-command boilerplate.

### Docs

- README rewritten: full feature walkthroughs (upload vs commit, ignore-rule resolution, realtime limits, snapshot quotas, one-time database credentials), command reference with IDs, rate-limit behaviour, security notes and an expanded troubleshooting section.

### Dependencies

- `@squarecloud/api` → **5.0.0**.
- `typescript` 6.0.3 → **7.0.2**.
- `@biomejs/biome` → 2.5.3 (config migrated to the new `preset` field; static `resources/` assets excluded from linting).
- `@types/node` → 26.1.1, `@vscode/vsce` → 3.9.2, `ovsx` → 1.0.2, `concurrently` → 10.0.3, `esbuild` → 0.28.1, `ignore` → 7.0.6.
- `@types/vscode` intentionally kept at 1.120 to match `engines.vscode` — bumping it would raise the minimum supported VSCode version.

## 5.0.1

### Fixes

- Resolved 6 duplicate translation keys (`workspace.created` and `database.created` each existed twice in every locale — the toast string was silently overwriting the column label). Renamed the labels to `workspace.createdAt` / `database.createdAt`.
- Tidied 2 lint warnings flagged by Biome: optional chain in `MAIN` file existence check, unused parameter property in `ConfigFileManager` constructor.

## 5.0.0

Major release: migrated to `@squarecloud/api` v4 and added first-class support for workspaces, databases, environment variables, realtime streaming, GitHub App linkage, edge analytics, and one-click application upload. The internal architecture was overhauled to a `Disposable`-based composition root with selective store subscriptions, focus-aware polling, and SDK-error-code-aware toasts.

### Added

- **Workspaces view** — create, delete, leave, generate invite codes; inline member and shared-app rendering.
- **Databases view** — create/start/stop/delete managed databases (MongoDB, MySQL, Redis, Postgres); TLS bundle download split into `.pem`, `.crt` and `.key`.
- **Application: Upload** — create a brand new app from any folder, with client-side `squarecloud.app`/`squarecloud.config` validation and cancellable progress.
- **Application: Environment variables** — full CRUD over `application.envs` via QuickPick.
- **Application: 24h metrics** — CPU/RAM/network time series rendered in a per-app output channel.
- **Application: Realtime stream** — Server-Sent Events consumed into an output channel; toggle on/off.
- **Application: Snapshot restore** — sorted-newest-first QuickPick over `application.snapshots.list()` with confirmation.
- **Application: GitHub App link/unlink** — repository + branch picker.
- **Application: Edge analytics** — errors, edge logs, performance, and selective/full cache purge (website apps only).
- **Service status** — palette command + status bar warning when Square Cloud reports degraded health.
- **Status bar item** — at-a-glance API key state, online/total apps, and service health; click to refresh.
- **Config file IntelliSense — `RUNTIME` field** — autocomplete + validation against the 15 official aliases, plus quick-fix lightbulbs.

### Changes

- Migrated to `@squarecloud/api` v4 with parallelised refresh (`Promise.allSettled`) and shared client instance keyed by API key.
- API key storage moved to VSCode `SecretStorage` (OS keychain); legacy `auth.json` is migrated on first run and deleted.
- Polling now pauses while the editor is unfocused and resumes on focus, with refresh coalescing.
- Tree views switched to selective store subscriptions (per slice) instead of a blanket `refreshAll`.
- Commands wrapped to centralise error logging and map `SquareCloudAPIError.code` to localised toasts; removed boilerplate `paused` gate from every command.
- `start`/`stop`/`restart` consolidated into a single parameterised builder.
- Network analytics commands (errors/logs/performance) consolidated into a shared builder.
- Background auto-refresh polling interval raised from 30s to 60s to reduce API pressure for idle sessions.
- `setTimeout(refreshStatus, 7000)` magic numbers replaced by `APIManager.scheduleStatusRefresh()` with timer tracking + cleanup on dispose.
- `activationEvents` reduced from `"*"` to `workspaceContains` only — VSCode auto-generates view/language activations.
- Config file: `START` length limit raised to 256, `SUBDOMAIN` to 63, `MAIN` becomes optional when `START` is set.
- Locale comparisons replaced with tagged `MessageItem.id` across all confirmation dialogs.
- Output channels centralised via `getOutputChannel(bag, key, name)` and disposed with the extension.
- Status updates now produce new `Collection`/`Set` references so selective subscribers actually fire.
- `engines.vscode` bumped to `^1.120.0`.
- `packageManager` pinned to `pnpm@11.5.0`.

### Fixes

- Snapshot restore now lists every snapshot (extracted `snapshotId`/`versionId` from the signed URL — previous code stripped them all as "invalid").
- Database certificate download no longer hangs on "Downloading..." after the file is written (toast moved outside `withProgress`).
- Application delete no longer leaves the progress notification spinning waiting for the success toast.
- Realtime SSE sessions are aborted on extension teardown; no more dead `Disposable` entries piling up in `context.subscriptions` on repeated start/stop.
- Phantom `disposeAllRealtimeSessions` command removed from the VSCode registry (utility was registered as a command by the barrel scan).
- `setStatus` and `toggleFavorite` no longer mutate state in place — fixes tree views not refreshing on status updates.
- TypeScript IntelliSense for `node:` protocol imports restored via explicit `types: ["node", "vscode"]` after TypeScript 6's default change.

### Dependencies

- `@squarecloud/api` 3.8.0 → **4.0.1**.
- `adm-zip` removed in favour of **`jszip`** (dropped the local patch).
- `xdg-app-paths` removed — replaced with VSCode `SecretStorage`.
- `mocha`, `@types/mocha`, `@vscode/test-electron` removed (no test suite shipped).
- `typescript` → 6.0.3, `@biomejs/biome` → 2.4.16, `@types/node` → 25.9.1, `@types/vscode` → 1.120.0, `concurrently` → 10, `ovsx` → 1.
- `pnpm` bumped to 11.5.0 with `minimumReleaseAgeExclude: ["@squarecloud/api"]` policy.

### Removed

- `TODO.md` (backlog superseded by this release).
- `contributes.disabled.json` (graveyard, never loaded by VSCode).
- Dead translation keys across all locales (`createConfig.*`, `statusBarItem.*`, `setWorkspaceApp.*`, `uploadWorkspace.*`, `commitWorkspace.*`, `commit.error`, `view.noApiKey`, and others — 57 keys total).
- Unused utilities: `compareSets`, `Constant`, `capitalize` (inlined in its single caller).

## 3.3.0

### Added

- `CONTRIBUTING.md` with setup, development, lint, build, and contribution guidelines.
- Locale helper for extension links (`pt-br`, `en`, `es`).

### Changes

- Added João Otávio Stivi as a contributor.
- Updated CI workflow to use `actions/checkout@v6` and `actions/setup-node@v6`.
- Moved `enable-pre-post-scripts` config from `.npmrc` to `pnpm-workspace.yaml`.
- Updated `CHANGELOG.md` with all missing version entries.
- Updated API key guidance link to `https://squarecloud.app/{locale}/account/security`.
- Added paywall messaging in Applications view with pricing link (`https://squarecloud.app/{locale}/pricing`).
- Improved paywall UX in Applications view with clearer copy and CTA labels.
- Stopped automatic status polling while paywall/no-apps state is active.
- Replaced deprecated `SquareCloudAPI.users` usage with `SquareCloudAPI.user`.
- Removed temporary API key validation debug logs.

### Fixes

- Fixed extension crash when an account has no plan and/or no applications (`No Apps`).
- Fixed Applications tree empty state by differentiating loading from loaded-without-apps.

### Dependencies

- Updated key dependencies and tooling, including `typescript`, `esbuild`, `@biomejs/biome`, `@types/node`, `@types/vscode`, and `@vscode/vsce`.

## 3.2.11

### Changes

- API key storage migrated away from SecretStorage for improved compatibility.
- Simplified API key retrieval logic.
- Updated dependencies.

## 3.2.10

### Changes

- API key now stored using system-standard paths via `xdg-app-paths`, replacing keyring.
- Updated dependencies.

## 3.2.9

### Changes

- API key storage migrated to system keyring for improved security.

## 3.2.8

### Changes

- Internal refactoring of API key and constant handling.

## 3.2.7

### Added

- Extension now published to the Open VSX Registry.

## 3.2.6

### Changes

- Backups renamed to snapshots.

### Fixes

- Crashes and loading issues.

## 3.2.5

### Fixes
- Fix committing folders.

## 3.2.4

### Docs

- Improved README examples.
- Renamed extension.

## 3.2.3

### Fixes

- Fix configuration file for Windows users.

## 3.2.2

### Changes

- Improved MAIN and VERSION parameter handling in the configuration file.
- Updated extension icon and README.

## 3.2.1

### Changes

- Updated extension name.

## 3.2.0

### Added

- Configuration file syntax highlighting & auto completion.

## 3.1.5

- Update dependencies.

## 3.1.4

### Fixes

- Fix restarting the application after a commit.

## 3.1.3

### Fixes

- Fix application commit.
- Fix application backup.
- Duplication of logs output channels.

### Tweaks

- Improve RAM formatting.

## 3.1.2

### Added

- Now you can choose wheter you want to restart your application after the commit or not.

## 3.1.0

### Added

- Readded user information view

## 3.0.0 - Massive revamp

### Improvements

- Everything is more polished, ensuring performance and stability.
- Now statuses come from status all API endpoint.
- API key is now stored in VSCode Secrets for your safety.
- More reliable and fast state and cache management.

### Fixes

- Applications names not showing.
- Application description error at startup.
- Unstable API key handling.

## 2.0.0

### Added

- Applications
  - Upload

## 1.0.0

### Added

- General
  - User information view
  - Bots & Sites management views
  - Create configuration file
- Applications
  - Start
  - Stop
  - Restart
  - Delete
  - Commit
  - Logs
  - Statusd
