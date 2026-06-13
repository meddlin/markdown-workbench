# Changelog

## Unreleased

- New: Automatically reflow Markdown/MDX prose while typing when an edited line exceeds the
  configured maximum line length.
- New: Added `markdownReflow.automaticReflow` to toggle automatic reflow on or off.

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
