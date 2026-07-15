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
  getInformationMessages,
  getRegisteredCommandNames,
  resetVscodeMock,
  runCommand,
  setActiveTextEditor,
  setEditorConfiguration,
  setGlobalEditorConfiguration,
  setInputBoxValue,
  setMarkdownWorkbenchConfiguration,
  setQuickPickLabel,
  setWorkspaceEditorConfiguration,
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

  it('installs native rulers for configured languages during activation', async () => {
    let editor = createTextEditor({
      text: 'Markdown content.\n',
    })
    setActiveTextEditor(editor)
    let context = createExtensionContext()

    activate(context as never)
    await flushPromises()

    expect(getConfigurationUpdates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'editor',
          scope: { languageId: 'markdown' },
          key: 'rulers',
          value: [{ column: 100, color: '#c0c0c0' }],
          target: ConfigurationTarget.Global,
          overrideInLanguage: true,
        }),
        expect.objectContaining({
          section: 'editor',
          scope: { languageId: 'mdx' },
          key: 'rulers',
          value: [{ column: 100, color: '#c0c0c0' }],
          target: ConfigurationTarget.Global,
          overrideInLanguage: true,
        }),
      ]),
    )
    expect(context.globalState.update).toHaveBeenCalledWith(
      'markdownWorkbench.managedMaxLineLengthRulers',
      {
        markdown: { column: 100, color: '#c0c0c0' },
        mdx: { column: 100, color: '#c0c0c0' },
      },
    )
    expect(editor.setDecorations).not.toHaveBeenCalled()
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

  it('moves owned native rulers when the maximum line length changes', async () => {
    let context = await activateExtension()
    clearConfigurationUpdates()
    setMarkdownWorkbenchConfiguration('maxLineLength', 88)

    emitConfigurationChange({
      affectsConfiguration: (key: string) => key === 'markdownWorkbench.maxLineLength',
    })
    await flushPromises()

    expect(context.workspaceState.update).not.toHaveBeenCalled()
    expect(context.globalState.update).toHaveBeenCalled()
    expect(getConfigurationUpdates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'editor',
          key: 'rulers',
          value: [{ column: 88, color: '#c0c0c0' }],
          target: ConfigurationTarget.Global,
          overrideInLanguage: true,
        }),
      ]),
    )
  })

  it('recolors owned native rulers when the color changes', async () => {
    await activateExtension()
    clearConfigurationUpdates()
    setMarkdownWorkbenchConfiguration('maxLineLengthIndicatorColor', 'blue')

    emitConfigurationChange({
      affectsConfiguration: (key: string) =>
        key === 'markdownWorkbench.maxLineLengthIndicatorColor',
    })
    await flushPromises()

    expect(getConfigurationUpdates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'editor',
          key: 'rulers',
          value: [{ column: 100, color: '#007acc' }],
          target: ConfigurationTarget.Global,
        }),
      ]),
    )
  })

  it('preserves a pre-existing ruler at the desired column without claiming it', async () => {
    setEditorConfiguration('markdown', 'rulers', [80, { column: 100, color: '#ff0000' }])
    let context = await activateExtension()

    expect(getConfigurationUpdates()).not.toContainEqual(
      expect.objectContaining({
        section: 'editor',
        scope: { languageId: 'markdown' },
        key: 'rulers',
      }),
    )
    expect(context.globalState.update).toHaveBeenCalledWith(
      'markdownWorkbench.managedMaxLineLengthRulers',
      { mdx: { column: 100, color: '#c0c0c0' } },
    )
  })

  it('preserves general user rulers when creating language-specific entries', async () => {
    setGlobalEditorConfiguration('rulers', [80])
    let context = createExtensionContext()

    activate(context as never)
    await flushPromises()

    expect(getConfigurationUpdates()).toContainEqual(
      expect.objectContaining({
        section: 'editor',
        scope: { languageId: 'markdown' },
        key: 'rulers',
        value: [80, { column: 100, color: '#c0c0c0' }],
        target: ConfigurationTarget.Global,
      }),
    )
  })

  it('migrates a legacy owned workspace ruler before installing global rulers', async () => {
    let context = createExtensionContext()
    await context.workspaceState.update('markdownWorkbench.managedMaxLineLengthRulers', {
      markdown: { column: 100, color: '#c0c0c0' },
    })
    setWorkspaceEditorConfiguration(
      'markdown',
      'rulers',
      [80, { column: 100, color: '#c0c0c0' }, 120],
    )

    activate(context as never)
    await flushPromises()

    expect(getConfigurationUpdates()).toContainEqual(
      expect.objectContaining({
        section: 'editor',
        scope: { languageId: 'markdown' },
        key: 'rulers',
        value: [80, 120],
        target: ConfigurationTarget.Workspace,
        overrideInLanguage: true,
      }),
    )
    expect(context.workspaceState.update).toHaveBeenLastCalledWith(
      'markdownWorkbench.managedMaxLineLengthRulers',
      undefined,
    )
    expect(getConfigurationUpdates()).toContainEqual(
      expect.objectContaining({
        section: 'editor',
        scope: { languageId: 'markdown' },
        key: 'rulers',
        value: [{ column: 100, color: '#c0c0c0' }],
        target: ConfigurationTarget.Global,
      }),
    )
  })

  it('does not redraw or synchronize the ruler while typing or scrolling', async () => {
    let editor = createTextEditor({
      text: 'Short line.\n',
    })
    setActiveTextEditor(editor)
    await activateExtension()
    clearConfigurationUpdates()

    emitVisibleRangesChange(editor)
    emitTextDocumentChange({
      document: editor.document,
      contentChanges: [{
        range: {
          start: { line: 0 },
          end: { line: 0 },
        },
        text: 'x',
      }],
    })
    await flushPromises()

    expect(editor.setDecorations).not.toHaveBeenCalled()
    expect(getConfigurationUpdates()).not.toContainEqual(
      expect.objectContaining({
        section: 'editor',
        key: 'rulers',
      }),
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
