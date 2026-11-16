# Contributing

Thanks for taking the time to contribute to the **Square Cloud** VSCode extension! This guide gets you from a clean clone to a working Extension Development Host in a few minutes, and points you at the conventions the codebase already follows.

---

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | **≥ 22.18** | Required by the publishing tools (`@vscode/vsce` 4, `ovsx` 1.2); `pnpm test` runs the `.ts` tests with Node's type stripping. CI runs Node 24. |
| pnpm | **11.28.2** | Pinned via `packageManager` in `package.json`. If you have [Corepack](https://nodejs.org/api/corepack.html) enabled (default since Node 16), it activates the right version on first command, no global install needed. |
| VSCode | **≥ 1.125** | Matches the extension's declared engine. |

---

## Setup

```bash
git clone https://github.com/squarecloudofc/vscode-extension.git
cd vscode-extension
pnpm install
```

A first install also fetches build prerequisites flagged in `pnpm-workspace.yaml` (`esbuild`, `@biomejs/biome`, `@vscode/vsce-sign`, `keytar`). pnpm 11 may ask you to approve the build scripts with `pnpm approve-builds`; accept once and you're set.

> **Tip for Windows:** if `corepack enable` fails with `EPERM` opening `C:\Program Files\nodejs\pnpm`, run the terminal as Administrator once. Corepack just needs to write its shim there.

---

## Running the extension

1. Open the project in VSCode.
2. Press **F5** (or run the *Run Extension* launch config).

This automatically starts the `watch` task (`pnpm watch`) which runs `tsc --watch` and `esbuild --watch` in parallel, then launches a new VSCode window, the **Extension Development Host**, with the extension loaded.

Code edits trigger a rebuild but **do not auto-reload** the host. After a change:
- Reload the host window: `Ctrl+R` (`Cmd+R` on macOS).
- Or run the *Developer: Reload Window* command inside the host.

### Debugging

Breakpoints in `.ts` files inside `src/` work directly thanks to source maps (`sourcemap: !production` in `esbuild.js`). The host process writes structured logs to `View → Output → Square Cloud`. That's the same place users see logs in production, so prefer the `Logger` utility (`src/structures/logger.ts`) over `console.log`.

---

## Scripts

| Script | Purpose |
|---|---|
| `pnpm watch` | Run `tsc --watch` + `esbuild --watch` in parallel (used by F5). |
| `pnpm check-types` | One-shot TypeScript check. |
| `pnpm lint` | Run Biome with `--write` (formats and auto-fixes). Run before committing. |
| `pnpm build` | Production build: type-check, run the self-checks (`scripts/check-*.mjs`), then bundle with esbuild. The CI gate. |
| `pnpm test` | Unit tests for the pure logic (formatters, chart scale, ANSI and `.env` parsers, protocol...) with `node --test`. |
| `pnpm package` | Produce a `.vsix` you can side-load with `code --install-extension`. |
| `pnpm publish:vsce` / `pnpm publish:ovsx` | Publish to the VS Marketplace / Open VSX. Maintainers only. |

---

## Project layout

```
src/
├── core/                 activate / deactivate entry points
├── managers/             long-lived stateful pieces (one per responsibility)
│   ├── extension.ts      composition root, owns the disposable graph
│   ├── api.ts            SDK client cache, polling, refresh coalescing
│   ├── commands.ts       registers Command/ApplicationCommand instances with VSCode
│   ├── views.ts          registers the sidebar webview view
│   ├── config-file.ts    diagnostics + completion providers for squarecloud.app/.config
│   ├── status-bar.ts     bottom-right status bar item
│   └── config.ts         workspace config + SecretStorage-backed API key
├── commands/             one file per VSCode command, organised by domain
├── views/sidebar/        the sidebar view: its state, its handlers, the sign-in flow
├── panels/               editor panels per resource, and the webview shell (html.ts)
├── webview/              the Preact bundle every webview loads (views, components, styles)
├── config-file/          parameter validators/completers (one file per field)
├── providers/            config-file completion, hover and quick fixes; the
│                         squarecloud: file system; the MCP server definition
├── structures/           reusable classes (Command, ApplicationCommand, Logger)
├── lib/                  shared helpers (store, utils, api-key, constants)
└── types/                cross-cutting type aliases
```

The single rule worth knowing: **every long-lived resource is a `Disposable` registered with `context.subscriptions`**. The extension class itself is one, and it composes children that are also disposable. `setInterval`s, output channels, SSE streams and event listeners all get cleaned up automatically when VSCode tears the extension down, so no global module state survives reloads.

---

## Adding a new command

1. Create a file under `src/commands/...` matching the existing domain folders.
2. Export a `Command` (takes `extension` only) or an `ApplicationCommand` (gets the application from the sidebar's menu, or asks for one when run from the palette). Both wrap the handler with error logging and a locale-safe error toast via `describeError()`.
3. Re-export from the relevant `index.ts`. `CommandsManager` discovers exports by `instanceof`, so utilities re-exported from the same barrel are skipped automatically.
4. Add the command to `package.json` `contributes.commands` with the title `%command.<id>%`, where `<id>` is the command id after `squarecloud.` (`check-strings` enforces it), then wire it into `menus.commandPalette` (and `view/title` if it belongs in the sidebar's toolbar). For the sidebar's row menus, list it in `RUNNABLE` in `src/views/sidebar/index.ts`.
5. Add `command.<id>` to all eight locale files: sentence case, ending in `...` when it asks for an application or database first.
6. Give one notification per action: a progress notification **or** a confirmation, never both.

---

## Adding a config-file field

The `squarecloud.app` / `squarecloud.config` IntelliSense is data-driven. To add or change a field:

1. Create `src/config-file/parameters/<FIELD>.ts` exporting a `ConfigFileParameter` `satisfies` object with `required`, `docs()` (the hover text, `t("configFile.hover.<field>")`), optional `validation()` and optional `autocomplete()`.
2. Register it in `src/config-file/parameters.ts`.
3. If the field has a small known value set, add a branch to `src/providers/config-file/completion.ts` (autocomplete trigger) and `src/providers/config-file/action.ts` (quick-fix lightbulbs).
4. Add the hover text and the diagnostic messages to every `package.nls*.json` under `configFile.hover.*` and `configFile.error.*`.

For required-when-X dependencies, return a function from `required`, e.g. `MAIN` is `(keys) => !keys.has("START")`.

---

## Localisation

Eight locales ship in the repo, the languages of the Square Cloud website: `en` (default, `package.nls.json`), `pt-br`, `es`, `de`, `fr`, `it`, `ja` and `zh-cn`. VS Code loads a locale's file instead of English, not on top of it, so every file must carry every key. `pnpm check-strings` (part of `pnpm build`) fails on a missing, extra or unused key, or on placeholders that differ from English.

In TypeScript, prefer `t("scope.key")` over inlining strings. Do **not** compare against translated text (`if (label === t("..."))`); use tagged `MessageItem.id` instead. The helpers in `src/lib/utils/dialogs.ts` (`confirm()`, `showMessageWithActions()`) already do this for yes/no and action buttons. A webview reads only the keys its host sends: list each one in that view's `STRINGS` array (`check-strings` fails otherwise).

---

## Lint & format

The project uses [Biome](https://biomejs.dev). Run `pnpm lint` before committing. The config lives at `biome.json` and matches what CI enforces.

---

## Commit messages

Conventional-style, lowercase type prefix:

```
<type>: <short summary>
```

| Type | Use for |
|---|---|
| `feat` | New user-visible feature or behaviour |
| `fix` | Bug fix |
| `refactor` | Internal rewrite, no behaviour change |
| `perf` | Targeted performance improvement |
| `docs` | README / CONTRIBUTING / inline comments only |
| `chore` | Tooling, CI, dependency bumps |
| `style` | Formatting, no logic change |

Examples from the recent history:

```
feat: add RUNTIME field to config-file IntelliSense
fix: snapshot restore now lists all snapshots
refactor: parameterize start/stop/restart into a single builder
chore: bump pnpm to 11.5.0 via packageManager
```

---

## Changelog

Add an entry to `CHANGELOG.md` under the next version heading **as part of the same PR**. Skeleton:

```markdown
## <version>

### Added
- Short, user-facing description.

### Changes
- Behavioural or API change.

### Fixes
- Bug fix.
```

Drop sections you don't need. Keep entries one line each; details belong in the PR body or commit message.

---

## Pull requests

1. Branch from `main`.
2. Run `pnpm build` locally: the type check, the self-checks and the production bundle must all pass.
3. If you touched the UI, smoke-test in the Extension Development Host (F5). For the webviews, `scripts/preview/index.html` draws every view on mock data in the dark, light and high-contrast themes (build with `node esbuild.js` first; see the comment at its top). Mention in the PR which flows you exercised.
4. Update `CHANGELOG.md`.
5. Open the PR against `main` with a short description + screenshot/GIF when the change is visual.

Larger refactors are welcome but please open an issue first so we can agree on scope.
