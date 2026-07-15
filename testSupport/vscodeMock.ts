import { vi } from 'vitest'

type ConfigurationValues = Record<string, unknown>

interface EditorConfigurationValues {
  global: ConfigurationValues
  workspace: ConfigurationValues
}

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
  lineCount: number
  getText: () => string
  lineAt: (line: number) => { text: string }
  positionAt: (offset: number) => MockPosition
  __setText: (text: string) => void
}

interface MockTextEditor {
  document: MockTextDocument
  selection: MockSelection
  visibleRanges: Range[]
  edit: ReturnType<typeof vi.fn>
  setDecorations: ReturnType<typeof vi.fn>
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
  public readonly start: MockPosition
  public readonly end: MockPosition

  constructor(start: MockPosition, end: MockPosition)
  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number)
  constructor(
    startOrStartLine: MockPosition | number,
    endOrStartCharacter: MockPosition | number,
    endLine?: number,
    endCharacter?: number,
  ) {
    if (typeof startOrStartLine === 'number') {
      this.start = {
        line: startOrStartLine,
        character: endOrStartCharacter as number,
        offset: 0,
      }
      this.end = {
        line: endLine as number,
        character: endCharacter as number,
        offset: 0,
      }
      return
    }

    this.start = startOrStartLine
    this.end = endOrStartCharacter as MockPosition
  }
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export enum DecorationRangeBehavior {
  OpenOpen = 0,
  ClosedClosed = 1,
  OpenClosed = 2,
  ClosedOpen = 3,
}

let commandCallbacks = new Map<string, (...args: unknown[]) => unknown>()
let textDocumentChangeHandlers: Array<(event: unknown) => void> = []
let configurationChangeHandlers: Array<(event: unknown) => void> = []
let activeTextEditorChangeHandlers: Array<(editor: MockTextEditor | undefined) => void> = []
let visibleRangesChangeHandlers: Array<(event: { textEditor: MockTextEditor }) => void> = []
let markdownWorkbenchConfiguration: ConfigurationValues = {}
let editorConfigurations = new Map<string, EditorConfigurationValues>()
let configurationUpdates: ConfigurationUpdate[] = []
let informationMessages: string[] = []
let inputBoxValue: string | undefined
let quickPickLabel: string | undefined
let createdDecorationTypes: Array<{ dispose: ReturnType<typeof vi.fn>; options: unknown }> = []

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
  visibleTextEditors: [] as MockTextEditor[],
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
  createTextEditorDecorationType: vi.fn((options: unknown) => {
    let decorationType = {
      dispose: vi.fn(),
      options,
    }
    createdDecorationTypes.push(decorationType)
    return decorationType
  }),
  onDidChangeActiveTextEditor: vi.fn((handler: (editor: MockTextEditor | undefined) => void) => {
    activeTextEditorChangeHandlers.push(handler)
    return new Disposable(() => {
      activeTextEditorChangeHandlers = activeTextEditorChangeHandlers.filter(
        (candidate) => candidate !== handler,
      )
    })
  }),
  onDidChangeTextEditorVisibleRanges: vi.fn(
    (handler: (event: { textEditor: MockTextEditor }) => void) => {
      visibleRangesChangeHandlers.push(handler)
      return new Disposable(() => {
        visibleRangesChangeHandlers = visibleRangesChangeHandlers.filter(
          (candidate) => candidate !== handler,
        )
      })
    },
  ),
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
  activeTextEditorChangeHandlers = []
  visibleRangesChangeHandlers = []
  markdownWorkbenchConfiguration = {}
  editorConfigurations = new Map()
  configurationUpdates = []
  informationMessages = []
  inputBoxValue = undefined
  quickPickLabel = undefined
  createdDecorationTypes = []
  window.activeTextEditor = undefined
  window.visibleTextEditors = []
  workspace.workspaceFolders = [{}]

  commands.registerCommand.mockClear()
  workspace.getConfiguration.mockClear()
  workspace.onDidChangeTextDocument.mockClear()
  workspace.onDidChangeConfiguration.mockClear()
  window.showInformationMessage.mockClear()
  window.showInputBox.mockClear()
  window.showQuickPick.mockClear()
  window.createTextEditorDecorationType.mockClear()
  window.onDidChangeActiveTextEditor.mockClear()
  window.onDidChangeTextEditorVisibleRanges.mockClear()
}

