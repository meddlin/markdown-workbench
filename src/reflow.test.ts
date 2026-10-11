import { describe, expect, it } from 'vitest'

import { reflowMarkdownLike } from './reflow'

describe('reflowMarkdownLike', () => {
  it('wraps a long prose paragraph to the configured width', () => {
    let input =
      'This is a deliberately long paragraph that should be wrapped to a shorter line length without splitting any words in the process.\n'

    let output = reflowMarkdownLike(input, {
      maxLineLength: 40,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(maxLineLength(output)).toBeLessThanOrEqual(40)
    expect(output).toContain('deliberately long paragraph')
  })

  it('leaves already short single-line prose unchanged', () => {
    let input = 'Short paragraph stays exactly as written.\n'

    let output = reflowMarkdownLike(input, {
      maxLineLength: 120,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output).toBe(input)
  })

  it('never splits a word when wrapping', () => {
    let input = 'supercalifragilisticexpialidocious short words follow here\n'

    let output = reflowMarkdownLike(input, {
      maxLineLength: 10,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output.split('\n')[0]).toBe('supercalifragilisticexpialidocious')
  })

  it('preserves blank lines between paragraphs', () => {
    let input = [
      'This first paragraph needs wrapping because it is much longer than the target width for the test.',
      '',
      'This second paragraph also needs wrapping and should stay separated by the same blank line.',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(input, {
      maxLineLength: 36,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output).toContain('\n\n')
  })

  it('preserves crlf line endings when wrapping', () => {
    let input = [
      'This paragraph should wrap while keeping Windows style line endings throughout the output.',
      '',
    ].join('\r\n')

    let output = reflowMarkdownLike(input, {
      maxLineLength: 38,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output).toContain('\r\n')
    expect(output.replaceAll('\r\n', '')).not.toContain('\n')
    expect(maxLineLength(output)).toBeLessThanOrEqual(38)
  })

  it('protects yaml and toml frontmatter blocks', () => {
    let yamlFrontmatter = [
      '---',
      'title: A heading-looking # value should remain untouched',
      '---',
      '',
      'This paragraph should wrap after yaml frontmatter because it is ordinary prose.',
      '',
    ].join('\n')
    let tomlFrontmatter = [
      '+++',
      'title = "A heading-looking # value should remain untouched"',
      '+++',
      '',
      'This paragraph should wrap after toml frontmatter because it is ordinary prose.',
      '',
    ].join('\n')

    expect(
      reflowMarkdownLike(yamlFrontmatter, {
        maxLineLength: 40,
        reflowListItems: false,
        reflowOrderedListItems: false,
      }),
    ).toContain('title: A heading-looking # value should remain untouched\n')
    expect(
      reflowMarkdownLike(tomlFrontmatter, {
        maxLineLength: 40,
        reflowListItems: false,
        reflowOrderedListItems: false,
      }),
    ).toContain('title = "A heading-looking # value should remain untouched"\n')
  })

  it('leaves markdown and mdx protected regions unchanged while reflowing prose', () => {
    let input = [
      'export const article = {',
      "  slug: 'example-post',",
      "  title: 'Example Post',",
      '}',
      '',
      '# Heading',
      '',
      'This is a very long paragraph that should wrap because it is plain prose and not part of a protected markdown block.',
      '',
      '- A list item should stay exactly as written even if it is very long and would otherwise exceed the configured line length.',
      '  Continuation text for the same list item should also remain untouched in this first version.',
      '',
      '> Blockquotes stay untouched as well even when they are very wide and could be wrapped by the prose algorithm.',
      '',
      '| Column A | Column B |',
      '| --- | --- |',
      '| Value | Another value |',
      '',
      '```ts',
      "let code = 'stays the same'",
      '```',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(input, {
      maxLineLength: 48,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output).toContain('export const article = {\n')
    expect(output).toContain('# Heading\n')
    expect(output).toContain(
      '- A list item should stay exactly as written even if it is very long and would otherwise exceed the configured line length.\n',
    )
    expect(output).toContain(
      '| Column A | Column B |\n| --- | --- |\n| Value | Another value |\n',
    )
    expect(output).toContain("```ts\nlet code = 'stays the same'\n```")
    expect(maxLineLength(extractParagraph(output, 'This is a very long paragraph'))).toBeLessThanOrEqual(48)
  })

  it('protects untyped fenced code blocks', () => {
    let codeLine = 'this code line should stay exactly as written even though it is much wider than the configured line length'
    let input = [
      '```',
      codeLine,
      '```',
      '',
      'This prose paragraph should still wrap after the fenced block because it is outside protected markdown.',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(input, {
      maxLineLength: 44,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output).toContain(`\`\`\`\n${codeLine}\n\`\`\``)
    expect(maxLineLength(extractParagraph(output, 'This prose paragraph'))).toBeLessThanOrEqual(44)
  })

  it('protects tilde fenced code blocks', () => {
    let codeLine = 'this tilde fenced code line should stay exactly as written even when it is long'
    let input = [
      '~~~md',
      codeLine,
      '~~~',
      '',
      'This prose paragraph should still wrap after the tilde fenced block.',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(input, {
      maxLineLength: 38,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output).toContain(`~~~md\n${codeLine}\n~~~`)
    expect(maxLineLength(extractParagraph(output, 'This prose paragraph'))).toBeLessThanOrEqual(38)
  })

  it('leaves jsx blocks unchanged', () => {
    let input = [
      '<Callout tone="warning">',
      'This content should stay exactly where it is inside the JSX block.',
      '</Callout>',
      '',
      'This paragraph should wrap because it is regular prose after the JSX block and longer than the target width.',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(input, {
      maxLineLength: 44,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output).toContain(
      '<Callout tone="warning">\nThis content should stay exactly where it is inside the JSX block.\n</Callout>',
    )
    expect(maxLineLength(extractParagraph(output, 'This paragraph should wrap'))).toBeLessThanOrEqual(44)
  })

  it('leaves nested jsx blocks unchanged', () => {
    let input = [
      '<Tabs>',
      '  <Tab title="One">',
      'This nested content should stay exactly where it is inside the MDX JSX block.',
      '  </Tab>',
      '</Tabs>',
      '',
      'This paragraph should wrap because it is regular prose after the nested JSX block.',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(input, {
      maxLineLength: 44,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output).toContain(
      '<Tabs>\n  <Tab title="One">\nThis nested content should stay exactly where it is inside the MDX JSX block.\n  </Tab>\n</Tabs>',
    )
    expect(maxLineLength(extractParagraph(output, 'This paragraph should wrap'))).toBeLessThanOrEqual(44)
  })

  it('leaves import and export blocks unchanged when strings contain braces', () => {
    let input = [
      'export const metadata = {',
      '  title: "A value with {braces} that should not change block depth",',
      '  description: `Template text with {braces} should stay protected`,',
      '}',
      '',
      'This prose paragraph should wrap after the export block because it is ordinary text.',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(input, {
      maxLineLength: 42,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output).toContain(
      'export const metadata = {\n  title: "A value with {braces} that should not change block depth",\n  description: `Template text with {braces} should stay protected`,\n}',
    )
    expect(maxLineLength(extractParagraph(output, 'This prose paragraph'))).toBeLessThanOrEqual(42)
  })

  it('preserves the first line indentation when wrapping an indented paragraph', () => {
    let input = '  This indented paragraph should wrap while keeping the leading spaces on each wrapped output line.\n'

    let output = reflowMarkdownLike(input, {
      maxLineLength: 34,
      reflowListItems: false,
      reflowOrderedListItems: false,
    })

    expect(output.split('\n').filter(Boolean).every((line) => line.startsWith('  '))).toBe(true)
    expect(maxLineLength(output)).toBeLessThanOrEqual(34)
  })

  it('only reflows paragraphs that intersect the selected line range', () => {
    let input = [
      'This is the first paragraph and it should be reflowed because the selection intersects it directly.',
      '',
      'This second paragraph is also long but should remain untouched because the selection does not reach it.',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(
      input,
      {
        maxLineLength: 40,
        reflowListItems: false,
        reflowOrderedListItems: false,
      },
      {
        startLine: 0,
        endLine: 0,
      },
    )

    let [firstParagraph, secondParagraph] = output.trimEnd().split('\n\n')
    expect(maxLineLength(firstParagraph)).toBeLessThanOrEqual(40)
    expect(secondParagraph).toBe(
      'This second paragraph is also long but should remain untouched because the selection does not reach it.',
    )
  })

  it('reflows a whole paragraph when the selected range intersects only one line in it', () => {
    let input = [
      'This paragraph is already split',
      'across two source lines and should be reflowed as one selected paragraph block.',
      '',
      'This second paragraph should remain untouched because the selection does not intersect it.',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(
      input,
      {
        maxLineLength: 42,
        reflowListItems: false,
        reflowOrderedListItems: false,
      },
      {
        startLine: 1,
        endLine: 1,
      },
    )

    let [firstParagraph, secondParagraph] = output.trimEnd().split('\n\n')
    expect(maxLineLength(firstParagraph)).toBeLessThanOrEqual(42)
    expect(secondParagraph).toBe(
      'This second paragraph should remain untouched because the selection does not intersect it.',
    )
  })
})

describe('reflowMarkdownLike list items', () => {
  let on = { maxLineLength: 30, reflowListItems: true, reflowOrderedListItems: true }
  let off = { maxLineLength: 30, reflowListItems: false, reflowOrderedListItems: false }

  it('wraps an unordered list item with continuation lines aligned under the item text', () => {
    let input = '- first item is fairly long and needs wrapping here\n'

    expect(reflowMarkdownLike(input, on)).toBe(
      ['- first item is fairly long', '  and needs wrapping here', ''].join('\n'),
    )
  })

  it('keeps consecutive list items separate', () => {
    let input = [
      '- first item is fairly long and needs wrapping here',
      '- second item is also long and needs wrapping too',
      '',
    ].join('\n')

    expect(reflowMarkdownLike(input, on)).toBe(
      [
        '- first item is fairly long',
        '  and needs wrapping here',
        '- second item is also long and',
        '  needs wrapping too',
        '',
      ].join('\n'),
    )
  })

  it.each(['-', '*', '+'])('supports the %s bullet marker', (marker) => {
    let output = reflowMarkdownLike(`${marker} first item is fairly long and needs wrapping\n`, on)

    expect(output).toBe(`${marker} first item is fairly long\n  and needs wrapping\n`)
  })

  it('joins lazy continuation lines into the item before wrapping', () => {
    let input = '- short start\ncontinued on a lazy line\n  and an indented one\n'

    expect(reflowMarkdownLike(input, on)).toBe(
      ['- short start continued on a', '  lazy line and an indented', '  one', ''].join('\n'),
    )
  })

  it('wraps nested items independently using their own indentation', () => {
    let input = [
      '- parent item with enough words to wrap',
      '  - nested item with enough words to wrap too',
      '',
    ].join('\n')

    expect(reflowMarkdownLike(input, on)).toBe(
      [
        '- parent item with enough',
        '  words to wrap',
        '  - nested item with enough',
        '    words to wrap too',
        '',
      ].join('\n'),
    )
  })

  it('uses the full marker width as the hanging indent when extra spaces follow the marker', () => {
    let input = '-   first item is fairly long and needs wrapping\n'

    expect(reflowMarkdownLike(input, on)).toBe(
      ['-   first item is fairly long', '    and needs wrapping', ''].join('\n'),
    )
  })

  it('keeps task list checkboxes attached to the first word', () => {
    let input = '- [ ] a task whose checkbox must not be split\n- [x] done\n'

    let output = reflowMarkdownLike(input, { ...on, maxLineLength: 12 })

    expect(output).toBe(
      ['- [ ] a task', '  whose', '  checkbox', '  must not', '  be split', '- [x] done', ''].join('\n'),
    )
  })

  it('does not let a wrapped line begin with a list marker or heading marker', () => {
    let input = '- alpha beta gamma - delta epsilon # zeta eta theta\n'

    let output = reflowMarkdownLike(input, { ...on, maxLineLength: 18 })

    for (let line of output.trimEnd().split('\n').slice(1)) {
      expect(line).toMatch(/^ {2}[^-#\s]/)
    }
    expect(output.replace(/\n {2}/g, ' ')).toBe(input)
  })

  it('leaves items that fit within the limit unchanged', () => {
    let input = '- short item\n  - nested short item\n'

    expect(reflowMarkdownLike(input, on)).toBe(input)
  })

  it('is idempotent', () => {
    let input = [
      '- first item is fairly long and needs wrapping here',
      '  - nested item with enough words to wrap too',
      '- [ ] a task whose checkbox must not be split',
      '',
    ].join('\n')

    let once = reflowMarkdownLike(input, on)

    expect(reflowMarkdownLike(once, on)).toBe(once)
  })

  it('wraps items separated by blank lines and preserves the blank lines', () => {
    let input = '- first item is fairly long and needs wrapping\n\n- second item is also long and wraps\n'

    expect(reflowMarkdownLike(input, on)).toBe(
      [
        '- first item is fairly long',
        '  and needs wrapping',
        '',
        '- second item is also long and',
        '  wraps',
        '',
      ].join('\n'),
    )
  })

  it('preserves CRLF line endings', () => {
    let input = '- first item is fairly long and needs wrapping\r\n'

    expect(reflowMarkdownLike(input, on)).toBe(
      '- first item is fairly long\r\n  and needs wrapping\r\n',
    )
  })

  it('does not merge a list into the paragraph above it', () => {
    let input = 'Intro paragraph text\n- first item is fairly long and needs wrapping\n'

    expect(reflowMarkdownLike(input, on)).toBe(
      ['Intro paragraph text', '- first item is fairly long', '  and needs wrapping', ''].join('\n'),
    )
  })

  it('only wraps items that intersect the selection', () => {
    let input = [
      '- first item is fairly long and needs wrapping',
      '- second item is also long and needs wrapping',
      '',
    ].join('\n')

    let output = reflowMarkdownLike(input, on, { startLine: 1, endLine: 1 })

    expect(output).toBe(
      [
        '- first item is fairly long and needs wrapping',
        '- second item is also long and',
        '  needs wrapping',
        '',
      ].join('\n'),
    )
  })

  it('leaves list items unchanged when list reflow is disabled', () => {
    let input = '- first item is fairly long and needs wrapping here\n- second item is also long and needs wrapping too\n'

    expect(reflowMarkdownLike(input, off)).toBe(input)
  })

  it('wraps an ordered list item with continuation lines aligned under the item text', () => {
    let input = '1. first item is fairly long and needs wrapping here\n'

    expect(reflowMarkdownLike(input, on)).toBe(
      ['1. first item is fairly long', '   and needs wrapping here', ''].join('\n'),
    )
  })

  it('uses a wider hanging indent for multi-digit numbers and ) delimiters', () => {
    let input = '10) tenth item is fairly long and needs wrapping\n'

    expect(reflowMarkdownLike(input, on)).toBe(
      ['10) tenth item is fairly long', '    and needs wrapping', ''].join('\n'),
    )
  })

  it('keeps consecutive ordered items separate and does not renumber them', () => {
    let input = [
      '1. first item is fairly long and needs wrapping',
      '3. second item is also long and needs wrapping',
      '',
    ].join('\n')

    expect(reflowMarkdownLike(input, on)).toBe(
      [
        '1. first item is fairly long',
        '   and needs wrapping',
        '3. second item is also long',
        '   and needs wrapping',
        '',
      ].join('\n'),
    )
  })

  it('wraps unordered items nested inside ordered items and the reverse', () => {
    let input = [
      '1. ordered parent with enough words to wrap',
      '   - nested bullet with enough words to wrap',
      '- bullet parent with enough words to wrap',
      '  1. nested number with enough words to wrap',
      '',
    ].join('\n')

    expect(reflowMarkdownLike(input, on)).toBe(
      [
        '1. ordered parent with enough',
        '   words to wrap',
        '   - nested bullet with enough',
        '     words to wrap',
        '- bullet parent with enough',
        '  words to wrap',
        '  1. nested number with enough',
        '     words to wrap',
        '',
      ].join('\n'),
    )
  })

  it('does not let a wrapped line begin with an ordered list marker', () => {
    let input = '1. alpha beta gamma released in 1986. delta epsilon zeta\n'

    let output = reflowMarkdownLike(input, { ...on, maxLineLength: 28 })

    for (let line of output.trimEnd().split('\n').slice(1)) {
      expect(line).not.toMatch(/^\s*\d+[.)]/)
    }
    expect(output.replace(/\n {3}/g, ' ')).toBe(input)
  })

  it('is idempotent for ordered lists', () => {
    let input = '1. first item is fairly long and needs wrapping here\n   1. nested number with enough words to wrap\n'

    let once = reflowMarkdownLike(input, on)

    expect(reflowMarkdownLike(once, on)).toBe(once)
  })

  it('leaves ordered list items unchanged when only ordered reflow is disabled', () => {
    let input = '1. first item is fairly long and needs wrapping here\n   continuation stays put\n'

    expect(reflowMarkdownLike(input, { ...on, reflowOrderedListItems: false })).toBe(input)
  })

  it('leaves unordered list items unchanged when only unordered reflow is disabled', () => {
    let input = '- first item is fairly long and needs wrapping here\n'

    expect(reflowMarkdownLike(input, { ...on, reflowListItems: false })).toBe(input)
  })

  it('wraps each list kind independently when the other kind is disabled', () => {
    let input = [
      '- bullet item is fairly long and needs wrapping',
      '',
      '1. numbered item is fairly long and needs wrapping',
      '',
    ].join('\n')

    expect(reflowMarkdownLike(input, { ...on, reflowOrderedListItems: false })).toBe(
      [
        '- bullet item is fairly long',
        '  and needs wrapping',
        '',
        '1. numbered item is fairly long and needs wrapping',
        '',
      ].join('\n'),
    )
    expect(reflowMarkdownLike(input, { ...on, reflowListItems: false })).toBe(
      [
        '- bullet item is fairly long and needs wrapping',
        '',
        '1. numbered item is fairly',
        '   long and needs wrapping',
        '',
      ].join('\n'),
    )
  })

  it('leaves thematic breaks that look like list markers unchanged', () => {
    let input = '- - -\n* * *\n'

    expect(reflowMarkdownLike(input, on)).toBe(input)
  })

  it.each([
    ['a fenced code block', ['- ```ts', '  let value = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8', '  ```']],
    ['a heading', ['- # heading text that is longer than the configured limit']],
    ['a blockquote', ['- > quoted text that is longer than the configured limit']],
    ['a nested marker', ['- - nested text that is longer than the configured limit']],
    ['html', ['- <kbd>Ctrl</kbd> text that is longer than the configured limit']],
  ])('leaves an item whose content starts with %s unchanged', (_name, lines) => {
    let input = `${lines.join('\n')}\n`

    expect(reflowMarkdownLike(input, on)).toBe(input)
  })

  it('leaves fenced code nested inside an item unchanged', () => {
    let input = [
      '- item introducing a long code sample below',
      '  ```ts',
      '  let value = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9',
      '  ```',
      '',
    ].join('\n')

    expect(reflowMarkdownLike(input, on)).toBe(
      [
        '- item introducing a long code',
        '  sample below',
        '  ```ts',
        '  let value = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9',
        '  ```',
        '',
      ].join('\n'),
    )
  })

  it('does not join a setext underline into the item text', () => {
    let input = '- item text\n  ---\n'

    expect(reflowMarkdownLike(input, on)).toBe(input)
  })

  it('leaves list items inside indented code blocks unchanged', () => {
    let input = 'Paragraph.\n\n    - code that is longer than the configured limit for sure\n'

    expect(reflowMarkdownLike(input, on)).toBe(input)
  })
})

function maxLineLength(text: string): number {
  return text.split('\n').reduce((max, line) => Math.max(max, line.length), 0)
}

function extractParagraph(text: string, startsWith: string): string {
  return text
    .split('\n\n')
    .find((paragraph) => paragraph.startsWith(startsWith)) ?? ''
}
