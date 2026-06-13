import * as vscode from 'vscode'

import { reflowMarkdownLike, type LineRange, type ReflowOptions } from './reflow'
import { insertMarkdownTableOfContents } from './toc'

export function activate(context: vscode.ExtensionContext) {
  let reflowDisposable = vscode.commands.registerCommand('markdownReflow.reflow', async () => {
    let editor = vscode.window.activeTextEditor

    if (!editor || !isMarkdownReflowEnabled(editor)) {
      return
    }

    let configuration = vscode.workspace.getConfiguration('markdownReflow', editor.document)
    let options: ReflowOptions = {
      maxLineLength: configuration.get<number>('maxLineLength', 100),
      preserveListItems: configuration.get<boolean>('preserveListItems', true),
    }

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

  let tocDisposable = vscode.commands.registerCommand('markdownReflow.generateToc', async () => {
    let editor = vscode.window.activeTextEditor

    if (!editor || !isMarkdownReflowEnabled(editor)) {
      return
    }

    let originalText = editor.document.getText()
    let nextText = insertMarkdownTableOfContents(originalText)

    await replaceDocumentText(editor, originalText, nextText)
  })

  context.subscriptions.push(reflowDisposable, tocDisposable)
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
  let enabledLanguages = configuration.get<string[]>('languages', ['markdown', 'mdx'])

  if (enabledLanguages.includes(editor.document.languageId)) {
    return true
  }

  void vscode.window.showInformationMessage(
    `Markdown Reflow is disabled for language "${editor.document.languageId}".`,
  )
  return false
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
