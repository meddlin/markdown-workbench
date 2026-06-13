import * as vscode from 'vscode'

import {
  getChangedLineRange,
  getMinimalTextReplacement,
  lineRangeExceedsMaxLineLength,
  type TextReplacement,
} from './automaticReflow'
import { reflowMarkdownLike, type LineRange, type ReflowOptions } from './reflow'
import { insertMarkdownTableOfContents } from './toc'

const automaticReflowDelayMs = 150

export function activate(context: vscode.ExtensionContext) {
  let automaticReflowEditInProgress = false
  let automaticReflowTimer: NodeJS.Timeout | undefined
  let pendingAutomaticReflow:
    | {
        documentUri: string
        lineRange: LineRange
      }
    | undefined

  let reflowDisposable = vscode.commands.registerCommand('markdownReflow.reflow', async () => {
    let editor = vscode.window.activeTextEditor

    if (!editor || !isMarkdownReflowEnabled(editor)) {
      return
    }

    let configuration = vscode.workspace.getConfiguration('markdownReflow', editor.document)
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

    await replaceDocumentText(editor, originalText, nextText)
  })

  let automaticReflowDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    if (automaticReflowEditInProgress) {
      return
    }

    let editor = vscode.window.activeTextEditor

    if (!editor || editor.document.uri.toString() !== event.document.uri.toString()) {
      return
    }

    let configuration = vscode.workspace.getConfiguration('markdownReflow', event.document)

    if (
      !configuration.get<boolean>('automaticReflow', true) ||
      !isMarkdownReflowLanguageEnabled(event.document, configuration)
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

    let configuration = vscode.workspace.getConfiguration('markdownReflow', editor.document)

    if (
      !configuration.get<boolean>('automaticReflow', true) ||
      !isMarkdownReflowLanguageEnabled(editor.document, configuration)
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

  let tocDisposable = vscode.commands.registerCommand('markdownReflow.generateToc', async () => {
    let editor = vscode.window.activeTextEditor

    if (!editor || !isMarkdownReflowEnabled(editor)) {
      return
    }

    let originalText = editor.document.getText()
    let nextText = insertMarkdownTableOfContents(originalText)

    await replaceDocumentText(editor, originalText, nextText)
  })

  context.subscriptions.push(
    reflowDisposable,
    automaticReflowDisposable,
    clearAutomaticReflowTimerDisposable,
    tocDisposable,
  )
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

function isMarkdownReflowEnabled(editor: vscode.TextEditor): boolean {
  let configuration = vscode.workspace.getConfiguration('markdownReflow', editor.document)

  if (isMarkdownReflowLanguageEnabled(editor.document, configuration)) {
    return true
  }

  void vscode.window.showInformationMessage(
    `Markdown Reflow is disabled for language "${editor.document.languageId}".`,
  )
  return false
}

function isMarkdownReflowLanguageEnabled(
  document: vscode.TextDocument,
  configuration: vscode.WorkspaceConfiguration,
): boolean {
  let enabledLanguages = configuration.get<string[]>('languages', ['markdown', 'mdx'])
  return enabledLanguages.includes(document.languageId)
}

function getReflowOptions(configuration: vscode.WorkspaceConfiguration): ReflowOptions {
  return {
    maxLineLength: configuration.get<number>('maxLineLength', 100),
    preserveListItems: configuration.get<boolean>('preserveListItems', true),
  }
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
