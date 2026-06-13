import type { LineRange } from './reflow'

export interface PositionLike {
  line: number
}

export interface RangeLike {
  start: PositionLike
  end: PositionLike
}

export interface ContentChangeLike {
  range: RangeLike
  text: string
}

export interface TextReplacement {
  startOffset: number
  endOffset: number
  text: string
}

export function getChangedLineRange(changes: readonly ContentChangeLike[]): LineRange | undefined {
  let changedRange: LineRange | undefined

  for (let change of changes) {
    let endLine = change.range.start.line + getLineSpan(change.text) - 1
    let changeRange = {
      startLine: change.range.start.line,
      endLine,
    }

    changedRange = changedRange
      ? {
          startLine: Math.min(changedRange.startLine, changeRange.startLine),
          endLine: Math.max(changedRange.endLine, changeRange.endLine),
        }
      : changeRange
  }

  return changedRange
}

export function lineRangeExceedsMaxLineLength(
  text: string,
  lineRange: LineRange,
  maxLineLength: number,
): boolean {
  let lines = text.split(/\r?\n/)
  let startLine = Math.max(0, lineRange.startLine)
  let endLine = Math.min(lines.length - 1, lineRange.endLine)

  for (let lineIndex = startLine; lineIndex <= endLine; lineIndex += 1) {
    if (lines[lineIndex].length > maxLineLength) {
      return true
    }
  }

  return false
}

export function getMinimalTextReplacement(
  originalText: string,
  nextText: string,
): TextReplacement | undefined {
  if (nextText === originalText) {
    return undefined
  }

  let startOffset = 0
  while (
    startOffset < originalText.length &&
    startOffset < nextText.length &&
    originalText[startOffset] === nextText[startOffset]
  ) {
    startOffset += 1
  }

  let originalEndOffset = originalText.length
  let nextEndOffset = nextText.length

  while (
    originalEndOffset > startOffset &&
    nextEndOffset > startOffset &&
    originalText[originalEndOffset - 1] === nextText[nextEndOffset - 1]
  ) {
    originalEndOffset -= 1
    nextEndOffset -= 1
  }

  return {
    startOffset,
    endOffset: originalEndOffset,
    text: nextText.slice(startOffset, nextEndOffset),
  }
}

function getLineSpan(text: string): number {
  if (text.length === 0) {
    return 1
  }

  return text.split(/\r\n|\r|\n/).length
}
