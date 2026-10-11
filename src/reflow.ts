export interface LineRange {
  startLine: number
  endLine: number
}

export interface ReflowOptions {
  maxLineLength: number
  reflowListItems: boolean
  reflowOrderedListItems: boolean
}

type LineKind = 'blank' | 'protected' | 'wrappable' | 'listItem' | 'listContinuation'

export function reflowMarkdownLike(
  text: string,
  options: ReflowOptions,
  selectionRange?: LineRange,
): string {
  if (text.length === 0) {
    return text
  }

  let eol = text.includes('\r\n') ? '\r\n' : '\n'
  let hasTrailingEol = text.endsWith('\n')
  let lines = text.split(/\r?\n/)

  if (hasTrailingEol) {
    lines.pop()
  }

  let kinds = classifyLines(lines, options)
  let output: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    let kind = kinds[index]

    if (kind !== 'wrappable' && kind !== 'listItem') {
      output.push(lines[index])
      continue
    }

    let startLine = index
    let continuationKind: LineKind = kind === 'listItem' ? 'listContinuation' : 'wrappable'
    index += 1
    while (index < lines.length && kinds[index] === continuationKind) {
      index += 1
    }

    let endLine = index - 1
    let blockLines = lines.slice(startLine, endLine + 1)

    if (selectionRange && !rangesIntersect(selectionRange, { startLine, endLine })) {
      output.push(...blockLines)
      index -= 1
      continue
    }

    output.push(
      ...(kind === 'listItem'
        ? wrapListItem(blockLines, options.maxLineLength)
        : wrapParagraph(blockLines, options.maxLineLength)),
    )
    index -= 1
  }

  let result = output.join(eol)

  if (hasTrailingEol) {
    result += eol
  }

  return result
}

