import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { Icon } from './Icon'
import { configureMonaco } from '../monaco'
import type { SessionRuntime } from '../types'

interface CodeEditorProps {
  session: SessionRuntime | null
  theme: string
  onChangeContent: (path: string, content: string) => void
  onSave: () => void
  onSelectFile: (path: string) => void
  onCloseFile: (path: string) => void
}

const EDITOR_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  fontSize: 13,
  fontFamily: '"Cascadia Code", Consolas, monospace',
  minimap: { enabled: false },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  renderLineHighlight: 'all',
  padding: { top: 10 },
  tabSize: 2
}

// Whole-line backgrounds for a unified git diff opened in the plain editor:
// added (+) lines green, removed (-) lines red, hunk (@@) headers blue. Monaco's
// `diff` token theme only colors text, so we paint full-width lines via
// decorations to make the diff easy to scan.
function buildDiffDecorations(
  monaco: Parameters<OnMount>[1],
  content: string
): MonacoEditor.IModelDeltaDecoration[] {
  const decorations: MonacoEditor.IModelDeltaDecoration[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let className = ''
    if (line.startsWith('+') && !line.startsWith('+++')) className = 'diff-line-add'
    else if (line.startsWith('-') && !line.startsWith('---')) className = 'diff-line-del'
    else if (line.startsWith('@@')) className = 'diff-line-hunk'
    if (!className) continue
    const ln = i + 1
    decorations.push({
      range: new monaco.Range(ln, 1, ln, 1),
      options: { isWholeLine: true, className, marginClassName: className }
    })
  }
  return decorations
}

const Editor = lazy(async () => {
  await configureMonaco()
  const mod = await import('@monaco-editor/react')
  return { default: mod.default }
})

const DiffEditor = lazy(async () => {
  await configureMonaco()
  const mod = await import('@monaco-editor/react')
  return { default: mod.DiffEditor }
})

function EditorFallback() {
  return (
    <div className="placeholder">
      <div className="placeholder-icon">
        <Icon name="file" size={24} />
      </div>
      <div className="placeholder-text">Editör yükleniyor.</div>
    </div>
  )
}

