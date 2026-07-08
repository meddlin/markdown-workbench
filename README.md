# Markdown Workbench <img width="256" height="256" alt="Markdown Workbench extension logo design" src="https://github.com/user-attachments/assets/73a67431-92f4-4d5d-afda-ecd915f90240" />


Automatic and manual prose reflow for Markdown and MDX in VS Code.

This extension automatically reflows Markdown prose while typing and adds commands for manually
reflowing Markdown prose and generating a table of contents from Markdown headings.

## Commands

- `Markdown Workbench: Reflow Prose` wraps plain prose paragraphs to a configurable line length.
- `Markdown Workbench: Set Maximum Line Length` updates the configured prose line length.
- `Markdown Workbench: Toggle Maximum Line Length Indicator` shows or hides the runtime line
  length indicator at the configured prose line length.
- `Markdown Workbench: Set Maximum Line Length Indicator Color` updates the indicator color
  using a common color name or custom hex color.
- `Markdown Workbench: Generate Table of Contents` inserts an anchor-linked table of contents near
  the top of the current document.

## Behavior

- Reflows the current selection when a selection exists and
  `markdownWorkbench.selectionOnlyWhenSelected` is enabled.
- Reflows the full document when there is no selection.
- Automatically reflows the current paragraph while typing when an edited line exceeds
  `markdownWorkbench.maxLineLength`.
- Wraps prose to `100` columns by default, or to the user-defined
  `markdownWorkbench.maxLineLength` value when set.
- Shows a runtime line length indicator at `markdownWorkbench.maxLineLength` by default without
  editing workspace settings.
- Updates `markdownWorkbench.maxLineLength` from the command palette when using
  `Markdown Workbench: Set Maximum Line Length`.
- Toggles `markdownWorkbench.showMaxLineLengthIndicator` from the command palette when using
  `Markdown Workbench: Toggle Maximum Line Length Indicator`.
- Updates `markdownWorkbench.maxLineLengthIndicatorColor` from the command palette when using
  `Markdown Workbench: Set Maximum Line Length Indicator Color`.
- Generates a table of contents from ATX headings (`#` through `######`) outside fenced code
  blocks and frontmatter.
- Inserts the table of contents after frontmatter when frontmatter exists.
- Replaces a previously generated table of contents between managed markers:
  `<!-- markdown-workbench-toc:start -->` and `<!-- markdown-workbench-toc:end -->` for Markdown,
  or `{/* markdown-workbench-toc:start */}` and `{/* markdown-workbench-toc:end */}` for MDX.
- Leaves these regions unchanged:
  - fenced code blocks
  - indented code blocks
  - ATX headings
  - blockquotes
  - tables
  - list items and list continuation blocks
  - frontmatter blocks
  - MDX import/export lines and export object blocks
  - JSX/HTML blocks

## Settings

- `markdownWorkbench.maxLineLength`
- `markdownWorkbench.automaticReflow`
- `markdownWorkbench.showMaxLineLengthIndicator`
- `markdownWorkbench.maxLineLengthIndicatorColor`
- `markdownWorkbench.languages`
- `markdownWorkbench.preserveListItems`
- `markdownWorkbench.selectionOnlyWhenSelected`

## Development

```bash
npm install
npm run build
npm test
```

To package the extension:

```bash
npm run package
```

Before publishing to the VS Code Marketplace, set final values for `publisher`, `repository`,
`homepage`, and `bugs` in `package.json`.
