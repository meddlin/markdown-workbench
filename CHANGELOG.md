# Changelog

## Unreleased

- Changed the maximum line length indicator to a continuous native VS Code ruler synchronized
  through language-specific user settings.
- Fixed editor flicker while typing by removing per-line indicator decorations and their
  document-change redraws.
- Preserved unrelated user rulers and migrated extension-owned rulers from legacy workspace
  settings.
- Changed Markdown Workbench preference commands to save user-level settings by default.

## 0.6.1

- Changed repository, homepage, and issue URLs to point to `meddlin/markdown-workbench`.
- Changed CI coverage comment marker and VSIX artifact name from `markdown-reflow` to
  `markdown-workbench`.

## 0.6.0

- Breaking: renamed the extension from Markdown Reflow to Markdown Workbench.
- Breaking: renamed the extension package from `markdown-reflow` to `markdown-workbench`.
- Breaking: renamed command IDs from `markdownReflow.*` to `markdownWorkbench.*`.
- Breaking: renamed configuration keys from `markdownReflow.*` to `markdownWorkbench.*`.
- Breaking: renamed generated table of contents markers from `markdown-reflow-toc` to
  `markdown-workbench-toc`.
- Changed docs, tests, and extension metadata to use the Markdown Workbench name.
- Changed the extension icon.

## 0.5.2

- New: Added unit test and coverage reporting to CI.
- New: Added pull request coverage summary comments.
- Fixed table of contents generation to use Markdown comment markers for Markdown files and JSX
  comment markers for MDX files.

## 0.5.1

- Changed dependency and runtime versions for maintenance updates.
- Fixed GitHub Actions maintenance issues for newer Node and action versions.

## 0.5.0

- New: Added automated publishing workflows for the VS Code Extension Marketplace.
- New: Added OpenGrep scanning to CI.
- Changed GitHub Actions to pin external actions to commit SHAs.
- Changed editor context menu contributions so commands no longer appear in the editor title area.

## 0.4.1

- Changed extension metadata in `package.json`.
- Changed dependencies for maintenance updates.

## 0.4.0

- New: Automatically reflow Markdown/MDX prose while typing when an edited line exceeds the
  configured maximum line length.
- New: Added `markdownReflow.automaticReflow` to toggle automatic reflow on or off.
- New: Added `Markdown Reflow: Set Maximum Line Length` to update
  `markdownReflow.maxLineLength` from the command palette.
- New: Added a maximum line length editor ruler that follows `markdownReflow.maxLineLength`.
- New: Added `Markdown Reflow: Toggle Maximum Line Length Indicator` and
  `markdownReflow.showMaxLineLengthIndicator` to show or hide the ruler.
- New: Added `Markdown Reflow: Set Maximum Line Length Indicator Color` and
  `markdownReflow.maxLineLengthIndicatorColor` to set the ruler color.

## 0.3.0

- New: Generate an anchor-linked table of contents from Markdown headings.
- New: Replace generated table of contents blocks on rerun using managed HTML comment markers.

## 0.2.1

- Breaking: renamed the command from `wrap120.reflow` to `markdownReflow.reflow`.
- Breaking: renamed configuration keys from `wrap120.*` to `markdownReflow.*`.
- Changed the default prose wrap width from `120` to `100`.

## 0.1.0

- Initial command-driven Markdown/MDX prose reflow extension.
- Added `wrap120.reflow` with selection-aware paragraph wrapping.
- Preserved code fences, headings, blockquotes, tables, lists, frontmatter, MDX export blocks, and
  JSX/HTML blocks.
