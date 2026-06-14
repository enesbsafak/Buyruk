// Configure Monaco to load locally (bundled by Vite) instead of from a CDN,
// so the app works offline as a desktop app. Also wires up the language workers.
import type { Environment } from 'monaco-editor'

let configurePromise: Promise<void> | null = null

export function configureMonaco(): Promise<void> {
  configurePromise ??= Promise.all([
    import('monaco-editor'),
    import('@monaco-editor/react'),
    import('monaco-editor/esm/vs/editor/editor.worker?worker'),
    import('monaco-editor/esm/vs/language/json/json.worker?worker'),
    import('monaco-editor/esm/vs/language/css/css.worker?worker'),
    import('monaco-editor/esm/vs/language/html/html.worker?worker'),
    import('monaco-editor/esm/vs/language/typescript/ts.worker?worker')
  ]).then(
    ([
      monaco,
      { loader },
      { default: editorWorker },
      { default: jsonWorker },
      { default: cssWorker },
      { default: htmlWorker },
      { default: tsWorker }
    ]) => {
      ;(self as unknown as { MonacoEnvironment: Environment }).MonacoEnvironment = {
        getWorker(_workerId: string, label: string) {
          if (label === 'json') return new jsonWorker()
          if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
          if (label === 'html' || label === 'handlebars' || label === 'razor') {
            return new htmlWorker()
          }
          if (label === 'typescript' || label === 'javascript') return new tsWorker()
          return new editorWorker()
        }
      }

      // Custom editor theme matching the app's Tokyo Night palette.
      monaco.editor.defineTheme('tokyo-night', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: '', foreground: 'c0caf5', background: '15161e' },
          { token: 'comment', foreground: '565f89', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'bb9af7' },
          { token: 'string', foreground: '9ece6a' },
          { token: 'number', foreground: 'ff9e64' },
          { token: 'type', foreground: '2ac3de' },
          { token: 'function', foreground: '7aa2f7' },
          { token: 'variable', foreground: 'c0caf5' },
          { token: 'constant', foreground: 'ff9e64' },
          { token: 'delimiter', foreground: '89ddff' }
        ],
        colors: {
          'editor.background': '#15161e',
          'editor.foreground': '#c0caf5',
          'editorLineNumber.foreground': '#3b4261',
          'editorLineNumber.activeForeground': '#737aa2',
          'editor.selectionBackground': '#28344a',
          'editor.lineHighlightBackground': '#1a1b26',
          'editorCursor.foreground': '#c0caf5',
          'editorIndentGuide.background1': '#1f2233',
          'editorWidget.background': '#1a1b26',
          'editorWidget.border': '#1f2030',
          'editor.findMatchBackground': '#3d59a1',
          'scrollbarSlider.background': '#c0caf520',
          'scrollbarSlider.hoverBackground': '#c0caf540'
        }
      })

      loader.config({ monaco })
    }
  )

  return configurePromise
}