function classifyLines(lines: string[], options: ReflowOptions): LineKind[] {
  let kinds: LineKind[] = Array.from({ length: lines.length }, () => 'wrappable')
  let inFence = false
  let fenceChar = ''
  let fenceLength = 0
  let inFrontmatter = false
  let frontmatterDelimiter = ''
  let inImportExportBlock = false
  let importExportDepth = 0
  let inJsxBlock = false
  let jsxDepth = 0
  let inListBlock = false
  let inListItem = false
  let inTable = false

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index]
    let trimmed = line.trim()

    if (inFence) {
      kinds[index] = 'protected'
      if (isFenceClose(line, fenceChar, fenceLength)) {
        inFence = false
      }
      continue
    }

    if (inFrontmatter) {
      kinds[index] = 'protected'
      if (trimmed === frontmatterDelimiter) {
        inFrontmatter = false
      }
      continue
    }

    if (inImportExportBlock) {
      kinds[index] = 'protected'
      importExportDepth += getBraceDepthDelta(line)

      if (importExportDepth <= 0 && isImportExportBoundary(trimmed, lines[index + 1])) {
        inImportExportBlock = false
        importExportDepth = 0
      }
      continue
    }

    if (inJsxBlock) {
      kinds[index] = 'protected'
      jsxDepth += getJsxDepthDelta(line)

      if (jsxDepth <= 0) {
        inJsxBlock = false
        jsxDepth = 0
      }
      continue
    }

    if (inListBlock) {
      if (trimmed === '') {
        kinds[index] = 'blank'
        inListBlock = false
      } else {
        kinds[index] = 'protected'
      }
      continue
    }

    if (trimmed === '') {
      kinds[index] = 'blank'
      inListItem = false
      inTable = false
      continue
    }

    let continuesListItem = inListItem
    inListItem = false

    if (index === 0 && isFrontmatterStart(trimmed)) {
      kinds[index] = 'protected'
      inFrontmatter = true
      frontmatterDelimiter = trimmed
      continue
    }

    if (isFenceStart(line)) {
      kinds[index] = 'protected'
      let match = line.match(/^\s*([`~]{3,})/)

      if (match) {
        inFence = true
        fenceChar = match[1][0]
        fenceLength = match[1].length
      }

      continue
    }

    if (!inTable && isTableStart(lines, index)) {
      inTable = true
    }

    if (
      (!continuesListItem && isIndentedCode(line)) ||
      isHeading(trimmed) ||
      isBlockquote(trimmed) ||
      inTable ||
      (continuesListItem && isRuleOrSetextLine(trimmed))
    ) {
      kinds[index] = 'protected'
      continue
    }

    if (isListStart(trimmed)) {
      let reflowEnabled = isOrderedListStart(trimmed)
        ? options.reflowOrderedListItems
        : options.reflowListItems

      if (reflowEnabled && isReflowableListItem(line)) {
        kinds[index] = 'listItem'
        inListItem = true
      } else {
        kinds[index] = 'protected'
        inListBlock = true
      }
      continue
    }

    if (continuesListItem && !isJsxLineStart(trimmed)) {
      kinds[index] = 'listContinuation'
      inListItem = true
      continue
    }

    if (isImportExportStart(trimmed)) {
      kinds[index] = 'protected'
      importExportDepth = getBraceDepthDelta(line)

      if (importExportDepth > 0 || !isImportExportBoundary(trimmed, lines[index + 1])) {
        inImportExportBlock = true
      } else {
        importExportDepth = 0
      }
      continue
    }

    if (isJsxLineStart(trimmed)) {
      kinds[index] = 'protected'
      jsxDepth = getJsxDepthDelta(line)

      if (jsxDepth > 0) {
        inJsxBlock = true
      } else {
        jsxDepth = 0
      }
      continue
    }
  }

  return kinds
}

function wrapParagraph(lines: string[], maxLineLength: number): string[] {
  if (lines.length === 0) {
    return []
  }

  let indent = lines[0].match(/^[\t ]*/)?.[0] ?? ''
  let words = lines
    .map((line) => line.trim())
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return [...lines]
  }

  let availableWidth = Math.max(1, maxLineLength - indent.length)
  let wrapped: string[] = []
  let currentLine = ''

  for (let word of words) {
    if (currentLine.length === 0) {
      currentLine = word
      continue
    }

    let candidate = `${currentLine} ${word}`
    if (candidate.length <= availableWidth) {
      currentLine = candidate
      continue
    }

    wrapped.push(`${indent}${currentLine}`)
    currentLine = word
  }

  if (currentLine.length > 0) {
    wrapped.push(`${indent}${currentLine}`)
  }

  return wrapped
}

function wrapListItem(lines: string[], maxLineLength: number): string[] {
  let match = lines[0].match(listItemPattern)

  if (!match) {
    return [...lines]
  }

  let [, indent, marker, spacing, content] = match
  let firstPrefix = `${indent}${marker}${spacing}`
  let hangingIndent = `${indent}${' '.repeat(marker.length + spacing.length)}`
  let words = [content, ...lines.slice(1).map((line) => line.trim())]
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
  let tokens = keepListItemWordsTogether(words)
  let wrapped: string[] = []
  let prefix = firstPrefix
  let currentLine = ''

  for (let token of tokens) {
    if (currentLine.length === 0) {
      currentLine = token
      continue
    }

    let candidate = `${currentLine} ${token}`
    if (prefix.length + candidate.length <= maxLineLength) {
      currentLine = candidate
      continue
    }

    wrapped.push(`${prefix}${currentLine}`)
    prefix = hangingIndent
    currentLine = token
  }

  wrapped.push(`${prefix}${currentLine}`)

  return wrapped
}

// Keeps a task checkbox with its first word, and keeps words that would start a new block
// (such as a bare "-" or "1.") attached to the previous word so wrapping cannot change structure.
function keepListItemWordsTogether(words: string[]): string[] {
  let tokens: string[] = []
  let checkboxPending = false

  for (let [index, word] of words.entries()) {
    if (index === 0 && /^\[[ xX]\]$/.test(word)) {
      tokens.push(word)
      checkboxPending = true
      continue
    }

    let previous = tokens.length - 1
    if (previous >= 0 && (checkboxPending || isBlockStartWord(word))) {
      tokens[previous] = `${tokens[previous]} ${word}`
      checkboxPending = false
      continue
    }

    tokens.push(word)
  }

  return tokens
}

function rangesIntersect(a: LineRange, b: LineRange): boolean {
  return a.startLine <= b.endLine && b.startLine <= a.endLine
}

function isFrontmatterStart(trimmedLine: string): boolean {
  return trimmedLine === '---' || trimmedLine === '+++'
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

function isIndentedCode(line: string): boolean {
  return /^(?: {4}|\t)/.test(line)
}

function isHeading(trimmedLine: string): boolean {
  return /^#{1,6}(?:\s|$)/.test(trimmedLine)
}

function isBlockquote(trimmedLine: string): boolean {
  return /^>/.test(trimmedLine)
}

function isListStart(trimmedLine: string): boolean {
  return /^([*+-]|\d+[.)])\s+/.test(trimmedLine)
}

const listItemPattern = /^([\t ]*)([*+-]|\d{1,9}[.)])( {1,4})(\S.*)$/

function isReflowableListItem(line: string): boolean {
  let match = line.match(listItemPattern)

  if (!match) {
    return false
  }

  let content = match[4]

  return !(
    isRuleOrSetextLine(line.trim()) ||
    isFenceStart(content) ||
    isHeading(content) ||
    isBlockquote(content) ||
    isListStart(content) ||
    isJsxLineStart(content)
  )
}

function isRuleOrSetextLine(trimmedLine: string): boolean {
  return /^(?:([*_-])(?:\s*\1){2,}|=+|-+)$/.test(trimmedLine)
}

function isBlockStartWord(word: string): boolean {
  return /^(?:[*+-]|\d+[.)]|#{1,6}|-{2,}|=+|>.*|[`~]{3,}.*)$/.test(word)
}

function isOrderedListStart(trimmedLine: string): boolean {
  return /^\d+[.)]\s+/.test(trimmedLine)
}