export function CodeEditor({
  session,
  theme,
  onChangeContent,
  onSave,
  onSelectFile,
  onCloseFile
}: CodeEditorProps) {
  const saveRef = useRef(onSave)
  useEffect(() => {
    saveRef.current = onSave
  }, [onSave])

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null)
  const diffDecorationsRef = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null)
  const [diff, setDiff] = useState(false)

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    // A fresh editor instance has no decorations collection yet; drop the stale
    // one so the diff effect re-creates it against this editor.
    diffDecorationsRef.current = null
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current())
  }

  const formatActive = () =>
    editorRef.current?.getAction('editor.action.formatDocument')?.run()

  // Paint git-diff line backgrounds whenever the visible diff file/content changes.
  const diffFile = session?.openFiles.find((f) => f.path === session.activeFilePath) ?? null
  const diffContent =
    diffFile && !diffFile.isBinary && !diffFile.isImage && diffFile.language === 'diff'
      ? diffFile.content
      : null
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    try {
      const decorations = diffContent != null ? buildDiffDecorations(monaco, diffContent) : []
      if (diffDecorationsRef.current) diffDecorationsRef.current.set(decorations)
      else diffDecorationsRef.current = editor.createDecorationsCollection(decorations)
    } catch {
      // The editor can be disposed mid model-swap; decorations re-apply on remount.
    }
  }, [diffContent, diffFile?.path])

  if (!session) {
    return (
      <div className="editor">
        <div className="panel-head">
          <span className="panel-label">Kod Editörü</span>
        </div>
        <div className="placeholder">
          <div className="placeholder-icon">
            <Icon name="file" size={24} />
          </div>
          <div className="placeholder-text">Aktif bir oturum yok.</div>
        </div>
      </div>
    )
  }

  const files = session.openFiles
  const active = files.find((f) => f.path === session.activeFilePath) ?? null
  // A side-by-side git diff tab carries the HEAD side in diffOriginal.
  const sideDiff = !!active && active.diffOriginal !== undefined
  const textFile = !!active && !active.isBinary && !active.isImage && !sideDiff
  const editable =
    !!active && !active.isBinary && !active.isImage && !active.readOnly && !sideDiff
  const showSavedDiff = editable && diff
  const isDirty = editable && active.content !== active.savedContent

  return (
    <div className="editor">
      <div className="editor-chrome">
        <div className="editor-tabs" aria-label="Açık dosyalar">
          {files.map((f) => {
            const dirty = !f.readOnly && !f.isBinary && !f.isImage && f.content !== f.savedContent
            return (
              <div
                key={f.path}
                className={`editor-tab ${f.path === session.activeFilePath ? 'is-active' : ''} ${
                  f.readOnly ? 'is-readonly' : ''
                }`}
                title={f.path}
              >
                <button
                  type="button"
                  className="editor-tab-main"
                  onClick={() => onSelectFile(f.path)}
                  onMouseDown={(e) => {
                    // Prevent the middle-click autoscroll cursor.
                    if (e.button === 1) e.preventDefault()
                  }}
                  onAuxClick={(e) => {
                    // Middle-click (mouse wheel) closes the tab, like a browser.
                    if (e.button === 1) {
                      e.preventDefault()
                      onCloseFile(f.path)
                    }
                  }}
                >
                  <span className="tab-ico">
                    <Icon name={f.isImage ? 'file' : 'file'} size={14} />
                  </span>
                  <span className="editor-tab-name">
                    <span className="editor-tab-title">{f.name}</span>
                    {dirty && <span className="editor-dirty" title="Kaydedilmemiş değişiklik" />}
                  </span>
                </button>
                <button
                  type="button"
                  className="editor-tab-close"
                  title="Kapat"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseFile(f.path)
                  }}
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            )
          })}
        </div>
        {editable && (
          <div className="editor-actions" aria-label="Editör araçları">
            <button
              type="button"
              className={`pane-btn editor-action-btn ${diff ? 'active' : ''}`}
              title="Kayıtlı sürümle karşılaştır"
              aria-pressed={diff}
              onClick={() => setDiff((d) => !d)}
            >
              <Icon name="expand" size={14} />
            </button>
            <button
              type="button"
              className="pane-btn editor-action-btn"
              title="Biçimlendir"
              onClick={formatActive}
            >
              <Icon name="bolt" size={14} />
            </button>
            <button type="button" className="btn btn-small editor-save" onClick={onSave} title="Kaydet (Ctrl+S)">
              <Icon name="save" size={13} />
              <span className="editor-save-label">Kaydet</span>
            </button>
          </div>
        )}
      </div>

      <div className="editor-body">
        {!active && (
          <div className="placeholder">
            <div className="placeholder-icon">
              <Icon name="file" size={24} />
            </div>
            <div className="placeholder-text">
              Dosya seçilmedi. Soldaki dosya yöneticisinden bir dosyaya tıkla (veya Ctrl+P).
            </div>
          </div>
        )}

        {active && active.isImage && (
          <div className="editor-image-wrap">
            <img className="editor-image" src={active.dataUrl} alt={active.name} />
          </div>
        )}

        {active && active.isBinary && (
          <div className="placeholder">
            <div className="placeholder-icon">
              <Icon name="warning" size={24} />
            </div>
            <div className="placeholder-text">Bu dosya metin olarak açılamıyor.</div>
          </div>
        )}

        {sideDiff && (
          <Suspense fallback={<EditorFallback />}>
            <DiffEditor
              key={active!.path}
              height="100%"
              theme={theme}
              original={active!.diffOriginal}
              modified={active!.content}
              language={active!.language}
              options={{ ...EDITOR_OPTIONS, readOnly: true, renderSideBySide: true }}
            />
          </Suspense>
        )}

        {showSavedDiff && (
          <Suspense fallback={<EditorFallback />}>
            <DiffEditor
              key={active!.path}
              height="100%"
              theme={theme}
              original={active!.savedContent}
              modified={active!.content}
              language={active!.language}
              options={{ ...EDITOR_OPTIONS, readOnly: true, renderSideBySide: true }}
            />
          </Suspense>
        )}

        {textFile && !showSavedDiff && (
          <Suspense fallback={<EditorFallback />}>
            <Editor
              height="100%"
              theme={theme}
              path={active!.path}
              language={active!.language}
              value={active!.content}
              onChange={(value) => {
                if (!active!.readOnly) onChangeContent(active!.path, value ?? '')
              }}
              onMount={handleMount}
              options={{ ...EDITOR_OPTIONS, readOnly: !!active!.readOnly }}
            />
          </Suspense>
        )}
      </div>

      {isDirty && diff && (
        <div className="diff-hint">Salt-okunur karşılaştırma · düzenlemek için diff'i kapat</div>
      )}
    </div>
  )
}
