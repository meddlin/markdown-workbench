import { describe, expect, it } from 'vitest'

import { syncMaxLineLengthRulers } from './rulers'

describe('max line length ruler helpers', () => {
  it('adds a managed ruler to an empty ruler list', () => {
    expect(
      syncMaxLineLengthRulers([], {
        enabled: true,
        maxLineLength: 100,
        color: '#c0c0c0',
        previousManagedRuler: undefined,
      }),
    ).toEqual({
      rulers: [{ column: 100, color: '#c0c0c0' }],
      managedRuler: { column: 100, color: '#c0c0c0' },
      changed: true,
    })
  })

  it('keeps existing rulers and avoids duplicate columns', () => {
    expect(
      syncMaxLineLengthRulers([80, 100], {
        enabled: true,
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

  it('removes only the managed ruler when disabled', () => {
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

  it('replaces the old managed ruler when the max line length changes', () => {
    expect(
      syncMaxLineLengthRulers([80, { column: 100, color: '#c0c0c0' }], {
        enabled: true,
        maxLineLength: 88,
        color: '#c0c0c0',
        previousManagedRuler: { column: 100, color: '#c0c0c0' },
      }),
    ).toEqual({
      rulers: [80, { column: 88, color: '#c0c0c0' }],
      managedRuler: { column: 88, color: '#c0c0c0' },
      changed: true,
    })
  })

  it('leaves user rulers intact when the indicator is disabled', () => {
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

  it('does not claim ownership of an existing object ruler at the max column', () => {
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

  it('replaces an old managed color', () => {
    expect(
      syncMaxLineLengthRulers([{ column: 100, color: '#c0c0c0' }], {
        enabled: true,
        maxLineLength: 100,
        color: '#007acc',
        previousManagedRuler: { column: 100, color: '#c0c0c0' },
      }),
    ).toEqual({
      rulers: [{ column: 100, color: '#007acc' }],
      managedRuler: { column: 100, color: '#007acc' },
      changed: true,
    })
  })

  it('preserves unrelated colored rulers when changing color', () => {
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

  it('migrates an old numeric managed ruler to a colored ruler', () => {
    expect(
      syncMaxLineLengthRulers([80, 100], {
        enabled: true,
        maxLineLength: 100,
        color: '#c0c0c0',
        previousManagedRuler: 100,
      }),
    ).toEqual({
      rulers: [80, { column: 100, color: '#c0c0c0' }],
      managedRuler: { column: 100, color: '#c0c0c0' },
      changed: true,
    })
  })
})
