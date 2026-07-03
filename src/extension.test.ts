import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearConfigurationUpdates,
  ConfigurationTarget,
  createExtensionContext,
  createSelection,
  createTextEditor,
  emitConfigurationChange,
  emitTextDocumentChange,
  getConfigurationUpdates,
  getInformationMessages,
  getRegisteredCommandNames,
  resetVscodeMock,
  runCommand,
  setActiveTextEditor,
  setInputBoxValue,
  setMarkdownReflowConfiguration,
  setQuickPickLabel,
  setWorkspaceFolders,
} from '../testSupport/vscodeMock'
import { activate } from './extension'

describe('extension activation and commands', () => {
  beforeEach(() => {
    vi.useRealTimers()
    resetVscodeMock()
  })

  it('registers markdown reflow commands during activation', async () => {
    await activateExtension()

    expect(getRegisteredCommandNames()).toEqual(
      expect.arrayContaining([
        'markdownReflow.reflow',
        'markdownReflow.setMaxLineLength',
        'markdownReflow.toggleMaxLineLengthIndicator',
        'markdownReflow.setMaxLineLengthIndicatorColor',
        'markdownReflow.generateToc',
      ]),
    )
  })

  it('does not run manual reflow for disabled languages', async () => {
    await activateExtension()
    let editor = createTextEditor({
      languageId: 'plaintext',
      text: 'This line is intentionally long enough that it would wrap if the command were allowed to edit it.\n',
    })
    setActiveTextEditor(editor)

    await runCommand('markdownReflow.reflow')

    expect(editor.edit).not.toHaveBeenCalled()
    expect(getInformationMessages()).toContain(
      'Markdown Reflow is disabled for language "plaintext".',
    )
  })

  it('passes the selected line range into manual reflow when selection-only mode is enabled', async () => {
    await activateExtension()
    setMarkdownReflowConfiguration('maxLineLength', 42)
    setMarkdownReflowConfiguration('selectionOnlyWhenSelected', true)
    let secondParagraph =
      'This second paragraph is also long but should remain untouched because the selection does not reach it.'
    let editor = createTextEditor({
      text: [
        'This is the first paragraph and it should be reflowed because the selection intersects it directly.',
        '',
        secondParagraph,
        '',
      ].join('\n'),
      selection: createSelection(0, 0, 0, 5),
    })
    setActiveTextEditor(editor)

    await runCommand('markdownReflow.reflow')

    expect(editor.edit).toHaveBeenCalledOnce()
    expect(editor.document.getText()).toContain(secondParagraph)
    expect(editor.document.getText().split('\n\n')[0].split('\n').length).toBeGreaterThan(1)
  })

  it('generates a table of contents when the document changes', async () => {
    await activateExtension()
    let editor = createTextEditor({
      text: ['# Heading', '', 'Text', ''].join('\n'),
    })
    setActiveTextEditor(editor)

    await runCommand('markdownReflow.generateToc')

    expect(editor.edit).toHaveBeenCalledOnce()
    expect(editor.document.getText()).toContain('- [Heading](#heading)')
  })

  it('does not edit when the table of contents is already current', async () => {
    await activateExtension()
    let editor = createTextEditor({
      text: [
        '<!-- markdown-reflow-toc:start -->',
        '- [Heading](#heading)',
        '<!-- markdown-reflow-toc:end -->',
        '',
        '# Heading',
        '',
      ].join('\n'),
    })
    setActiveTextEditor(editor)

    await runCommand('markdownReflow.generateToc')

    expect(editor.edit).not.toHaveBeenCalled()
    expect(getInformationMessages()).toContain(
      'Markdown Reflow table of contents is already up to date.',
    )
  })

  it('updates max line length at the workspace target when a workspace is open', async () => {
    await activateExtension()
    setInputBoxValue('88')

    await runCommand('markdownReflow.setMaxLineLength')

    expect(getConfigurationUpdates()).toContainEqual(
      expect.objectContaining({
        section: 'markdownReflow',
        key: 'maxLineLength',
        value: 88,
        target: ConfigurationTarget.Workspace,
      }),
    )
  })

  it('updates max line length at the global target when no workspace is open', async () => {
    setWorkspaceFolders(undefined)
    await activateExtension()
    setInputBoxValue('88')

    await runCommand('markdownReflow.setMaxLineLength')

    expect(getConfigurationUpdates()).toContainEqual(
      expect.objectContaining({
        section: 'markdownReflow',
        key: 'maxLineLength',
        value: 88,
        target: ConfigurationTarget.Global,
      }),
    )
  })

  it('updates indicator visibility and color through settings commands', async () => {
    await activateExtension()
    setQuickPickLabel('blue')

    await runCommand('markdownReflow.toggleMaxLineLengthIndicator')
    await runCommand('markdownReflow.setMaxLineLengthIndicatorColor')

    expect(getConfigurationUpdates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'markdownReflow',
          key: 'showMaxLineLengthIndicator',
          value: false,
          target: ConfigurationTarget.Workspace,
        }),
        expect.objectContaining({
          section: 'markdownReflow',
          key: 'maxLineLengthIndicatorColor',
          value: 'blue',
          target: ConfigurationTarget.Workspace,
        }),
      ]),
    )
  })

  it('syncs rulers when relevant configuration changes', async () => {
    let context = await activateExtension()
    clearConfigurationUpdates()
    setMarkdownReflowConfiguration('maxLineLength', 88)

    emitConfigurationChange({
      affectsConfiguration: (key: string) => key === 'markdownReflow.maxLineLength',
    })
    await flushPromises()

    expect(context.workspaceState.update).toHaveBeenCalled()
    expect(getConfigurationUpdates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'editor',
          key: 'rulers',
          overrideInLanguage: true,
        }),
      ]),
    )
  })
})

