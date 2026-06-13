export const defaultMaxLineLengthIndicatorColor = 'light gray'

export interface MaxLineLengthIndicatorColorChoice {
  label: string
  color: string
}

export const maxLineLengthIndicatorColorChoices: MaxLineLengthIndicatorColorChoice[] = [
  { label: 'light gray', color: '#c0c0c0' },
  { label: 'gray', color: '#808080' },
  { label: 'blue', color: '#007acc' },
  { label: 'red', color: '#f14c4c' },
  { label: 'green', color: '#89d185' },
  { label: 'yellow', color: '#cca700' },
  { label: 'orange', color: '#ce9178' },
  { label: 'purple', color: '#c586c0' },
  { label: 'pink', color: '#ff7eb6' },
]

export function resolveMaxLineLengthIndicatorColor(input: string | undefined): string {
  let resolvedColor = tryResolveMaxLineLengthIndicatorColor(input)
  return resolvedColor ?? maxLineLengthIndicatorColorChoices[0].color
}

export function tryResolveMaxLineLengthIndicatorColor(
  input: string | undefined,
): string | undefined {
  let trimmedInput = input?.trim()

  if (!trimmedInput) {
    return undefined
  }

  let colorChoice = maxLineLengthIndicatorColorChoices.find(
    (choice) => choice.label === trimmedInput.toLowerCase(),
  )

  if (colorChoice) {
    return colorChoice.color
  }

  return normalizeHexColor(trimmedInput)
}

export function getMaxLineLengthIndicatorColorInputValidationMessage(
  input: string,
): string | undefined {
  if (normalizeHexColor(input.trim())) {
    return undefined
  }

  return 'Enter a hex color like #888888 or #888.'
}

function normalizeHexColor(input: string): string | undefined {
  let hexColorMatch = input.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)

  if (!hexColorMatch) {
    return undefined
  }

  let hexDigits = hexColorMatch[1].toLowerCase()

  if (hexDigits.length === 3) {
    hexDigits = hexDigits
      .split('')
      .map((digit) => `${digit}${digit}`)
      .join('')
  }

  return `#${hexDigits}`
}
