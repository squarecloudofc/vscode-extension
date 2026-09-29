# Changelog

All notable changes to this project will be documented in this file.

## 5.3.1

### Changes

- **Ignore rules follow git more closely.** A `\` makes the next character literal (`\#notes.txt`, `\*`), and only trailing spaces are trimmed from a rule, never tabs. The Square Cloud CLI matches the same way.
- **Square Cloud is the author.** The Marketplace listing names Square Cloud as the author, with João Otávio Stivi and João Gabriel Tonaco as contributors.

### Docs

- CONTRIBUTING lists the eight locales and `pnpm check-strings` instead of a script that compared only three, and the current Node.js and pnpm versions.

### Dependencies

- `jszip` 3.10.2 and `ignore` 7.0.10 in the extension itself.
- Biome 2.5.14, `@types/node` 26.6.3, concurrently 10.0.5, `@vscode/vsce` 4.0.0, ovsx 1.2.0 and pnpm 11.28.2 for development. `@types/vscode` stays at 1.125 to match the minimum VS Code.
- Security floors raised for `undici`, `js-yaml`, `fast-uri` and `qs` (publishing tools only, never shipped in the `.vsix`); `pnpm audit` reports nothing.
- CI runs on Node 24, since `@vscode/vsce` 4 and ovsx 1.2 need Node 22 or later. A failed registry no longer cancels the other one mid-publish, and a publish can be retried from the Actions tab.

## 5.3.0

### Added

- **Get Started walkthrough.** `Square Cloud: Get Started` opens a ten-step guide on the Welcome page (connect, the `squarecloud.app` file, upload and commit, lifecycle, logs and metrics, snapshots, databases, workspaces, GitHub deploys and edge analytics), each with an animated, theme-aware illustration, a plain-words explanation and buttons that run the real commands. Steps complete as you use the features. It opens once on the first activation without a connected account and never again; it is also linked from both side bar views and their `...` menu.
- **Application commands ask which application** when run without one (from the walkthrough or a command link), and open the sign-in view when no account is connected, instead of doing nothing. Upload, Create database, Create workspace and Copy My Invite Code also open sign-in when disconnected.
- **Application and database actions in the command palette.** With an account connected, the ⋯ menu's actions (`Square Cloud: Restart Application...`, `Download Database TLS Certificate...` and the rest) run from the palette and ask which application or database to use. `Copy My Invite Code` is there too.
- **Pickers offer only what fits.** Start lists applications that aren't running, Stop and Restart the ones that aren't stopped, edge tools only websites and metrics only applications with 512 MB or more; when nothing fits, a message says why. The walkthrough's database step gets a **Download the TLS certificate** button.
- **A new home before you connect.** An isometric Square Cloud platform with a website, a bot, a database and an API on it, each block lighting up in turn, above a short pitch, **Connect account**, the other ways to sign in and the tour. At the foot, what connecting grants: an authorization of its own, valid for 90 days, revocable, and your password never passes through VS Code.
- **Sign-in view, redesigned to teach the flow.** Once you connect, a 1 → 2 → 3 guide (connect, confirm the code, done) that moves with you, the code in eight slots with a copy button, a countdown ring driven by the grant's own expiry, a collapsible "What will VS Code be able to do?" list that explains each requested permission in plain words, and a success animation. Key-limit and rate-limit warnings get a title (and a shortcut to My Account → Authentication for the key limit), an expired code gets its own state, and cancelling says that nothing was connected.
- **Dashboard polish.** Skeleton placeholders while loading; an illustrated empty state with an **Upload your first application** button; a live status that turns amber while a start/stop/restart you clicked is on its way; "?" popovers explaining the RAM meter, applications, databases and workspaces; tooltips on every detail field (now localised); and repaints that only rebuild what changed, so animations no longer restart on every status poll and the RAM meter glides to new values.
- **Square Cloud look.** The sign-in view and the dashboard now use the website's own colours, cards, buttons, status badges, plan tag and RAM bar, in its dark and light themes; high-contrast themes keep VS Code's colours.
- **Accessibility.** Illustrations carry localised labels, rows open from the keyboard (Enter/Space, context menu with Shift+F10), focus is always visible, every animation respects "reduce motion", and high-contrast themes keep their borders.
- **Illustrated problem states.** Being offline, a rate limit, an outage, an expired code, the authorization limit and plain errors each get a picture, one sentence on what happened and the button that helps. A rate limit counts down to the automatic retry; a failed refresh keeps the last data under a "Couldn't refresh" banner; a degraded platform gets a banner on top. Accounts without a plan are invited to pick one, and Databases and Workspaces always show, with a way to create the first one. Error toasts offer the next step: Connect account, See plans or Service status.
- **Status bar tooltip.** Account and plan, applications online, service health and the current problem, with links to refresh, service status and the web dashboard. The item itself shows when you are offline or rate-limited.
- **Eight languages.** Besides English, Portuguese and Spanish, the extension now speaks German, French, Italian, Japanese and Simplified Chinese, the languages of the Square Cloud website, and links into the website open in the same language.
- **Long application lists page.** Past 10 applications the dashboard shows them 10 at a time with previous and next arrows, and a filter by name, domain or ID finds one among a thousand. Favourites stay on the first page.
- **Icons in menus.** Every entry of the ⋯ menu has an icon, the application picker shows each app's status and memory in use, and the toolbar uses VS Code's own icons.

