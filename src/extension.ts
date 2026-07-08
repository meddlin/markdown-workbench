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
import {
  extractMarkdownHeadings,
  insertMarkdownTableOfContents,
  type TocMarkerStyle,
} from './toc'

const automaticReflowDelayMs = 150

let maxLineLengthIndicatorDecorationType:
  | vscode.TextEditorDecorationType
  | undefined
let maxLineLengthIndicatorDecorationColor: string | undefined

export function activate(context: vscode.ExtensionContext) {
  maxLineLengthIndicatorDecorationType?.dispose()
  maxLineLengthIndicatorDecorationType = undefined
  maxLineLengthIndicatorDecorationColor = undefined

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
      updateMaxLineLengthIndicators()
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
      updateMaxLineLengthIndicators()

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
      updateMaxLineLengthIndicators()

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
        event.affectsConfiguration('markdownWorkbench.languages')
      ) {
        updateMaxLineLengthIndicators()
      }
    })

  let maxLineLengthIndicatorActiveEditorDisposable =
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateMaxLineLengthIndicators()
    })

  let maxLineLengthIndicatorVisibleRangesDisposable =
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      updateMaxLineLengthIndicatorForEditor(event.textEditor)
    })

  let maxLineLengthIndicatorDocumentChangeDisposable =
    vscode.workspace.onDidChangeTextDocument((event) => {
      let editor = vscode.window.activeTextEditor

      if (editor?.document.uri.toString() === event.document.uri.toString()) {
        updateMaxLineLengthIndicatorForEditor(editor)
      }
    })

  let maxLineLengthIndicatorDecorationDisposable = new vscode.Disposable(() => {
    maxLineLengthIndicatorDecorationType?.dispose()
    maxLineLengthIndicatorDecorationType = undefined
    maxLineLengthIndicatorDecorationColor = undefined
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
    maxLineLengthIndicatorActiveEditorDisposable,
    maxLineLengthIndicatorVisibleRangesDisposable,
    maxLineLengthIndicatorDocumentChangeDisposable,
    maxLineLengthIndicatorDecorationDisposable,
    tocDisposable,
  )

  updateMaxLineLengthIndicators()
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

function updateMaxLineLengthIndicators(): void {
  let editors = vscode.window.visibleTextEditors.length
    ? vscode.window.visibleTextEditors
    : vscode.window.activeTextEditor
      ? [vscode.window.activeTextEditor]
      : []

  for (let editor of editors) {
    updateMaxLineLengthIndicatorForEditor(editor)
  }
}

function updateMaxLineLengthIndicatorForEditor(editor: vscode.TextEditor): void {
  let markdownWorkbenchConfiguration = vscode.workspace.getConfiguration(
    'markdownWorkbench',
    editor.document,
  )
  let showMaxLineLengthIndicator = markdownWorkbenchConfiguration.get<boolean>(
    'showMaxLineLengthIndicator',
    true,
  )
  let decorationType = getMaxLineLengthIndicatorDecorationType(
    resolveMaxLineLengthIndicatorColor(
      markdownWorkbenchConfiguration.get<string>(
        'maxLineLengthIndicatorColor',
        defaultMaxLineLengthIndicatorColor,
      ),
    ),
  )

  if (
    !showMaxLineLengthIndicator ||
    !isMarkdownWorkbenchLanguageEnabled(editor.document, markdownWorkbenchConfiguration)
  ) {
    editor.setDecorations(decorationType, [])
    return
  }

  let maxLineLength = markdownWorkbenchConfiguration.get<number>('maxLineLength', 100)
  editor.setDecorations(
    decorationType,
    getMaxLineLengthIndicatorDecorations(editor, maxLineLength),
  )
}

function getMaxLineLengthIndicatorDecorationType(
  color: string,
): vscode.TextEditorDecorationType {
  if (
    maxLineLengthIndicatorDecorationType &&
    maxLineLengthIndicatorDecorationColor === color
  ) {
    return maxLineLengthIndicatorDecorationType
  }

  maxLineLengthIndicatorDecorationType?.dispose()
  maxLineLengthIndicatorDecorationColor = color
  maxLineLengthIndicatorDecorationType = vscode.window.createTextEditorDecorationType({
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    after: {
      contentText: '|',
      color,
    },
  })

  return maxLineLengthIndicatorDecorationType
}

function getMaxLineLengthIndicatorDecorations(
  editor: vscode.TextEditor,
  maxLineLength: number,
): vscode.DecorationOptions[] {
  let decorations: vscode.DecorationOptions[] = []
  let lineNumbers = getVisibleLineNumbers(editor)

  for (let lineNumber of lineNumbers) {
    let line = editor.document.lineAt(lineNumber)

    if (line.text.length === 0) {
      continue
    }

    let indicatorCharacter = Math.max(0, Math.min(maxLineLength, line.text.length) - 1)
    let trailingColumns = Math.max(0, maxLineLength - line.text.length)
    let decoration: vscode.DecorationOptions = {
      range: new vscode.Range(
        lineNumber,
        indicatorCharacter,
        lineNumber,
        indicatorCharacter + 1,
      ),
    }

    if (trailingColumns > 0) {
      decoration.renderOptions = {
        after: {
          margin: `0 0 0 ${trailingColumns}ch`,
        },
      }
    }

    decorations.push(decoration)
  }

  return decorations
}

function getVisibleLineNumbers(editor: vscode.TextEditor): number[] {
  let lineNumbers = new Set<number>()
  let visibleRanges =
    editor.visibleRanges.length > 0
      ? editor.visibleRanges
      : [
          new vscode.Range(
            0,
            0,
            Math.max(0, editor.document.lineCount - 1),
            0,
          ),
        ]

  for (let range of visibleRanges) {
    let startLine = Math.max(0, range.start.line)
    let endLine = Math.min(editor.document.lineCount - 1, range.end.line)

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      lineNumbers.add(lineNumber)
    }
  }

  return [...lineNumbers]
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
