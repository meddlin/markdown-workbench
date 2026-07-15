import * as vscode from 'vscode'

import {
  getChangedLineRange,
  getMinimalTextReplacement,
  lineRangeExceedsMaxLineLength,
  type TextReplacement,
} from './automaticReflow'
import {
  defaultMaxLineLengthIndicatorColor,
  getMaxLineLengthIndicatorColorInputValidationMessage,
  maxLineLengthIndicatorColorChoices,
  resolveMaxLineLengthIndicatorColor,
  tryResolveMaxLineLengthIndicatorColor,
} from './indicatorColor'
import { reflowMarkdownLike, type LineRange, type ReflowOptions } from './reflow'
import {
  getMaxLineLengthInputValidationMessage,
  parseMaxLineLengthInput,
} from './settings'
import { syncMaxLineLengthRulers, type EditorRuler } from './rulers'
import {
  extractMarkdownHeadings,
  insertMarkdownTableOfContents,
  type TocMarkerStyle,
} from './toc'

const automaticReflowDelayMs = 150
const managedMaxLineLengthRulersStateKey = 'markdownWorkbench.managedMaxLineLengthRulers'

type ManagedMaxLineLengthRulers = Record<string, EditorRuler>

export function activate(context: vscode.ExtensionContext) {
  let automaticReflowEditInProgress = false
  let automaticReflowTimer: NodeJS.Timeout | undefined
  let pendingAutomaticReflow:
    | {
        documentUri: string
        lineRange: LineRange
      }
    | undefined

  let reflowDisposable = vscode.commands.registerCommand('markdownWorkbench.reflow', async () => {
    let editor = vscode.window.activeTextEditor

    if (!editor || !isMarkdownWorkbenchEnabled(editor)) {
      return
    }

    let configuration = vscode.workspace.getConfiguration('markdownWorkbench', editor.document)
    let options = getReflowOptions(configuration)

    let selectionOnlyWhenSelected = configuration.get<boolean>(
      'selectionOnlyWhenSelected',
      true,
    )
    let selectionRange = selectionOnlyWhenSelected
      ? getSelectionLineRange(editor.selection)
      : undefined

    let originalText = editor.document.getText()
    let nextText = reflowMarkdownLike(originalText, options, selectionRange)

    if (nextText === originalText) {
      void vscode.window.showInformationMessage(
        'Markdown Workbench found no prose that needed reflowing.',
      )
      return
    }

    await replaceDocumentText(editor, originalText, nextText)
  })

  let setMaxLineLengthDisposable = vscode.commands.registerCommand(
    'markdownWorkbench.setMaxLineLength',
    async () => {
      let editor = vscode.window.activeTextEditor
      let configuration = vscode.workspace.getConfiguration('markdownWorkbench', editor?.document)
      let currentMaxLineLength = configuration.get<number>('maxLineLength', 100)

      let input = await vscode.window.showInputBox({
        title: 'Set Maximum Line Length',
        prompt: 'Enter the maximum Markdown Workbench line length.',
        placeHolder: '100',
        value: String(currentMaxLineLength),
        validateInput: (value) => getMaxLineLengthInputValidationMessage(value),
      })

      let nextMaxLineLength = parseMaxLineLengthInput(input)

      if (nextMaxLineLength === undefined) {
        return
      }

      await configuration.update(
        'maxLineLength',
        nextMaxLineLength,
        vscode.ConfigurationTarget.Global,
      )
      await syncMaxLineLengthIndicators(context)
      void vscode.window.showInformationMessage(
        `Markdown Workbench maximum line length set to ${nextMaxLineLength}.`,
      )
    },
  )

  let toggleMaxLineLengthIndicatorDisposable = vscode.commands.registerCommand(
    'markdownWorkbench.toggleMaxLineLengthIndicator',
    async () => {
      let editor = vscode.window.activeTextEditor
      let configuration = vscode.workspace.getConfiguration('markdownWorkbench', editor?.document)
      let nextShowMaxLineLengthIndicator = !configuration.get<boolean>(
        'showMaxLineLengthIndicator',
        true,
      )

      await configuration.update(
        'showMaxLineLengthIndicator',
        nextShowMaxLineLengthIndicator,
        vscode.ConfigurationTarget.Global,
      )
      await syncMaxLineLengthIndicators(context)

      void vscode.window.showInformationMessage(
        nextShowMaxLineLengthIndicator
          ? 'Markdown Workbench maximum line length indicator shown.'
          : 'Markdown Workbench maximum line length indicator hidden.',
      )
    },
  )

  let setMaxLineLengthIndicatorColorDisposable = vscode.commands.registerCommand(
    'markdownWorkbench.setMaxLineLengthIndicatorColor',
    async () => {
      let editor = vscode.window.activeTextEditor
      let configuration = vscode.workspace.getConfiguration('markdownWorkbench', editor?.document)
      let currentColor = configuration.get<string>(
        'maxLineLengthIndicatorColor',
        defaultMaxLineLengthIndicatorColor,
      )
      let customColorPickLabel = 'Custom...'
      let colorPick = await vscode.window.showQuickPick(
        [
          ...maxLineLengthIndicatorColorChoices.map((choice) => ({
            label: choice.label,
            description: choice.color,
          })),
          {
            label: customColorPickLabel,
            description: 'Enter a hex color',
          },
        ],
        {
          title: 'Set Maximum Line Length Indicator Color',
          placeHolder: 'Choose a color for the Markdown Workbench line length indicator.',
        },
      )

      if (!colorPick) {
        return
      }

      let nextColor = colorPick.label

      if (colorPick.label === customColorPickLabel) {
        let input = await vscode.window.showInputBox({
          title: 'Set Maximum Line Length Indicator Color',
          prompt: 'Enter a hex color for the Markdown Workbench line length indicator.',
          placeHolder: '#888888',
          value: resolveMaxLineLengthIndicatorColor(currentColor),
          validateInput: (value) =>
            getMaxLineLengthIndicatorColorInputValidationMessage(value),
        })

        let customColor = tryResolveMaxLineLengthIndicatorColor(input)

        if (customColor === undefined) {
          return
        }

        nextColor = customColor
      }

      await configuration.update(
        'maxLineLengthIndicatorColor',
        nextColor,
        vscode.ConfigurationTarget.Global,
      )
      await syncMaxLineLengthIndicators(context)

      void vscode.window.showInformationMessage(
        `Markdown Workbench maximum line length indicator color set to ${nextColor}.`,
      )
    },
  )

  let automaticReflowDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    if (automaticReflowEditInProgress) {
      return
    }

    let editor = vscode.window.activeTextEditor

    if (!editor || editor.document.uri.toString() !== event.document.uri.toString()) {
      return
    }

    let configuration = vscode.workspace.getConfiguration('markdownWorkbench', event.document)

    if (
      !configuration.get<boolean>('automaticReflow', true) ||
      !isMarkdownWorkbenchLanguageEnabled(event.document, configuration)
    ) {
      return
    }

    let options = getReflowOptions(configuration)
    let changedLineRange = getChangedLineRange(event.contentChanges)

    if (!changedLineRange) {
      return
    }

    let originalText = event.document.getText()

    if (!lineRangeExceedsMaxLineLength(originalText, changedLineRange, options.maxLineLength)) {
      return
    }

    let documentUri = event.document.uri.toString()
    pendingAutomaticReflow =
      pendingAutomaticReflow && pendingAutomaticReflow.documentUri === documentUri
        ? {
            documentUri,
            lineRange: mergeLineRanges(pendingAutomaticReflow.lineRange, changedLineRange),
          }
        : {
            documentUri,
            lineRange: changedLineRange,
          }

    if (automaticReflowTimer) {
      clearTimeout(automaticReflowTimer)
    }

    automaticReflowTimer = setTimeout(() => {
      void runAutomaticReflow()
    }, automaticReflowDelayMs)
  })

  async function runAutomaticReflow(): Promise<void> {
    let pendingReflow = pendingAutomaticReflow
    pendingAutomaticReflow = undefined
    automaticReflowTimer = undefined

    if (!pendingReflow) {
      return
    }

    let editor = vscode.window.activeTextEditor

    if (!editor || editor.document.uri.toString() !== pendingReflow.documentUri) {
      return
    }

    let configuration = vscode.workspace.getConfiguration('markdownWorkbench', editor.document)

    if (
      !configuration.get<boolean>('automaticReflow', true) ||
      !isMarkdownWorkbenchLanguageEnabled(editor.document, configuration)
    ) {
      return
    }

    let options = getReflowOptions(configuration)
    let originalText = editor.document.getText()

    if (!lineRangeExceedsMaxLineLength(originalText, pendingReflow.lineRange, options.maxLineLength)) {
      return
    }

    let nextText = reflowMarkdownLike(originalText, options, pendingReflow.lineRange)
    let replacement = getMinimalTextReplacement(originalText, nextText)

    if (!replacement) {
      return
    }

    automaticReflowEditInProgress = true
    try {
      await replaceDocumentTextRange(editor, replacement, {
        undoStopBefore: false,
        undoStopAfter: false,
      })
    } finally {
      automaticReflowEditInProgress = false
    }
  }

  let clearAutomaticReflowTimerDisposable = new vscode.Disposable(() => {
    if (automaticReflowTimer) {
      clearTimeout(automaticReflowTimer)
    }
  })

  let maxLineLengthIndicatorConfigurationDisposable =
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('markdownWorkbench.maxLineLength') ||
        event.affectsConfiguration('markdownWorkbench.showMaxLineLengthIndicator') ||
        event.affectsConfiguration('markdownWorkbench.maxLineLengthIndicatorColor') ||
        event.affectsConfiguration('markdownWorkbench.languages') ||
        event.affectsConfiguration('editor.rulers')
      ) {
        void syncMaxLineLengthIndicators(context)
      }
    })

  let tocDisposable = vscode.commands.registerCommand('markdownWorkbench.generateToc', async () => {
    let editor = vscode.window.activeTextEditor

    if (!editor || !isMarkdownWorkbenchEnabled(editor)) {
      return
    }

    let originalText = editor.document.getText()
    let tocMarkerStyle = getTocMarkerStyle(editor.document)
    let nextText = insertMarkdownTableOfContents(originalText, tocMarkerStyle)

    if (nextText === originalText) {
      let headings = extractMarkdownHeadings(originalText.split(/\r?\n/))

      void vscode.window.showInformationMessage(
        headings.length === 0
          ? 'Markdown Workbench found no headings to include in a table of contents.'
          : 'Markdown Workbench table of contents is already up to date.',
      )
      return
    }

    await replaceDocumentText(editor, originalText, nextText)
  })

  context.subscriptions.push(
    reflowDisposable,
    setMaxLineLengthDisposable,
    toggleMaxLineLengthIndicatorDisposable,
    setMaxLineLengthIndicatorColorDisposable,
    automaticReflowDisposable,
    clearAutomaticReflowTimerDisposable,
    maxLineLengthIndicatorConfigurationDisposable,
    tocDisposable,
  )

  void initializeMaxLineLengthIndicators(context)
}