function isImportExportStart(trimmedLine: string): boolean {
  return /^(import|export)\b/.test(trimmedLine)
}

function isImportExportBoundary(trimmedLine: string, nextLine?: string): boolean {
  if (trimmedLine === '') {
    return true
  }

  if (trimmedLine.endsWith(';')) {
    return true
  }

  if (trimmedLine === '}' || trimmedLine.endsWith('}')) {
    return true
  }

  if (trimmedLine.endsWith('/>')) {
    return true
  }

  return nextLine === undefined || nextLine.trim() === ''
}

function isTableStart(lines: string[], index: number): boolean {
  let current = lines[index]?.trim() ?? ''
  let next = lines[index + 1]?.trim() ?? ''

  if (!current.includes('|')) {
    return false
  }

  return isTableDelimiter(current) || isTableDelimiter(next)
}

function isTableDelimiter(line: string): boolean {
  return /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(line)
}

function isJsxLineStart(trimmedLine: string): boolean {
  return /^<\/?[A-Za-z][^>]*>/.test(trimmedLine)
}

function getJsxDepthDelta(line: string): number {
  let matches = line.match(/<\/?[A-Za-z][^>]*?>/g) ?? []
  let depth = 0

  for (let tag of matches) {
    if (/^<\//.test(tag)) {
      depth -= 1
      continue
    }

    if (/\/>$/.test(tag)) {
      continue
    }

    depth += 1
  }

  return depth
}

function getBraceDepthDelta(line: string): number {
  let depth = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let inTemplate = false
  let escaped = false

  for (let index = 0; index < line.length; index += 1) {
    let char = line[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (!inDoubleQuote && !inTemplate && char === '\'') {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (!inSingleQuote && !inTemplate && char === '"') {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '`') {
      inTemplate = !inTemplate
      continue
    }

    if (inSingleQuote || inDoubleQuote || inTemplate) {
      continue
    }

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
    }
  }

  return depth
}
