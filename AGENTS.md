# Repository Guidelines

## Project Structure & Module Organization

This repository contains the Markdown Workbench VS Code extension. TypeScript source lives in
`src/`; `extension.ts` registers commands, while focused modules such as `reflow.ts`, `toc.ts`, and
`rulers.ts` implement features. Unit tests are colocated as `src/*.test.ts`.
`testSupport/vscodeMock.ts` supplies the Vitest mock for the `vscode` API. Compiled JavaScript is
written to `out/` and coverage reports to `coverage/`; treat both as generated output. User-facing
documentation is in `README.md`, `CHANGELOG.md`, `SUPPORT.md`, and `docs/`.

## Build, Test, and Development Commands

- `npm ci` installs the exact dependency versions from `package-lock.json`.
- `npm run build` clears `out/` and compiles the extension with TypeScript.
- `npm run watch` recompiles TypeScript as files change during development.
- `npm test` runs the Vitest suite once; `npm run test:watch` runs it interactively.
- `npm run test:coverage` runs tests with the CI coverage gates.
- `npm run package` creates a VSIX package for manual installation and testing.

Run `npm run build` and `npm run test:coverage` before opening a pull request.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: two-space indentation, single quotes, no semicolons, trailing
commas in multiline constructs, and strict typing. Use `camelCase` for variables and functions and
`PascalCase` for interfaces and types. Keep modules feature-focused and name tests after their
source module (for example, `toc.ts` and `toc.test.ts`). No separate formatter or linter is
configured, so match surrounding code and rely on `tsc` for static checks.

## Testing Guidelines

Tests use Vitest in the Node environment. Add or update tests for every behavior change, including
protected Markdown/MDX regions and VS Code API interactions where relevant. Coverage must remain at
least 80% for statements, functions, and lines, and 70% for branches. Prefer descriptive
`describe`/`it` text that states observable behavior.

## Commit & Pull Request Guidelines

Recent history favors short, imperative subjects, commonly prefixed with `feat:` or `fix:`. Keep
each commit focused and update `CHANGELOG.md` for user-visible changes. Pull requests should explain
the behavior and motivation, link related issues, list verification commands, and include
screenshots or a VSIX testing note when editor UI behavior changes. CI must pass tests, coverage,
build, and packaging.

## Agent-Specific Instructions

When pinning GitHub Actions `uses:` entries, use the format
`owner/repo@<commit-sha> # <tag>` so the action is pinned to an immutable
commit while preserving the human-readable tag in the comment.
