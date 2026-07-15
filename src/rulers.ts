export type EditorRuler = number | { column: number; color?: string; [key: string]: unknown }

export interface MaxLineLengthRulerSyncOptions {
  enabled: boolean
  maxLineLength: number
  color: string
  previousManagedRuler: EditorRuler | undefined
}

export interface MaxLineLengthRulerSyncResult {
  rulers: EditorRuler[]
  managedRuler: EditorRuler | undefined
  changed: boolean
}

export function syncMaxLineLengthRulers(
  rulers: readonly EditorRuler[] | undefined,
  options: MaxLineLengthRulerSyncOptions,
): MaxLineLengthRulerSyncResult {
  let originalRulers = rulers ?? []
  let nextRulers = [...originalRulers]
  let nextManagedRuler: EditorRuler = {
    column: options.maxLineLength,
    color: options.color,
  }

  if (
    options.previousManagedRuler !== undefined &&
    (!options.enabled || !rulersMatch(options.previousManagedRuler, nextManagedRuler))
  ) {
    nextRulers = removeOneRuler(nextRulers, options.previousManagedRuler)
  }

  if (!options.enabled) {
    return {
      rulers: nextRulers,
      managedRuler: undefined,
      changed: !rulersAreEqual(originalRulers, nextRulers),
    }
  }

  if (hasRulerAtColumn(nextRulers, options.maxLineLength)) {
    let managedRuler =
      options.previousManagedRuler !== undefined &&
      rulersMatch(options.previousManagedRuler, nextManagedRuler) &&
      hasRuler(nextRulers, nextManagedRuler)
        ? nextManagedRuler
        : undefined

    return {
      rulers: nextRulers,
      managedRuler,
      changed: !rulersAreEqual(originalRulers, nextRulers),
    }
  }

  nextRulers.push(nextManagedRuler)

  return {
    rulers: nextRulers,
    managedRuler: nextManagedRuler,
    changed: true,
  }
}

function removeOneRuler(rulers: readonly EditorRuler[], rulerToRemove: EditorRuler): EditorRuler[] {
  let removed = false

  return rulers.filter((ruler) => {
    if (!removed && rulersMatch(ruler, rulerToRemove)) {
      removed = true
      return false
    }

    return true
  })
}

function hasRuler(rulers: readonly EditorRuler[], rulerToFind: EditorRuler): boolean {
  return rulers.some((ruler) => rulersMatch(ruler, rulerToFind))
}

function hasRulerAtColumn(rulers: readonly EditorRuler[], column: number): boolean {
  return rulers.some((ruler) => getRulerColumn(ruler) === column)
}

function getRulerColumn(ruler: EditorRuler): number | undefined {
  return typeof ruler === 'number' ? ruler : ruler.column
}

function rulersMatch(a: EditorRuler, b: EditorRuler): boolean {
  if (typeof a === 'number' || typeof b === 'number') {
    return a === b
  }

  return a.column === b.column && a.color === b.color
}

function rulersAreEqual(a: readonly EditorRuler[], b: readonly EditorRuler[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((ruler, index) => rulersMatch(ruler, b[index]))
}
