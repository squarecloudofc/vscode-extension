# Contributing

Thank you for your interest in contributing to the Square Cloud VS Code Extension!

## Requirements

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 10+
- VS Code 1.108+

## Setup

```bash
git clone https://github.com/squarecloudofc/vscode-extension.git 
cd vscode-extension
pnpm install
```

## Development

Run the build watchers:

```bash
pnpm watch
```

Then press **F5** in VS Code to launch the Extension Development Host.

## Linting & Type Checking

```bash
pnpm lint         # auto-fix with Biome
pnpm check-types  # TypeScript type checking
```

## Building

```bash
pnpm build        # production build (runs type check first)
pnpm package      # produces a .vsix package
```

## Commit Guidelines

This project does not use an automated commit tool. Follow the format below manually:

```
<type>: <short description>
```

Common types:

| Type       | When to use                              |
| ---------- | ---------------------------------------- |
| `feat`     | New feature or behavior                  |
| `fix`      | Bug fix                                  |
| `refactor` | Code change that is neither feat nor fix |
| `docs`     | Documentation only                       |
| `chore`    | Build, CI, or tooling changes            |
| `style`    | Formatting, no logic change              |

Examples:

```
feat: add status bar item for active application
fix: resolve config file path on Windows
chore: update @types/vscode to 1.109
```

## Changelog

Before opening a pull request, update [CHANGELOG.md](CHANGELOG.md) under the next version heading using the existing format:

```markdown
## <version>

### Added
- Short description of new feature.

### Fixes
- Short description of bug fix.

### Changes
- Short description of behavioral or API change.
```

Only include sections that are relevant to your change. Keep descriptions short and user-facing.

## Pull Requests

1. Fork the repository and create a branch from `main`.
2. Make your changes and confirm `pnpm build` passes.
3. Update `CHANGELOG.md` with your changes.
4. Open a pull request targeting `main`.