### Changed

- **Official SDK v6.** The extension now runs on `@squarecloud/api` 6, a flat client of plain data. It sees the API's real error codes and messages instead of synthetic ones, times calls out instead of waiting forever, and retries only what is safe to retry.
- **One request to refresh an application's status** instead of two: the extension no longer fetches the application before asking for its status.
- **Edge analytics** (logs, errors, performance, purge cache) are offered and checked from the account listing, without an extra request per command. A failed analytics call now says why instead of reading as "no data".
- **Working offline stays quiet.** A failed background refresh no longer pops an error toast; the side bar and the status bar show what happened and retry on their own.
- **Spanish says "espacio de trabajo"** everywhere, like the website, instead of mixing it with "workspace".
- **Your invite code moved to the side bar's `...` menu** and is now called **Copy My Invite Code**. The code belongs to you, not to a workspace: a workspace owner uses it to add you. The notification says so.
- **Sign-in wording matches the page.** VS Code shows a code and the approval page asks you to paste it, so the extension no longer tells you to compare two codes. It warns you never to enter a code someone sent you instead.
- **Everything is localised.** Dialog titles, the upload file count, quick-fix titles, the metrics and edge reports, the service status and the edge time ranges no longer appear in English in other languages.
- **One ignore file for the extension and the CLI.** Both read `squarecloud.ignore` with `.gitignore` syntax and the same defaults, which now also leave out `.git`, `.github` and `.vscode`; a `!` rule brings any of them back. `.gitignore` is no longer read in its place: it often lists what the application needs to run, like `.env`. A symbolic link to a file is uploaded as that file instead of being skipped.
- **Service status only where it works.** Without a connected account the command is hidden from the palette, since it needs one; run anyway, it opens the public status page.
- **Smaller package.** The icons left over from the old tree views are gone; the Marketplace page shows screenshots instead.

### Fixes

