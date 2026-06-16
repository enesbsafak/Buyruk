import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { CliIcon } from './CliIcon'
import type { UseAccounts } from '../hooks/useAccounts'
import { isCliKind, type CliKind, type SessionRuntime } from '../types'

interface AccountSwitcherProps {
  activeSession: SessionRuntime | null
  accounts: UseAccounts
  onSwitchAccount: (session: SessionRuntime, accountId: string) => void
  onAddAccount: (type: CliKind) => void
}

// Toolbar control for the active AI session: shows which linked account it runs
// under and lets the user switch accounts or link a new one. Hidden for plain
// shells (cmd/powershell) and when there is no active session.
export function AccountSwitcher({
  activeSession,
  accounts,
  onSwitchAccount,
  onAddAccount
}: AccountSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  if (!activeSession || !isCliKind(activeSession.type)) return null

  const type = activeSession.type
  const list = accounts.accountsByType(type)
  const current = accounts.accountById(activeSession.accountId)

  return (
    <div className="dropdown no-drag account-switcher" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost toolbar-action"
        onClick={() => setOpen((o) => !o)}
        title="Bağlı hesap"
      >
        <CliIcon type={type} size={14} />
        <span className="toolbar-label account-switcher-label">
          {current ? current.label : 'Hesap yok'}
        </span>
        <Icon name="chevron" size={12} />
      </button>
      {open && (
        <div className="dropdown-panel account-panel">
          {list.length === 0 && (
            <div className="account-panel-empty">Bu CLI için bağlı hesap yok.</div>
          )}
          {list.map((a) => (
            <button
              type="button"
              key={a.id}
              className="dropdown-item account-item"
              onClick={() => {
                setOpen(false)
                onSwitchAccount(activeSession, a.id)
              }}
            >
              <span className="account-item-check">
                {a.id === activeSession.accountId ? <Icon name="save" size={13} /> : null}
              </span>
              <span className="dropdown-item-name">{a.label}</span>
            </button>
          ))}
          <div className="account-panel-sep" />
          <button
            type="button"
            className="dropdown-item account-item account-item-add"
            onClick={() => {
              setOpen(false)
              onAddAccount(type)
            }}
          >
            <span className="account-item-check">
              <Icon name="folder-plus" size={13} />
            </span>
            <span className="dropdown-item-name">Yeni hesap bağla</span>
          </button>
        </div>
      )}
    </div>
  )
}
