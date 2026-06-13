import { describe, expect, it } from 'vitest'

import {
  getMaxLineLengthIndicatorColorInputValidationMessage,
  resolveMaxLineLengthIndicatorColor,
  tryResolveMaxLineLengthIndicatorColor,
} from './indicatorColor'

describe('max line length indicator color helpers', () => {
  describe('resolveMaxLineLengthIndicatorColor', () => {
    it('resolves common color names', () => {
      expect(resolveMaxLineLengthIndicatorColor('light gray')).toBe('#c0c0c0')
      expect(resolveMaxLineLengthIndicatorColor('blue')).toBe('#007acc')
      expect(resolveMaxLineLengthIndicatorColor('RED')).toBe('#f14c4c')
    })

    it('resolves six-digit hex colors', () => {
      expect(resolveMaxLineLengthIndicatorColor('#88AAFF')).toBe('#88aaff')
    })

    it('expands three-digit hex colors', () => {
      expect(resolveMaxLineLengthIndicatorColor('#8af')).toBe('#88aaff')
    })

    it('falls back to the default color for invalid settings values', () => {
      expect(resolveMaxLineLengthIndicatorColor('not a color')).toBe('#c0c0c0')
      expect(resolveMaxLineLengthIndicatorColor(undefined)).toBe('#c0c0c0')
    })
  })

  describe('tryResolveMaxLineLengthIndicatorColor', () => {
    it('returns undefined for invalid colors', () => {
      expect(tryResolveMaxLineLengthIndicatorColor('not a color')).toBeUndefined()
    })
  })

  describe('getMaxLineLengthIndicatorColorInputValidationMessage', () => {
    it('accepts valid hex colors', () => {
      expect(getMaxLineLengthIndicatorColorInputValidationMessage('#888888')).toBeUndefined()
      expect(getMaxLineLengthIndicatorColorInputValidationMessage('#888')).toBeUndefined()
    })

    it('rejects invalid hex colors', () => {
      expect(getMaxLineLengthIndicatorColorInputValidationMessage('blue')).toBe(
        'Enter a hex color like #888888 or #888.',
      )
      expect(getMaxLineLengthIndicatorColorInputValidationMessage('#88')).toBe(
        'Enter a hex color like #888888 or #888.',
      )
    })
  })
})