describe('automatic reflow command behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetVscodeMock()
  })

  it('automatically reflows changed lines that exceed the maximum length', async () => {
    await activateExtension()
    setMarkdownReflowConfiguration('maxLineLength', 42)
    let editor = createTextEditor({
      text: 'This paragraph is long enough to exceed the configured maximum line length and should wrap.\n',
    })
    setActiveTextEditor(editor)

    emitTextDocumentChange({
      document: editor.document,
      contentChanges: [
        {
          range: {
            start: { line: 0 },
            end: { line: 0 },
          },
          text: 'wrap',
        },
      ],
    })
    await vi.advanceTimersByTimeAsync(150)
    await flushPromises()

    expect(editor.edit).toHaveBeenCalledOnce()
    expect(editor.document.getText().split('\n').filter(Boolean).length).toBeGreaterThan(1)
  })

  it('ignores automatic reflow when the setting is disabled', async () => {
    await activateExtension()
    setMarkdownReflowConfiguration('automaticReflow', false)
    setMarkdownReflowConfiguration('maxLineLength', 42)
    let editor = createTextEditor({
      text: 'This paragraph is long enough to exceed the configured maximum line length but should not wrap.\n',
    })
    setActiveTextEditor(editor)

    emitTextDocumentChange({
      document: editor.document,
      contentChanges: [
        {
          range: {
            start: { line: 0 },
            end: { line: 0 },
          },
          text: 'wrap',
        },
      ],
    })
    await vi.advanceTimersByTimeAsync(150)

    expect(editor.edit).not.toHaveBeenCalled()
  })

  it('ignores automatic reflow when the changed line is within the maximum length', async () => {
    await activateExtension()
    setMarkdownReflowConfiguration('maxLineLength', 120)
    let editor = createTextEditor({
      text: 'Short line.\n',
    })
    setActiveTextEditor(editor)

    emitTextDocumentChange({
      document: editor.document,
      contentChanges: [
        {
          range: {
            start: { line: 0 },
            end: { line: 0 },
          },
          text: 'x',
        },
      ],
    })
    await vi.advanceTimersByTimeAsync(150)

    expect(editor.edit).not.toHaveBeenCalled()
  })
})

async function activateExtension(): Promise<ReturnType<typeof createExtensionContext>> {
  let context = createExtensionContext()
  activate(context as never)
  await flushPromises()
  clearConfigurationUpdates()
  return context
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
