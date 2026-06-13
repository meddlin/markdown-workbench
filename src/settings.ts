export const minimumMaxLineLength = 20

export function parseMaxLineLengthInput(input: string | undefined): number | undefined {
  if (input === undefined || getMaxLineLengthInputValidationMessage(input)) {
    return undefined
  }

  return Number(input.trim())
}

export function getMaxLineLengthInputValidationMessage(input: string): string | undefined {
  let trimmedInput = input.trim()

  if (trimmedInput.length === 0) {
    return 'Enter a maximum line length.'
  }

  let maxLineLength = Number(trimmedInput)

  if (!Number.isInteger(maxLineLength)) {
    return 'Enter a whole number.'
  }

  if (maxLineLength < minimumMaxLineLength) {
    return `Enter a number greater than or equal to ${minimumMaxLineLength}.`
  }

  return undefined
}