export function createExtensionContext(): {
  subscriptions: Disposable[]
  workspaceState: {
    get: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  globalState: {
    get: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
} {
  let workspaceState = createMemento()
  let globalState = createMemento()

  return {
    subscriptions: [],
    workspaceState,
    globalState,
  }
}

export function createTextEditor(options: MockTextEditorOptions): MockTextEditor {
  let text = options.text
  let document: MockTextDocument = {
    uri: {
      toString: () => options.uri ?? 'file:///workspace/test.md',
    },
    languageId: options.languageId ?? 'markdown',
    get lineCount() {
      return getLines(text).length
    },
    getText: () => text,
    lineAt: (line) => ({
      text: getLines(text)[line] ?? '',
    }),
    positionAt: (offset: number) => getPositionAt(text, offset),
    __setText: (nextText: string) => {
      text = nextText
    },
  }
  let editor: MockTextEditor = {
    document,
    selection: options.selection ?? createSelection(0, 0, 0, 0),
    visibleRanges: [new Range(getPositionAt(text, 0), getPositionAt(text, text.length))],
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
    setDecorations: vi.fn(),
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
  window.visibleTextEditors = editor ? [editor] : []

  for (let handler of activeTextEditorChangeHandlers) {
    handler(editor)
  }
}

export function setMarkdownWorkbenchConfiguration(key: string, value: unknown): void {
  markdownWorkbenchConfiguration[key] = value
}

export function setEditorConfiguration(languageId: string, key: string, value: unknown): void {
  getEditorConfigurationValues(languageId).global[key] = value
}

export function setGlobalEditorConfiguration(key: string, value: unknown): void {
  getEditorConfigurationValues('default').global[key] = value
}

export function setWorkspaceEditorConfiguration(
  languageId: string,
  key: string,
  value: unknown,
): void {
  getEditorConfigurationValues(languageId).workspace[key] = value
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

export function emitVisibleRangesChange(editor: MockTextEditor): void {
  for (let handler of visibleRangesChangeHandlers) {
    handler({ textEditor: editor })
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

export function getCreatedDecorationTypes(): Array<{
  dispose: ReturnType<typeof vi.fn>
  options: unknown
}> {
  return createdDecorationTypes
}

function createConfiguration(section: string, scope: unknown): {
  get: <T>(key: string, defaultValue?: T) => T
  inspect: <T>(key: string) => {
    globalValue?: T
    globalLanguageValue?: T
    workspaceLanguageValue?: T
  }
  update: (
    key: string,
    value: unknown,
    target?: ConfigurationTarget,
    overrideInLanguage?: boolean,
  ) => Promise<void>
} {
  let editorValues = getEditorConfigurationValues(getLanguageId(scope))
  let defaultEditorValues = getEditorConfigurationValues('default')
  let values = section === 'editor' ? editorValues.global : markdownWorkbenchConfiguration

  return {
    get: <T>(key: string, defaultValue?: T): T => {
      if (section === 'editor' && Object.hasOwn(editorValues.workspace, key)) {
        return editorValues.workspace[key] as T
      }

      return Object.hasOwn(values, key) ? (values[key] as T) : (defaultValue as T)
    },
    inspect: <T>(key: string) => ({
      globalValue: defaultEditorValues.global[key] as T | undefined,
      globalLanguageValue: editorValues.global[key] as T | undefined,
      workspaceLanguageValue: editorValues.workspace[key] as T | undefined,
    }),
    update: async (
      key: string,
      value: unknown,
      target?: ConfigurationTarget,
      overrideInLanguage?: boolean,
    ) => {
      if (section === 'editor' && target === ConfigurationTarget.Workspace) {
        editorValues.workspace[key] = value
      } else {
        values[key] = value
      }
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

function getEditorConfigurationValues(languageId: string): EditorConfigurationValues {
  let values = editorConfigurations.get(languageId)

  if (!values) {
    values = {
      global: {},
      workspace: {},
    }
    editorConfigurations.set(languageId, values)
  }

  return values
}

function createMemento(): {
  get: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
} {
  let state = new Map<string, unknown>()

  return {
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
  }
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

function getLines(text: string): string[] {
  return text.split(/\r?\n/)
}
