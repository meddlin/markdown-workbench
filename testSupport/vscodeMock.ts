import { vi } from 'vitest'

type ConfigurationValues = Record<string, unknown>

interface ConfigurationUpdate {
  section: string
  scope: unknown
  key: string
  value: unknown
  target: ConfigurationTarget | undefined
  overrideInLanguage: boolean | undefined
}

interface TextReplacement {
  range: Range
  text: string
}

interface MockTextDocument {
  uri: {
    toString: () => string
  }
  languageId: string
  getText: () => string
  positionAt: (offset: number) => MockPosition
  __setText: (text: string) => void
}

interface MockTextEditor {
  document: MockTextDocument
  selection: MockSelection
  edit: ReturnType<typeof vi.fn>
}

interface MockPosition {
  line: number
  character: number
  offset: number
}

interface MockSelection {
  isEmpty: boolean
  start: {
    line: number
    character: number
  }
  end: {
    line: number
    character: number
  }
}

interface MockTextEditorOptions {
  text: string
  languageId?: string
  selection?: MockSelection
  uri?: string
}

export class Disposable {
  constructor(private readonly disposeCallback: () => void = () => undefined) {}

  dispose(): void {
    this.disposeCallback()
  }
}

export class Range {
  constructor(
    public readonly start: MockPosition,
    public readonly end: MockPosition,
  ) {}
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

let commandCallbacks = new Map<string, (...args: unknown[]) => unknown>()
let textDocumentChangeHandlers: Array<(event: unknown) => void> = []
let configurationChangeHandlers: Array<(event: unknown) => void> = []
let markdownWorkbenchConfiguration: ConfigurationValues = {}
let editorConfigurations = new Map<string, ConfigurationValues>()
let configurationUpdates: ConfigurationUpdate[] = []
let informationMessages: string[] = []
let inputBoxValue: string | undefined
let quickPickLabel: string | undefined

export const commands = {
  registerCommand: vi.fn((command: string, callback: (...args: unknown[]) => unknown) => {
    commandCallbacks.set(command, callback)
    return new Disposable(() => {
      commandCallbacks.delete(command)
    })
  }),
}

export const window = {
  activeTextEditor: undefined as MockTextEditor | undefined,
  showInformationMessage: vi.fn(async (message: string) => {
    informationMessages.push(message)
    return message
  }),
  showInputBox: vi.fn(async () => inputBoxValue),
  showQuickPick: vi.fn(async (items: Array<{ label: string }>) => {
    if (quickPickLabel === undefined) {
      return undefined
    }

    return items.find((item) => item.label === quickPickLabel)
  }),
}

export const workspace = {
  workspaceFolders: [{}] as unknown[] | undefined,
  getConfiguration: vi.fn((section: string, scope?: unknown) => {
    return createConfiguration(section, scope)
  }),
  onDidChangeTextDocument: vi.fn((handler: (event: unknown) => void) => {
    textDocumentChangeHandlers.push(handler)
    return new Disposable(() => {
      textDocumentChangeHandlers = textDocumentChangeHandlers.filter(
        (candidate) => candidate !== handler,
      )
    })
  }),
  onDidChangeConfiguration: vi.fn((handler: (event: unknown) => void) => {
    configurationChangeHandlers.push(handler)
    return new Disposable(() => {
      configurationChangeHandlers = configurationChangeHandlers.filter(
        (candidate) => candidate !== handler,
      )
    })
  }),
}

export function resetVscodeMock(): void {
  commandCallbacks = new Map()
  textDocumentChangeHandlers = []
  configurationChangeHandlers = []
  markdownWorkbenchConfiguration = {}
  editorConfigurations = new Map()
  configurationUpdates = []
  informationMessages = []
  inputBoxValue = undefined
  quickPickLabel = undefined
  window.activeTextEditor = undefined
  workspace.workspaceFolders = [{}]

  commands.registerCommand.mockClear()
  workspace.getConfiguration.mockClear()
  workspace.onDidChangeTextDocument.mockClear()
  workspace.onDidChangeConfiguration.mockClear()
  window.showInformationMessage.mockClear()
  window.showInputBox.mockClear()
  window.showQuickPick.mockClear()
}

export function createExtensionContext(): {
  subscriptions: Disposable[]
  workspaceState: {
    get: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
} {
  let state = new Map<string, unknown>()

  return {
    subscriptions: [],
    workspaceState: {
      get: vi.fn((key: string, defaultValue?: unknown) =>
        state.has(key) ? state.get(key) : defaultValue,
      ),
      update: vi.fn(async (key: string, value: unknown) => {
        if (value === undefined) {
          state.delete(key)
        } else {
          state.set(key, value)
        }
      }),
    },
  }
}

export function createTextEditor(options: MockTextEditorOptions): MockTextEditor {
  let text = options.text
  let document: MockTextDocument = {
    uri: {
      toString: () => options.uri ?? 'file:///workspace/test.md',
    },
    languageId: options.languageId ?? 'markdown',
    getText: () => text,
    positionAt: (offset: number) => getPositionAt(text, offset),
    __setText: (nextText: string) => {
      text = nextText
    },
  }
  let editor: MockTextEditor = {
    document,
    selection: options.selection ?? createSelection(0, 0, 0, 0),
    edit: vi.fn(async (callback: (editBuilder: { replace: (range: Range, value: string) => void }) => void) => {
      let replacements: TextReplacement[] = []

      callback({
        replace: (range, value) => {
          replacements.push({ range, text: value })
        },
      })

      for (let replacement of replacements.sort((a, b) => b.range.start.offset - a.range.start.offset)) {
        text =
          text.slice(0, replacement.range.start.offset) +
          replacement.text +
          text.slice(replacement.range.end.offset)
      }

      return true
    }),
  }

  return editor
}

export function createSelection(
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
): MockSelection {
  return {
    isEmpty: startLine === endLine && startCharacter === endCharacter,
    start: {
      line: startLine,
      character: startCharacter,
    },
    end: {
      line: endLine,
      character: endCharacter,
    },
  }
}

export function setActiveTextEditor(editor: MockTextEditor | undefined): void {
  window.activeTextEditor = editor
}

export function setMarkdownWorkbenchConfiguration(key: string, value: unknown): void {
  markdownWorkbenchConfiguration[key] = value
}

export function setEditorConfiguration(languageId: string, key: string, value: unknown): void {
  getEditorConfigurationValues(languageId)[key] = value
}

export function setWorkspaceFolders(workspaceFolders: unknown[] | undefined): void {
  workspace.workspaceFolders = workspaceFolders
}

export function setInputBoxValue(value: string | undefined): void {
  inputBoxValue = value
}

export function setQuickPickLabel(label: string | undefined): void {
  quickPickLabel = label
}

export function getRegisteredCommandNames(): string[] {
  return [...commandCallbacks.keys()]
}

export async function runCommand(command: string): Promise<unknown> {
  let callback = commandCallbacks.get(command)

  if (!callback) {
    throw new Error(`Command is not registered: ${command}`)
  }

  return callback()
}

export function emitTextDocumentChange(event: unknown): void {
  for (let handler of textDocumentChangeHandlers) {
    handler(event)
  }
}

export function emitConfigurationChange(event: unknown): void {
  for (let handler of configurationChangeHandlers) {
    handler(event)
  }
}

export function getConfigurationUpdates(): ConfigurationUpdate[] {
  return configurationUpdates
}

export function clearConfigurationUpdates(): void {
  configurationUpdates = []
}

export function getInformationMessages(): string[] {
  return informationMessages
}

function createConfiguration(section: string, scope: unknown): {
  get: <T>(key: string, defaultValue?: T) => T
  update: (
    key: string,
    value: unknown,
    target?: ConfigurationTarget,
    overrideInLanguage?: boolean,
  ) => Promise<void>
} {
  let values =
    section === 'editor'
      ? getEditorConfigurationValues(getLanguageId(scope))
      : markdownWorkbenchConfiguration

  return {
    get: <T>(key: string, defaultValue?: T): T => {
      return Object.hasOwn(values, key) ? (values[key] as T) : (defaultValue as T)
    },
    update: async (
      key: string,
      value: unknown,
      target?: ConfigurationTarget,
      overrideInLanguage?: boolean,
    ) => {
      values[key] = value
      configurationUpdates.push({
        section,
        scope,
        key,
        value,
        target,
        overrideInLanguage,
      })
    },
  }
}

function getEditorConfigurationValues(languageId: string): ConfigurationValues {
  let values = editorConfigurations.get(languageId)

  if (!values) {
    values = {}
    editorConfigurations.set(languageId, values)
  }

  return values
}

function getLanguageId(scope: unknown): string {
  if (
    scope &&
    typeof scope === 'object' &&
    'languageId' in scope &&
    typeof scope.languageId === 'string'
  ) {
    return scope.languageId
  }

  return 'default'
}

function getPositionAt(text: string, offset: number): MockPosition {
  let boundedOffset = Math.max(0, Math.min(offset, text.length))
  let prefix = text.slice(0, boundedOffset)
  let lines = prefix.split(/\r?\n/)

  return {
    line: lines.length - 1,
    character: lines[lines.length - 1].length,
    offset: boundedOffset,
  }
}