export function deactivate() {
  return undefined
}

function getSelectionLineRange(selection: vscode.Selection): LineRange | undefined {
  if (selection.isEmpty) {
    return undefined
  }

  let startLine = Math.min(selection.start.line, selection.end.line)
  let endLine = Math.max(selection.start.line, selection.end.line)

  if (selection.end.character === 0 && endLine > startLine) {
    endLine -= 1
  }

  return {
    startLine,
    endLine,
  }
}

function isMarkdownWorkbenchEnabled(editor: vscode.TextEditor): boolean {
  let configuration = vscode.workspace.getConfiguration('markdownWorkbench', editor.document)

  if (isMarkdownWorkbenchLanguageEnabled(editor.document, configuration)) {
    return true
  }

  void vscode.window.showInformationMessage(
    `Markdown Workbench is disabled for language "${editor.document.languageId}".`,
  )
  return false
}

function isMarkdownWorkbenchLanguageEnabled(
  document: vscode.TextDocument,
  configuration: vscode.WorkspaceConfiguration,
): boolean {
  let enabledLanguages = getMarkdownWorkbenchLanguages(configuration)
  return enabledLanguages.includes(document.languageId)
}

function getReflowOptions(configuration: vscode.WorkspaceConfiguration): ReflowOptions {
  return {
    maxLineLength: configuration.get<number>('maxLineLength', 100),
    preserveListItems: configuration.get<boolean>('preserveListItems', true),
  }
}

