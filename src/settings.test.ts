import { describe, expect, it } from 'vitest'

import {
  getMaxLineLengthInputValidationMessage,
  parseMaxLineLengthInput,
} from './settings'

describe('max line length settings helpers', () => {
  describe('parseMaxLineLengthInput', () => {
    it('parses valid whole number input', () => {
      expect(parseMaxLineLengthInput('120')).toBe(120)
    })

    it('trims valid input before parsing', () => {
      expect(parseMaxLineLengthInput('  80  ')).toBe(80)
    })

    it('returns undefined for cancelled input', () => {
      expect(parseMaxLineLengthInput(undefined)).toBeUndefined()
    })

    it('returns undefined for empty input', () => {
      expect(parseMaxLineLengthInput('')).toBeUndefined()
    })

    it('returns undefined for non-number input', () => {
      expect(parseMaxLineLengthInput('wide')).toBeUndefined()
    })

    it('returns undefined for input below the minimum', () => {
      expect(parseMaxLineLengthInput('19')).toBeUndefined()
    })
  })

  describe('getMaxLineLengthInputValidationMessage', () => {
    it('accepts valid whole number input', () => {
      expect(getMaxLineLengthInputValidationMessage('100')).toBeUndefined()
    })

    it('rejects empty input', () => {
      expect(getMaxLineLengthInputValidationMessage('')).toBe('Enter a maximum line length.')
    })

    it('rejects non-number input', () => {
      expect(getMaxLineLengthInputValidationMessage('wide')).toBe('Enter a whole number.')
    })

    it('rejects decimal input', () => {
      expect(getMaxLineLengthInputValidationMessage('80.5')).toBe('Enter a whole number.')
    })

    it('rejects values below the minimum', () => {
      expect(getMaxLineLengthInputValidationMessage('19')).toBe(
        'Enter a number greater than or equal to 20.',
      )
    })
  })
})
