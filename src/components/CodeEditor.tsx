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
  const [diff, setDiff] = useState(false)

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current())
  }

  const formatActive = () =>
    editorRef.current?.getAction('editor.action.formatDocument')?.run()

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
  const textFile = !!active && !active.isBinary && !active.isImage
  const editable = !!active && !active.isBinary && !active.isImage && !active.readOnly
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
