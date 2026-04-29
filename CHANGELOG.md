# Changelog

All notable changes to this project will be documented in this file.

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
