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
      '<!-- markdown-reflow-toc:start -->',
      '- [Head 1](#head-1)',
      '  - [Sub-head 2](#sub-head-2)',
      '    - [sub-head 3](#sub-head-3)',
      '  - [Sub-head 2a](#sub-head-2a)',
      '- [Another heading](#another-heading)',
      '<!-- markdown-reflow-toc:end -->',
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
  })

  it('generates duplicate heading suffixes', () => {
    let tocLines = buildTableOfContentsLines([
      { level: 1, text: 'Install' },
      { level: 2, text: 'Install' },
      { level: 2, text: 'Install!' },
    ])

    expect(tocLines).toEqual([
      '<!-- markdown-reflow-toc:start -->',
      '- [Install](#install)',
      '  - [Install](#install-1)',
      '  - [Install!](#install-2)',
      '<!-- markdown-reflow-toc:end -->',
    ])
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
      '<!-- markdown-reflow-toc:start -->',
      '- [Heading](#heading)',
      '<!-- markdown-reflow-toc:end -->',
      '',
      '# Heading',
      '',
    ].join('\n'))
  })

  it('replaces an existing managed table of contents', () => {
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
      '<!-- markdown-reflow-toc:start -->',
      '- [New](#new)',
      '<!-- markdown-reflow-toc:end -->',
      '',
      '# New',
      '',
    ].join('\n'))
  })

  it('ignores headings inside fences and the managed table of contents', () => {
    let input = [
      '<!-- markdown-reflow-toc:start -->',
      '- [Old](#old)',
      '<!-- markdown-reflow-toc:end -->',
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

  it('preserves crlf line endings and trailing newline behavior', () => {
    let input = '# Heading\r\nText'
    let output = insertMarkdownTableOfContents(input)

    expect(output).toBe([
      '<!-- markdown-reflow-toc:start -->',
      '- [Heading](#heading)',
      '<!-- markdown-reflow-toc:end -->',
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
})
