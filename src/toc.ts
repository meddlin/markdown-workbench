export const tocStartMarker = '<!-- markdown-workbench-toc:start -->'
export const tocEndMarker = '<!-- markdown-workbench-toc:end -->'
export const mdxTocStartMarker = '{/* markdown-workbench-toc:start */}'
export const mdxTocEndMarker = '{/* markdown-workbench-toc:end */}'

export type TocMarkerStyle = 'markdown' | 'mdx'

interface Heading {
  level: number
  text: string
}

interface ManagedTocRange {
  startLine: number
  endLine: number
}

interface TocMarkers {
  start: string
  end: string
}

export function insertMarkdownTableOfContents(
  text: string,
  markerStyle: TocMarkerStyle = 'markdown',
): string {
  let eol = text.includes('\r\n') ? '\r\n' : '\n'
  let hasTrailingEol = text.endsWith('\n')
  let lines = text.split(/\r?\n/)

  if (hasTrailingEol) {
    lines.pop()
  }

  let managedTocRange = findManagedTocRange(lines)
  let linesWithoutToc = managedTocRange
    ? removeManagedToc(lines, managedTocRange)
    : [...lines]
  let headings = extractMarkdownHeadings(linesWithoutToc)

  if (headings.length === 0) {
    return text
  }

  let tocLines = buildTableOfContentsLines(headings, markerStyle)
  let insertLine = findTocInsertLine(linesWithoutToc)
  let nextLines = [
    ...linesWithoutToc.slice(0, insertLine),
    ...tocLines,
    '',
    ...linesWithoutToc.slice(insertLine),
  ]

  let result = nextLines.join(eol)

  if (hasTrailingEol) {
    result += eol
  }

  return result
}

export function buildTableOfContentsLines(
  headings: Heading[],
  markerStyle: TocMarkerStyle = 'markdown',
): string[] {
  let markers = getTocMarkers(markerStyle)
  let slugCounts = new Map<string, number>()

  return [
    markers.start,
    ...headings.map((heading) => {
      let baseSlug = slugifyHeading(heading.text)
      let seenCount = slugCounts.get(baseSlug) ?? 0
      slugCounts.set(baseSlug, seenCount + 1)

      let slug = seenCount === 0 ? baseSlug : `${baseSlug}-${seenCount}`
      let indent = '  '.repeat(Math.max(0, heading.level - 1))

      return `${indent}- [${escapeLinkText(heading.text)}](#${slug})`
    }),
    markers.end,
  ]
}

export function extractMarkdownHeadings(lines: string[]): Heading[] {
  let headings: Heading[] = []
  let inFence = false
  let fenceChar = ''
  let fenceLength = 0
  let inFrontmatter = false
  let frontmatterDelimiter = ''
  let inManagedToc = false

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index]
    let trimmed = line.trim()

    if (isTocStartMarker(trimmed)) {
      inManagedToc = true
      continue
    }

    if (inManagedToc) {
      if (isTocEndMarker(trimmed)) {
        inManagedToc = false
      }
      continue
    }

    if (inFence) {
      if (isFenceClose(line, fenceChar, fenceLength)) {
        inFence = false
      }
      continue
    }

    if (inFrontmatter) {
      if (trimmed === frontmatterDelimiter) {
        inFrontmatter = false
      }
      continue
    }

    if (index === 0 && isFrontmatterStart(trimmed)) {
      inFrontmatter = true
      frontmatterDelimiter = trimmed
      continue
    }

    if (isFenceStart(line)) {
      let match = line.match(/^\s*([`~]{3,})/)

      if (match) {
        fenceChar = match[1][0]
        fenceLength = match[1].length
        inFence = true
      }

      continue
    }

    let heading = parseHeading(trimmed)

    if (heading) {
      headings.push(heading)
    }
  }

  return headings
}

export function slugifyHeading(text: string): string {
  let slug = text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[`*_~[\](){}]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  return slug.length > 0 ? slug : 'heading'
}

function parseHeading(trimmedLine: string): Heading | undefined {
  let match = trimmedLine.match(/^(#{1,6})(?:\s+|$)(.*)$/)

  if (!match) {
    return undefined
  }

  let text = match[2].replace(/\s+#+\s*$/, '').trim()

  if (text.length === 0) {
    return undefined
  }

  return {
    level: match[1].length,
    text,
  }
}

function findManagedTocRange(lines: string[]): ManagedTocRange | undefined {
  let startLine = lines.findIndex((line) => isTocStartMarker(line.trim()))

  if (startLine < 0) {
    return undefined
  }

  let endLine = lines.findIndex(
    (line, index) => index > startLine && isTocEndMarker(line.trim()),
  )

  if (endLine < 0) {
    return undefined
  }

  return {
    startLine,
    endLine,
  }
}

function removeManagedToc(lines: string[], range: ManagedTocRange): string[] {
  let removeEndLine = range.endLine

  if (lines[removeEndLine + 1] === '') {
    removeEndLine += 1
  }

  return [
    ...lines.slice(0, range.startLine),
    ...lines.slice(removeEndLine + 1),
  ]
}

function findTocInsertLine(lines: string[]): number {
  if (!isFrontmatterStart(lines[0]?.trim() ?? '')) {
    return 0
  }

  let delimiter = lines[0].trim()

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === delimiter) {
      return lines[index + 1] === '' ? index + 2 : index + 1
    }
  }

  return 0
}

function escapeLinkText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]')
}

function isFrontmatterStart(trimmedLine: string): boolean {
  return trimmedLine === '---' || trimmedLine === '+++'
}

function getTocMarkers(markerStyle: TocMarkerStyle): TocMarkers {
  return markerStyle === 'mdx'
    ? { start: mdxTocStartMarker, end: mdxTocEndMarker }
    : { start: tocStartMarker, end: tocEndMarker }
}

function isTocStartMarker(trimmedLine: string): boolean {
  return trimmedLine === tocStartMarker || trimmedLine === mdxTocStartMarker
}

function isTocEndMarker(trimmedLine: string): boolean {
  return trimmedLine === tocEndMarker || trimmedLine === mdxTocEndMarker
}

function isFenceStart(line: string): boolean {
  return /^\s*[`~]{3,}/.test(line)
}

function isFenceClose(line: string, fenceChar: string, fenceLength: number): boolean {
  if ((fenceChar !== '`' && fenceChar !== '~') || fenceLength < 3) {
    return false
  }

  let trimmed = line.trim()

  if (trimmed.length < fenceLength) {
    return false
  }

  return [...trimmed].every((char) => char === fenceChar)
}
