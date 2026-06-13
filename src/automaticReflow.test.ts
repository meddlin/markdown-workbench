import { describe, expect, it } from 'vitest'

import {
  getChangedLineRange,
  getMinimalTextReplacement,
  lineRangeExceedsMaxLineLength,
} from './automaticReflow'

describe('automatic reflow helpers', () => {
  describe('getChangedLineRange', () => {
    it('returns undefined for an empty change set', () => {
      expect(getChangedLineRange([])).toBeUndefined()
    })

    it('uses the inserted text span for a single-line edit', () => {
      expect(
        getChangedLineRange([
          {
            range: {
              start: { line: 3 },
              end: { line: 3 },
            },
            text: 'x',
          },
        ]),
      ).toEqual({
        startLine: 3,
        endLine: 3,
      })
    })

    it('uses the inserted text span for a multi-line paste', () => {
      expect(
        getChangedLineRange([
          {
            range: {
              start: { line: 2 },
              end: { line: 2 },
            },
            text: 'first\nsecond\nthird',
          },
        ]),
      ).toEqual({
        startLine: 2,
        endLine: 4,
      })
    })

    it('merges multiple content changes into one line range', () => {
      expect(
        getChangedLineRange([
          {
            range: {
              start: { line: 6 },
              end: { line: 6 },
            },
            text: 'x',
          },
          {
            range: {
              start: { line: 2 },
              end: { line: 2 },
            },
            text: 'first\nsecond',
          },
        ]),
      ).toEqual({
        startLine: 2,
        endLine: 6,
      })
    })
  })

  describe('lineRangeExceedsMaxLineLength', () => {
    it('returns true when any changed line exceeds the maximum length', () => {
      let text = ['short', 'this line is too long', 'short'].join('\n')

      expect(lineRangeExceedsMaxLineLength(text, { startLine: 1, endLine: 1 }, 10)).toBe(true)
    })

    it('returns false when changed lines are within the maximum length', () => {
      let text = ['this line is too long', 'short'].join('\n')

      expect(lineRangeExceedsMaxLineLength(text, { startLine: 1, endLine: 1 }, 10)).toBe(false)
    })
  })

  describe('getMinimalTextReplacement', () => {
    it('returns undefined when the text is unchanged', () => {
      expect(getMinimalTextReplacement('same', 'same')).toBeUndefined()
    })

    it('returns only the changed span for an insertion', () => {
      expect(getMinimalTextReplacement('hello world', 'hello wide world')).toEqual({
        startOffset: 7,
        endOffset: 7,
        text: 'ide w',
      })
    })

    it('returns only the changed span for a reflow replacement', () => {
      let originalText = 'First paragraph stays.\n\nThis paragraph should wrap here.\n'
      let nextText = 'First paragraph stays.\n\nThis paragraph should\nwrap here.\n'

      expect(getMinimalTextReplacement(originalText, nextText)).toEqual({
        startOffset: 45,
        endOffset: 46,
        text: '\n',
      })
    })
  })
})
