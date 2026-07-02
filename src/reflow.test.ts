import { describe, expect, it } from 'vitest'

import { reflowMarkdownLike } from './reflow'

describe('reflowMarkdownLike', () => {
  it('wraps a long prose paragraph to the configured width', () => {
    let input =
      'This is a deliberately long paragraph that should be wrapped to a shorter line length without splitting any words in the process.\n'

    let output = reflowMarkdownLike(input, {
      maxLineLength: 40,
      preserveListItems: true,
    })

    expect(maxLineLength(output)).toBeLessThanOrEqual(40)
    expect(output).toContain('deliberately long paragraph')
  })

  it('leaves already short single-line prose unchanged', () => {
    let input = 'Short paragraph stays exactly as written.\n'

    let output = reflowMarkdownLike(input, {
      maxLineLength: 120,
      preserveListItems: true,
    })

    expect(output).toBe(input)
  })

  it('never splits a word when wrapping', () => {
    let input = 'supercalifragilisticexpialidocious short words follow here\n'

    let output = reflowMarkdownLike(input, {
      maxLineLength: 10,
      preserveListItems: true,
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
      preserveListItems: true,
    })

    expect(output).toContain('\n\n')
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
      preserveListItems: true,
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
      preserveListItems: true,
    })

    expect(output).toContain(`\`\`\`\n${codeLine}\n\`\`\``)
    expect(maxLineLength(extractParagraph(output, 'This prose paragraph'))).toBeLessThanOrEqual(44)
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
      preserveListItems: true,
    })

    expect(output).toContain(
      '<Callout tone="warning">\nThis content should stay exactly where it is inside the JSX block.\n</Callout>',
    )
    expect(maxLineLength(extractParagraph(output, 'This paragraph should wrap'))).toBeLessThanOrEqual(44)
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
        preserveListItems: true,
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
})

function maxLineLength(text: string): number {
  return text.split('\n').reduce((max, line) => Math.max(max, line.length), 0)
}

function extractParagraph(text: string, startsWith: string): string {
  return text
    .split('\n\n')
    .find((paragraph) => paragraph.startsWith(startsWith)) ?? ''
}
