import { describe, expect, it } from 'vitest'

import {
  buildTableOfContentsLines,
  insertMarkdownTableOfContents,
  slugifyHeading,
} from './toc'

describe('insertMarkdownTableOfContents', () => {
  it('inserts a nested anchor-linked table of contents from headings', () => {
    let input = [
      '# Head 1',
      'some content',
      '## Sub-head 2',
      '### sub-head 3',
      'more content',
      '## Sub-head 2a',
      '# Another heading',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input)

    expect(output).toBe([
      '<!-- markdown-workbench-toc:start -->',
      '- [Head 1](#head-1)',
      '  - [Sub-head 2](#sub-head-2)',
      '    - [sub-head 3](#sub-head-3)',
      '  - [Sub-head 2a](#sub-head-2a)',
      '- [Another heading](#another-heading)',
      '<!-- markdown-workbench-toc:end -->',
      '',
      '# Head 1',
      'some content',
      '## Sub-head 2',
      '### sub-head 3',
      'more content',
      '## Sub-head 2a',
      '# Another heading',
      '',
    ].join('\n'))
    expect(output).not.toContain('{/* markdown-workbench-toc:start */}')
    expect(output).not.toContain('{/* markdown-workbench-toc:end */}')
  })

  it('generates duplicate heading suffixes', () => {
    let tocLines = buildTableOfContentsLines([
      { level: 1, text: 'Install' },
      { level: 2, text: 'Install' },
      { level: 2, text: 'Install!' },
    ])

    expect(tocLines).toEqual([
      '<!-- markdown-workbench-toc:start -->',
      '- [Install](#install)',
      '  - [Install](#install-1)',
      '  - [Install!](#install-2)',
      '<!-- markdown-workbench-toc:end -->',
    ])
    expect(tocLines).not.toContain('{/* markdown-workbench-toc:start */}')
    expect(tocLines).not.toContain('{/* markdown-workbench-toc:end */}')
  })

  it('generates mdx comment markers when requested', () => {
    let tocLines = buildTableOfContentsLines([
      { level: 1, text: 'Install' },
    ], 'mdx')

    expect(tocLines).toEqual([
      '{/* markdown-workbench-toc:start */}',
      '- [Install](#install)',
      '{/* markdown-workbench-toc:end */}',
    ])
    expect(tocLines).not.toContain('<!-- markdown-workbench-toc:start -->')
    expect(tocLines).not.toContain('<!-- markdown-workbench-toc:end -->')
  })

  it('inserts after frontmatter', () => {
    let input = [
      '---',
      'title: Example',
      '---',
      '',
      '# Heading',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input)

    expect(output).toBe([
      '---',
      'title: Example',
      '---',
      '',
      '<!-- markdown-workbench-toc:start -->',
      '- [Heading](#heading)',
      '<!-- markdown-workbench-toc:end -->',
      '',
      '# Heading',
      '',
    ].join('\n'))
  })

  it('ignores heading-looking lines inside frontmatter', () => {
    let input = [
      '---',
      'title: # Not a document heading',
      '---',
      '',
      '# Real heading',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input)

    expect(output).toContain('- [Real heading](#real-heading)')
    expect(output).not.toContain('not-a-document-heading')
  })

  it('replaces an existing managed table of contents', () => {
    let input = [
      '<!-- markdown-workbench-toc:start -->',
      '- [Old](#old)',
      '<!-- markdown-workbench-toc:end -->',
      '',
      '# New',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input)

    expect(output).toBe([
      '<!-- markdown-workbench-toc:start -->',
      '- [New](#new)',
      '<!-- markdown-workbench-toc:end -->',
      '',
      '# New',
      '',
    ].join('\n'))
  })

  it('does not treat legacy markdown-reflow markers as managed table of contents markers', () => {
    let input = [
      '<!-- markdown-reflow-toc:start -->',
      '- [Old](#old)',
      '<!-- markdown-reflow-toc:end -->',
      '',
      '# New',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input)

    expect(output).toBe([
      '<!-- markdown-workbench-toc:start -->',
      '- [New](#new)',
      '<!-- markdown-workbench-toc:end -->',
      '',
      '<!-- markdown-reflow-toc:start -->',
      '- [Old](#old)',
      '<!-- markdown-reflow-toc:end -->',
      '',
      '# New',
      '',
    ].join('\n'))
  })

  it('replaces an existing managed table of contents surrounded by other content', () => {
    let input = [
      'Intro text stays in the document.',
      '',
      '<!-- markdown-workbench-toc:start -->',
      '- [Old](#old)',
      '<!-- markdown-workbench-toc:end -->',
      '',
      '# New',
      '',
      'Closing text stays in the document.',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input)

    expect(output).toContain('- [New](#new)')
    expect(output).not.toContain('- [Old](#old)')
    expect(output).toContain('Intro text stays in the document.')
    expect(output).toContain('Closing text stays in the document.')
  })

  it('does not duplicate a managed table of contents on repeated runs', () => {
    let input = [
      '# Heading',
      '',
      'Text',
      '',
    ].join('\n')

    let once = insertMarkdownTableOfContents(input)
    let twice = insertMarkdownTableOfContents(once)

    expect(twice).toBe(once)
    expect(twice.match(/markdown-workbench-toc:start/g)).toHaveLength(1)
  })

  it('ignores headings inside fences and the managed table of contents', () => {
    let input = [
      '<!-- markdown-workbench-toc:start -->',
      '- [Old](#old)',
      '<!-- markdown-workbench-toc:end -->',
      '',
      '```',
      '# Not a real heading',
      '```',
      '',
      '# Real heading',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input)

    expect(output).toContain('- [Real heading](#real-heading)')
    expect(output).not.toContain('not-a-real-heading')
    expect(output).not.toContain('- [Old](#old)')
  })

  it('inserts an mdx-safe table of contents when requested', () => {
    let input = [
      '# Heading',
      '',
      'Text',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input, 'mdx')

    expect(output).toBe([
      '{/* markdown-workbench-toc:start */}',
      '- [Heading](#heading)',
      '{/* markdown-workbench-toc:end */}',
      '',
      '# Heading',
      '',
      'Text',
      '',
    ].join('\n'))
    expect(output).not.toContain('<!-- markdown-workbench-toc:start -->')
    expect(output).not.toContain('<!-- markdown-workbench-toc:end -->')
  })

  it('replaces an existing managed mdx table of contents', () => {
    let input = [
      '{/* markdown-workbench-toc:start */}',
      '- [Old](#old)',
      '{/* markdown-workbench-toc:end */}',
      '',
      '# New',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input, 'mdx')

    expect(output).toBe([
      '{/* markdown-workbench-toc:start */}',
      '- [New](#new)',
      '{/* markdown-workbench-toc:end */}',
      '',
      '# New',
      '',
    ].join('\n'))
  })

  it('migrates an existing html-marker table of contents to mdx markers', () => {
    let input = [
      '<!-- markdown-workbench-toc:start -->',
      '- [Old](#old)',
      '<!-- markdown-workbench-toc:end -->',
      '',
      '# New',
      '',
    ].join('\n')

    let output = insertMarkdownTableOfContents(input, 'mdx')

    expect(output).toBe([
      '{/* markdown-workbench-toc:start */}',
      '- [New](#new)',
      '{/* markdown-workbench-toc:end */}',
      '',
      '# New',
      '',
    ].join('\n'))
  })

  it('preserves crlf line endings and trailing newline behavior', () => {
    let input = '# Heading\r\nText'
    let output = insertMarkdownTableOfContents(input)

    expect(output).toBe([
      '<!-- markdown-workbench-toc:start -->',
      '- [Heading](#heading)',
      '<!-- markdown-workbench-toc:end -->',
      '',
      '# Heading',
      'Text',
    ].join('\r\n'))
  })

  it('leaves documents without headings unchanged', () => {
    let input = 'Plain paragraph only.\n'

    expect(insertMarkdownTableOfContents(input)).toBe(input)
  })
})

describe('slugifyHeading', () => {
  it('normalizes common markdown heading punctuation', () => {
    expect(slugifyHeading('Use `code`, *emphasis*, and links!')).toBe(
      'use-code-emphasis-and-links',
    )
  })

  it('normalizes inline link markup, html tags, punctuation, and duplicate slugs', () => {
    expect(slugifyHeading('Read [Docs](https://example.com), then <Code>Ship</Code>!')).toBe(
      'read-docshttpsexamplecom-then-ship',
    )

    expect(
      buildTableOfContentsLines([
        { level: 2, text: 'Read [Docs](https://example.com), then <Code>Ship</Code>!' },
        { level: 2, text: 'Read Docshttps://example.com then Ship' },
      ]),
    ).toEqual([
      '<!-- markdown-workbench-toc:start -->',
      '  - [Read \\[Docs\\](https://example.com), then <Code>Ship</Code>!](#read-docshttpsexamplecom-then-ship)',
      '  - [Read Docshttps://example.com then Ship](#read-docshttpsexamplecom-then-ship-1)',
      '<!-- markdown-workbench-toc:end -->',
    ])
  })
})
