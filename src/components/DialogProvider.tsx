import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { Icon } from './Icon'

interface PromptOptions {
  title: string
  label?: string
  defaultValue?: string
  placeholder?: string
  confirmText?: string
}

interface ConfirmOptions {
  title: string
  message: string
  danger?: boolean
  confirmText?: string
}

export interface ChooseOption {
  id: string
  label: string
  hint?: string
  selected?: boolean
}

interface ChooseOptions {
  title: string
  message?: string
  options: ChooseOption[]
}

type ToastType = 'info' | 'success' | 'error'

interface DialogApi {
  prompt(options: PromptOptions): Promise<string | null>
  confirm(options: ConfirmOptions): Promise<boolean>
  choose(options: ChooseOptions): Promise<string | null>
  notify(message: string, type?: ToastType): void
}

type DialogState =
  | {
      kind: 'prompt'
      title: string
      label?: string
      placeholder?: string
      confirmText?: string
      value: string
    }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; confirmText?: string }
  | { kind: 'choose'; title: string; message?: string; options: ChooseOption[] }
  | null

interface Toast {
  id: string
  type: ToastType
  message: string
}

const DialogContext = createContext<DialogApi | null>(null)

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used within DialogProvider')
  return ctx
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const resolver = useRef<((value: unknown) => void) | null>(null)
  const stateRef = useRef<DialogState>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const settle = (value: string | boolean | null) => {
    stateRef.current = null
    setState(null)
    resolver.current?.(value)
    resolver.current = null
  }

  const openDialog = (next: DialogState, resolve: (value: unknown) => void) => {
    const previous = stateRef.current
    resolver.current?.(previous?.kind === 'confirm' ? false : null)
    resolver.current = resolve
    stateRef.current = next
    setState(next)
  }

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const api = useRef<DialogApi>({
    prompt: (options) =>
      new Promise<string | null>((resolve) => {
        openDialog({
          kind: 'prompt',
          title: options.title,
          label: options.label,
          placeholder: options.placeholder,
          confirmText: options.confirmText,
          value: options.defaultValue ?? ''
        }, resolve as (value: unknown) => void)
        requestAnimationFrame(() => inputRef.current?.focus())
      }),
    confirm: (options) =>
      new Promise<boolean>((resolve) => {
        openDialog({
          kind: 'confirm',
          title: options.title,
          message: options.message,
          danger: options.danger,
          confirmText: options.confirmText
        }, resolve as (value: unknown) => void)
      }),
    choose: (options) =>
      new Promise<string | null>((resolve) => {
        openDialog({
          kind: 'choose',
          title: options.title,
          message: options.message,
          options: options.options
        }, resolve as (value: unknown) => void)
      }),
    notify: (message, type = 'info') => {
      const id = crypto.randomUUID()
      setToasts((list) => [...list, { id, type, message }])
      window.setTimeout(() => dismiss(id), 4200)
    }
  }).current

  return (
    <DialogContext.Provider value={api}>
      {children}

      {state && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={() => settle(state.kind === 'confirm' ? false : null)}
        >
          <div className="modal modal-small" role="presentation" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{state.title}</h3>

            {state.kind === 'choose' ? (
              <>
                {state.message && <p className="dlg-message">{state.message}</p>}
                <div className="dlg-choices">
                  {state.options.map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      className={`dlg-choice ${opt.selected ? 'is-selected' : ''}`}
                      onClick={() => settle(opt.id)}
                    >
                      <span className="dlg-choice-label">{opt.label}</span>
                      {opt.hint && <span className="dlg-choice-hint">{opt.hint}</span>}
                    </button>
                  ))}
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => settle(null)}>
                    İptal
                  </button>
                </div>
              </>
            ) : state.kind === 'prompt' ? (
              <>
                {state.label && <label className="dlg-label">{state.label}</label>}
                <input
                  aria-label={state.label ?? state.title}
                  ref={inputRef}
                  className="dlg-input"
                  value={state.value}
                  placeholder={state.placeholder}
                  onChange={(e) =>
                    setState((s) =>
                      s && s.kind === 'prompt' ? { ...s, value: e.target.value } : s
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') settle(state.value.trim() || null)
                    if (e.key === 'Escape') settle(null)
                  }}
                />
                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => settle(null)}>
                    İptal
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => settle(state.value.trim() || null)}
                  >
                    {state.confirmText ?? 'Tamam'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="dlg-message">{state.message}</p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
                    İptal
                  </button>
                  <button
                    type="button"
                    className={state.danger ? 'btn btn-danger' : 'btn btn-primary'}
                    onClick={() => settle(true)}
                  >
                    {state.confirmText ?? 'Onayla'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((t) => (
            <button
              type="button"
              key={t.id}
              className={`toast ${t.type}`}
              onClick={() => dismiss(t.id)}
            >
              <span className="toast-ico">
                <Icon name={t.type === 'error' ? 'warning' : t.type === 'success' ? 'save' : 'bolt'} size={15} />
              </span>
              <span className="toast-msg">{t.message}</span>
            </button>
          ))}
        </div>
      )}
    </DialogContext.Provider>
  )
}
