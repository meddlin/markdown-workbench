import { describe, expect, it } from 'vitest'

import { syncMaxLineLengthRulers } from './rulers'

describe('max line length ruler helpers', () => {
  it('adds and owns a ruler when the desired column is free', () => {
    expect(
      syncMaxLineLengthRulers([80], {
        enabled: true,
        maxLineLength: 100,
        color: '#c0c0c0',
        previousManagedRuler: undefined,
      }),
    ).toEqual({
      rulers: [80, { column: 100, color: '#c0c0c0' }],
      managedRuler: { column: 100, color: '#c0c0c0' },
      changed: true,
    })
  })

  it('moves only the previously owned ruler', () => {
    expect(
      syncMaxLineLengthRulers([80, { column: 100, color: '#c0c0c0' }, 120], {
        enabled: true,
        maxLineLength: 88,
        color: '#c0c0c0',
        previousManagedRuler: { column: 100, color: '#c0c0c0' },
      }),
    ).toEqual({
      rulers: [80, 120, { column: 88, color: '#c0c0c0' }],
      managedRuler: { column: 88, color: '#c0c0c0' },
      changed: true,
    })
  })

  it('recolors only the previously owned ruler', () => {
    expect(
      syncMaxLineLengthRulers(
        [{ column: 80, color: '#ff0000' }, { column: 100, color: '#c0c0c0' }],
        {
          enabled: true,
          maxLineLength: 100,
          color: '#007acc',
          previousManagedRuler: { column: 100, color: '#c0c0c0' },
        },
      ),
    ).toEqual({
      rulers: [{ column: 80, color: '#ff0000' }, { column: 100, color: '#007acc' }],
      managedRuler: { column: 100, color: '#007acc' },
      changed: true,
    })
  })

  it('removes only the owned ruler when disabled', () => {
    expect(
      syncMaxLineLengthRulers([80, { column: 100, color: '#c0c0c0' }, 120], {
        enabled: false,
        maxLineLength: 100,
        color: '#c0c0c0',
        previousManagedRuler: { column: 100, color: '#c0c0c0' },
      }),
    ).toEqual({
      rulers: [80, 120],
      managedRuler: undefined,
      changed: true,
    })
  })

  it('respects a pre-existing ruler at the desired column without claiming it', () => {
    expect(
      syncMaxLineLengthRulers([{ column: 100, color: '#ff0000' }], {
        enabled: true,
        maxLineLength: 100,
        color: '#c0c0c0',
        previousManagedRuler: undefined,
      }),
    ).toEqual({
      rulers: [{ column: 100, color: '#ff0000' }],
      managedRuler: undefined,
      changed: false,
    })
  })

  it('leaves unowned rulers intact when disabled', () => {
    expect(
      syncMaxLineLengthRulers([80, 100], {
        enabled: false,
        maxLineLength: 100,
        color: '#c0c0c0',
        previousManagedRuler: undefined,
      }),
    ).toEqual({
      rulers: [80, 100],
      managedRuler: undefined,
      changed: false,
    })
  })
})
