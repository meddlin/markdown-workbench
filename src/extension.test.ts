import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearConfigurationUpdates,
  ConfigurationTarget,
  createExtensionContext,
  createSelection,
  createTextEditor,
  emitConfigurationChange,
  emitTextDocumentChange,
  emitVisibleRangesChange,
  getConfigurationUpdates,
  getCreatedDecorationTypes,
  getInformationMessages,
  getRegisteredCommandNames,
  resetVscodeMock,
  runCommand,
  setActiveTextEditor,
  setInputBoxValue,
  setMarkdownWorkbenchConfiguration,
  setQuickPickLabel,
} from '../testSupport/vscodeMock'
import { activate } from './extension'

describe('extension activation and commands', () => {
  beforeEach(() => {
    vi.useRealTimers()
    resetVscodeMock()
  })

  it('registers markdown workbench commands during activation', async () => {
    await activateExtension()

    let registeredCommandNames = getRegisteredCommandNames()

    expect(registeredCommandNames).toEqual(
      expect.arrayContaining([
        'markdownWorkbench.reflow',
        'markdownWorkbench.setMaxLineLength',
        'markdownWorkbench.toggleMaxLineLengthIndicator',
        'markdownWorkbench.setMaxLineLengthIndicatorColor',
        'markdownWorkbench.generateToc',
      ]),
    )
    for (let legacyCommand of [
      'markdownReflow.reflow',
      'markdownReflow.setMaxLineLength',
      'markdownReflow.toggleMaxLineLengthIndicator',
      'markdownReflow.setMaxLineLengthIndicatorColor',
      'markdownReflow.generateToc',
    ]) {
      expect(registeredCommandNames).not.toContain(legacyCommand)
    }
    await expect(runCommand('markdownReflow.reflow')).rejects.toThrow(
      'Command is not registered: markdownReflow.reflow',
    )
  })

  it('does not run manual reflow for disabled languages', async () => {
    await activateExtension()
    let editor = createTextEditor({
      languageId: 'plaintext',
      text: 'This line is intentionally long enough that it would wrap if the command were allowed to edit it.\n',
    })
    setActiveTextEditor(editor)

    await runCommand('markdownWorkbench.reflow')

    expect(editor.edit).not.toHaveBeenCalled()
    expect(getInformationMessages()).toContain(
      'Markdown Workbench is disabled for language "plaintext".',
    )
  })

  it('passes the selected line range into manual reflow when selection-only mode is enabled', async () => {
    await activateExtension()
    setMarkdownWorkbenchConfiguration('maxLineLength', 42)
    setMarkdownWorkbenchConfiguration('selectionOnlyWhenSelected', true)
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

    await runCommand('markdownWorkbench.reflow')

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

    await runCommand('markdownWorkbench.generateToc')

    expect(editor.edit).toHaveBeenCalledOnce()
    expect(editor.document.getText()).toContain('<!-- markdown-workbench-toc:start -->')
    expect(editor.document.getText()).toContain('- [Heading](#heading)')
    expect(editor.document.getText()).toContain('<!-- markdown-workbench-toc:end -->')
    expect(editor.document.getText()).not.toContain('{/* markdown-workbench-toc:start */}')
    expect(editor.document.getText()).not.toContain('{/* markdown-workbench-toc:end */}')
  })

  it('generates an mdx-safe table of contents for mdx documents', async () => {
    await activateExtension()
    let editor = createTextEditor({
      languageId: 'mdx',
      text: ['# Heading', '', 'Text', ''].join('\n'),
    })
    setActiveTextEditor(editor)

    await runCommand('markdownWorkbench.generateToc')

    expect(editor.edit).toHaveBeenCalledOnce()
    expect(editor.document.getText()).toContain('{/* markdown-workbench-toc:start */}')
    expect(editor.document.getText()).toContain('- [Heading](#heading)')
    expect(editor.document.getText()).toContain('{/* markdown-workbench-toc:end */}')
    expect(editor.document.getText()).not.toContain('<!-- markdown-workbench-toc:start -->')
    expect(editor.document.getText()).not.toContain('<!-- markdown-workbench-toc:end -->')
  })

  it('generates an mdx-safe table of contents for mdx file uris', async () => {
    await activateExtension()
    let editor = createTextEditor({
      languageId: 'markdown',
      uri: 'file:///workspace/test.mdx',
      text: ['# Heading', '', 'Text', ''].join('\n'),
    })
    setActiveTextEditor(editor)

    await runCommand('markdownWorkbench.generateToc')

    expect(editor.edit).toHaveBeenCalledOnce()
    expect(editor.document.getText()).toContain('{/* markdown-workbench-toc:start */}')
    expect(editor.document.getText()).toContain('{/* markdown-workbench-toc:end */}')
    expect(editor.document.getText()).not.toContain('<!-- markdown-workbench-toc:start -->')
    expect(editor.document.getText()).not.toContain('<!-- markdown-workbench-toc:end -->')
  })

  it('does not edit when the table of contents is already current', async () => {
    await activateExtension()
    let editor = createTextEditor({
      text: [
        '<!-- markdown-workbench-toc:start -->',
        '- [Heading](#heading)',
        '<!-- markdown-workbench-toc:end -->',
        '',
        '# Heading',
        '',
      ].join('\n'),
    })
    setActiveTextEditor(editor)

    await runCommand('markdownWorkbench.generateToc')

    expect(editor.edit).not.toHaveBeenCalled()
    expect(getInformationMessages()).toContain(
      'Markdown Workbench table of contents is already up to date.',
    )
  })

  it('does not write editor rulers during activation', async () => {
    let editor = createTextEditor({
      text: 'This line is intentionally long enough to receive a runtime max line length indicator decoration.\n',
    })
    setActiveTextEditor(editor)
    let context = createExtensionContext()

    activate(context as never)
    await flushPromises()

    expect(getConfigurationUpdates()).not.toContainEqual(
      expect.objectContaining({
        section: 'editor',
        key: 'rulers',
      }),
    )
    expect(editor.setDecorations).toHaveBeenCalled()
  })

  it('updates max line length at the global target when a workspace is open', async () => {
    await activateExtension()
    setInputBoxValue('88')

    await runCommand('markdownWorkbench.setMaxLineLength')

    expect(getConfigurationUpdates()).toContainEqual(
      expect.objectContaining({
        section: 'markdownWorkbench',
        key: 'maxLineLength',
        value: 88,
        target: ConfigurationTarget.Global,
      }),
    )
  })

  it('updates max line length at the global target when no workspace is open', async () => {
    await activateExtension()
    setInputBoxValue('88')

    await runCommand('markdownWorkbench.setMaxLineLength')

    expect(getConfigurationUpdates()).toContainEqual(
      expect.objectContaining({
        section: 'markdownWorkbench',
        key: 'maxLineLength',
        value: 88,
        target: ConfigurationTarget.Global,
      }),
    )
  })

  it('updates indicator visibility and color through settings commands', async () => {
    await activateExtension()
    setQuickPickLabel('blue')

    await runCommand('markdownWorkbench.toggleMaxLineLengthIndicator')
    await runCommand('markdownWorkbench.setMaxLineLengthIndicatorColor')

    expect(getConfigurationUpdates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'markdownWorkbench',
          key: 'showMaxLineLengthIndicator',
          value: false,
          target: ConfigurationTarget.Global,
        }),
        expect.objectContaining({
          section: 'markdownWorkbench',
          key: 'maxLineLengthIndicatorColor',
          value: 'blue',
          target: ConfigurationTarget.Global,
        }),
      ]),
    )
  })

  it('updates runtime max line length indicators when relevant configuration changes', async () => {
    let editor = createTextEditor({
      text: 'This line is intentionally long enough to receive a runtime max line length indicator decoration.\n',
    })
    setActiveTextEditor(editor)
    let context = await activateExtension()
    editor.setDecorations.mockClear()
    clearConfigurationUpdates()
    setMarkdownWorkbenchConfiguration('maxLineLength', 88)

    emitConfigurationChange({
      affectsConfiguration: (key: string) => key === 'markdownWorkbench.maxLineLength',
    })
    await flushPromises()

    expect(context.workspaceState.update).not.toHaveBeenCalled()
    expect(editor.setDecorations).toHaveBeenCalled()
    expect(getConfigurationUpdates()).not.toContainEqual(
      expect.objectContaining({
        section: 'editor',
        key: 'rulers',
      }),
    )
  })

  it('recreates runtime max line length indicators when the color changes', async () => {
    let editor = createTextEditor({
      text: 'This line is intentionally long enough to receive a runtime max line length indicator decoration.\n',
    })
    setActiveTextEditor(editor)
    await activateExtension()
    let createdDecorationCount = getCreatedDecorationTypes().length
    clearConfigurationUpdates()
    setMarkdownWorkbenchConfiguration('maxLineLengthIndicatorColor', 'blue')

    emitConfigurationChange({
      affectsConfiguration: (key: string) =>
        key === 'markdownWorkbench.maxLineLengthIndicatorColor',
    })
    await flushPromises()

    expect(getCreatedDecorationTypes().length).toBeGreaterThan(createdDecorationCount)
    expect(editor.setDecorations).toHaveBeenCalled()
    expect(getConfigurationUpdates()).not.toContainEqual(
      expect.objectContaining({
        section: 'editor',
        key: 'rulers',
      }),
    )
  })

  it('updates runtime max line length indicators when visible ranges change', async () => {
    let editor = createTextEditor({
      text: [
        'This line is intentionally long enough to receive a runtime max line length indicator decoration.',
        'This second line is also intentionally long enough to receive a runtime max line length indicator decoration.',
        '',
      ].join('\n'),
    })
    setActiveTextEditor(editor)
    await activateExtension()
    editor.setDecorations.mockClear()

    emitVisibleRangesChange(editor)

    expect(editor.setDecorations).toHaveBeenCalled()
  })
})

describe('automatic reflow command behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetVscodeMock()
  })

  it('automatically reflows changed lines that exceed the maximum length', async () => {
    await activateExtension()
    setMarkdownWorkbenchConfiguration('maxLineLength', 42)
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
    setMarkdownWorkbenchConfiguration('automaticReflow', false)
    setMarkdownWorkbenchConfiguration('maxLineLength', 42)
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
    setMarkdownWorkbenchConfiguration('maxLineLength', 120)
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