- **A failed refresh no longer reads "sign in"** in the status bar while an account is connected.
- **An expired authorization asks to connect again.** The API no longer sends `APIKEY_EXPIRED`; an expired key answers `401 ACCESS_DENIED`, exactly like a revoked one, so that is what triggers the prompt now. Only a rejected account refresh drops the key; an `ACCESS_DENIED` from another command is shown as an error and re-checks the account, which asks to connect again only when the key itself is dead.
- **Restore snapshot uses the snapshot's own identifiers.** It used to rebuild them from the download URL and could fail with "could not read the snapshot identifiers"; the listing now carries them.
- **Snapshots stream to disk** instead of being held in memory, and a failed download no longer leaves a partial zip behind. A snapshot that is still being generated (large applications) is reported as such instead of failing.
- **Delete no longer runs without a recovery snapshot.** If the snapshot is still being generated, the application is kept and you are asked to try again in a couple of minutes.
- **Rate limits degrade quietly.** A `RATE_LIMITED` block pauses background polling for a few minutes and keeps what is already on screen; a short `KEEP_CALM` burst is retried once. Before, a throttled refresh blanked every status dot until the next poll.
- **"Already running" / "already stopped" is information, not an error.** Starting a running application (or stopping a stopped one) shows an information message and resyncs the row, which was stale.
- **Clearer messages** in every language for missing permissions, rate limits, suspended or unavailable containers, lack of disk space, GitHub App linking (no installation, no write access, branch not confirmed, already linked), validation failures, timeouts and temporary unavailability. Any other code still shows a generic message with the code.
- **Switching or disconnecting an account is clean.** A refresh that started before the change no longer writes the old account back, an old 401 no longer deletes the new authorization, and open realtime consoles close.
- **Sign-in survives impatience.** Cancel while the code is copied or the browser opens, or clicking Connect twice, no longer shows an error or leaves a second attempt polling in the background. Reconnecting from the dashboard has a **Cancel** button back to it.
- **Cancel is never an error.** Cancelling an upload, a commit or a dialog no longer shows an error notification.
- **The dashboard keeps keyboard focus** when a row updates, and a filter with `$` in it shows the right text.
- **Times follow your machine.** Under Remote-SSH, WSL or containers, "Running since" and "Showing data from" used the remote host's time zone; the dashboard now formats them locally.
- **A newly migrated key is read correctly on startup** instead of showing the sign-in screen once.
- **Config file checks:** a value with `=` in it is read correctly, `ruby` and `rb` are accepted runtimes, quick fixes replace the whole line, and `MAIN` paths work with forward and back slashes.
- **Safer downloads.** A snapshot is written to a temporary file and renamed only once complete, and database certificates are saved readable only by you.
- **Every window follows the account.** Connecting or disconnecting in one VS Code window now applies to the others, which kept the old state until reloaded.
- **"Running since" stays.** An open card lost its start time on the next refresh; it now keeps it and re-reads it on every refresh, so a restart made elsewhere shows up.
- **The environment variable name hint is right.** It asked for uppercase letters, but lowercase names are accepted too; it now says letters A to Z, digits and underscores.
- **24h metrics show RAM correctly.** RAM values are megabytes and were formatted as bytes; the "current" line also read the oldest sample, since the API sends the newest first.

## 5.2.1

### Fixes

- **The status bar warned about a healthy platform.** It compared the service status against `operational` while the API reports `online`, so a green platform rendered as a yellow warning reading "Square Cloud — online". Present since 5.0.0.
- Both surfaces that render service health — the status bar and the side bar footer — now share one predicate. The bug only became visible in 5.2.0 because the two disagreed on the same field, and two separate lists would drift again the moment the API adds a word.
- A degraded status now puts the platform's own message in the status bar tooltip, instead of showing a warning with no explanation.

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

- **Minimum VSCode is now 1.125** (was 1.120). `@types/vscode` and `engines.vscode` moved together — they have to, or the build would accept APIs the declared minimum does not ship. Editors older than 1.125 stay on 5.1.1 and stop receiving updates.
- Biome 2.5.8, esbuild 0.28.2, `@types/node` 26.2.0, concurrently 10.0.4, ovsx 1.1.1.
- CI: `actions/setup-node` 6 → 7.
- Security floors raised for the packaging toolchain — brace-expansion, fast-uri, js-yaml, linkify-it and undici all had published fixes. `pnpm audit` is clean; none of these ever shipped in the `.vsix`.

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