function getMarkdownWorkbenchLanguages(configuration: vscode.WorkspaceConfiguration): string[] {
  return configuration.get<string[]>('languages', ['markdown', 'mdx'])
}

function getTocMarkerStyle(document: vscode.TextDocument): TocMarkerStyle {
  let documentUri = document.uri.toString().split(/[?#]/, 1)[0].toLowerCase()

  return document.languageId === 'mdx' || documentUri.endsWith('.mdx')
    ? 'mdx'
    : 'markdown'
}

async function initializeMaxLineLengthIndicators(
  context: vscode.ExtensionContext,
): Promise<void> {
  await migrateLegacyWorkspaceRulers(context)
  await syncMaxLineLengthIndicators(context)
}

async function syncMaxLineLengthIndicators(
  context: vscode.ExtensionContext,
): Promise<void> {
  let markdownWorkbenchConfiguration = vscode.workspace.getConfiguration('markdownWorkbench')
  let showMaxLineLengthIndicator = markdownWorkbenchConfiguration.get<boolean>(
    'showMaxLineLengthIndicator',
    true,
  )
  let maxLineLength = markdownWorkbenchConfiguration.get<number>('maxLineLength', 100)
  let color = resolveMaxLineLengthIndicatorColor(
    markdownWorkbenchConfiguration.get<string>(
      'maxLineLengthIndicatorColor',
      defaultMaxLineLengthIndicatorColor,
    ),
  )
  let languages = getMarkdownWorkbenchLanguages(markdownWorkbenchConfiguration)
  let activeLanguages = new Set(languages)
  let managedRulers = context.globalState.get<ManagedMaxLineLengthRulers>(
    managedMaxLineLengthRulersStateKey,
    {},
  )
  let nextManagedRulers: ManagedMaxLineLengthRulers = { ...managedRulers }
  let languageIds = [...new Set([...languages, ...Object.keys(managedRulers)])]

  for (let languageId of languageIds) {
    let editorConfiguration = vscode.workspace.getConfiguration('editor', { languageId })
    let currentRulers = getGlobalLanguageRulers(editorConfiguration)
    let result = syncMaxLineLengthRulers(currentRulers, {
      enabled: showMaxLineLengthIndicator && activeLanguages.has(languageId),
      maxLineLength,
      color,
      previousManagedRuler: managedRulers[languageId],
    })

    if (result.changed) {
      await editorConfiguration.update(
        'rulers',
        result.rulers,
        vscode.ConfigurationTarget.Global,
        true,
      )
    }

    if (result.managedRuler === undefined) {
      delete nextManagedRulers[languageId]
    } else {
      nextManagedRulers[languageId] = result.managedRuler
    }
  }

  await context.globalState.update(
    managedMaxLineLengthRulersStateKey,
    Object.keys(nextManagedRulers).length ? nextManagedRulers : undefined,
  )
}

async function migrateLegacyWorkspaceRulers(
  context: vscode.ExtensionContext,
): Promise<void> {
  let legacyManagedRulers = context.workspaceState.get<ManagedMaxLineLengthRulers>(
    managedMaxLineLengthRulersStateKey,
    {},
  )

  for (let [languageId, legacyManagedRuler] of Object.entries(legacyManagedRulers)) {
    let editorConfiguration = vscode.workspace.getConfiguration('editor', { languageId })
    let currentRulers = getLanguageRulers(editorConfiguration, 'workspaceLanguageValue')
    let result = syncMaxLineLengthRulers(currentRulers, {
      enabled: false,
      maxLineLength: typeof legacyManagedRuler === 'number'
        ? legacyManagedRuler
        : legacyManagedRuler.column,
      color: typeof legacyManagedRuler === 'number'
        ? defaultMaxLineLengthIndicatorColor
        : legacyManagedRuler.color ?? defaultMaxLineLengthIndicatorColor,
      previousManagedRuler: legacyManagedRuler,
    })

    if (result.changed) {
      await editorConfiguration.update(
        'rulers',
        result.rulers,
        vscode.ConfigurationTarget.Workspace,
        true,
      )
    }
  }

  if (Object.keys(legacyManagedRulers).length > 0) {
    await context.workspaceState.update(managedMaxLineLengthRulersStateKey, undefined)
  }
}

function getLanguageRulers(
  configuration: vscode.WorkspaceConfiguration,
  key: 'globalLanguageValue' | 'workspaceLanguageValue',
): EditorRuler[] {
  let rulers = configuration.inspect<EditorRuler[]>('rulers')?.[key]
  return Array.isArray(rulers) ? rulers : []
}

function getGlobalLanguageRulers(
  configuration: vscode.WorkspaceConfiguration,
): EditorRuler[] {
  let inspectedRulers = configuration.inspect<EditorRuler[]>('rulers')
  let rulers = inspectedRulers?.globalLanguageValue ?? inspectedRulers?.globalValue
  return Array.isArray(rulers) ? rulers : []
}

function mergeLineRanges(a: LineRange, b: LineRange): LineRange {
  return {
    startLine: Math.min(a.startLine, b.startLine),
    endLine: Math.max(a.endLine, b.endLine),
  }
}

async function replaceDocumentText(
  editor: vscode.TextEditor,
  originalText: string,
  nextText: string,
): Promise<void> {
  if (nextText === originalText) {
    return
  }

  let fullRange = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(originalText.length),
  )

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, nextText)
  })
}

async function replaceDocumentTextRange(
  editor: vscode.TextEditor,
  replacement: TextReplacement,
  options?: {
    undoStopBefore: boolean
    undoStopAfter: boolean
  },
): Promise<void> {
  let range = new vscode.Range(
    editor.document.positionAt(replacement.startOffset),
    editor.document.positionAt(replacement.endOffset),
  )

  await editor.edit((editBuilder) => {
    editBuilder.replace(range, replacement.text)
  }, options)
}
