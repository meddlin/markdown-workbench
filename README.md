# Markdown Reflow <img width="256" height="256" alt="Markdown reflow extension logo design" src="https://github.com/user-attachments/assets/73a67431-92f4-4d5d-afda-ecd915f90240" />


Automatic and manual prose reflow for Markdown and MDX in VS Code.

This extension automatically reflows Markdown prose while typing and adds commands for manually
reflowing Markdown prose and generating a table of contents from Markdown headings.

## Commands

- `Markdown Reflow: Reflow Prose` wraps plain prose paragraphs to a configurable line length.
- `Markdown Reflow: Generate Table of Contents` inserts an anchor-linked table of contents near
  the top of the current document.

## Behavior

- Reflows the current selection when a selection exists and
  `markdownReflow.selectionOnlyWhenSelected` is enabled.
- Reflows the full document when there is no selection.
- Automatically reflows the current paragraph while typing when an edited line exceeds
  `markdownReflow.maxLineLength`.
- Wraps prose to `100` columns by default, or to the user-defined
  `markdownReflow.maxLineLength` value when set.
- Generates a table of contents from ATX headings (`#` through `######`) outside fenced code
  blocks and frontmatter.
- Inserts the table of contents after frontmatter when frontmatter exists.
- Replaces a previously generated table of contents between
  `<!-- markdown-reflow-toc:start -->` and `<!-- markdown-reflow-toc:end -->`.
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

- `markdownReflow.maxLineLength`
- `markdownReflow.automaticReflow`
- `markdownReflow.languages`
- `markdownReflow.preserveListItems`
- `markdownReflow.selectionOnlyWhenSelected`

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
