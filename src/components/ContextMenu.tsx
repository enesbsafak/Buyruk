import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './Icon'

export interface MenuItem {
  label?: string
  icon?: IconName
  onClick?: () => void
  submenu?: MenuItem[]
  danger?: boolean
  separator?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

function itemKey(item: MenuItem): string {
  return item.separator
    ? `separator-${item.label ?? 'line'}`
    : `${item.label ?? 'item'}-${item.icon ?? 'none'}-${item.danger ? 'danger' : 'normal'}`
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [openSub, setOpenSub] = useState<string | null>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  // Keep the menu inside the viewport.
  const left = Math.min(x, window.innerWidth - 240)
  const top = Math.min(y, window.innerHeight - (items.length * 30 + 16))

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) =>
        item.separator ? (
          <div key={itemKey(item)} className="ctx-sep" />
        ) : (
          <div
            key={itemKey(item)}
            className="ctx-item-wrap"
            onMouseEnter={() => setOpenSub(item.submenu ? itemKey(item) : null)}
            onFocus={() => setOpenSub(item.submenu ? itemKey(item) : null)}
          >
            <button
              type="button"
              className={`ctx-item ${item.danger ? 'danger' : ''}`}
              aria-haspopup={item.submenu ? 'menu' : undefined}
              aria-expanded={item.submenu ? openSub === itemKey(item) : undefined}
              onClick={() => {
                if (item.submenu) return
                item.onClick?.()
                onClose()
              }}
            >
              {item.icon && (
                <span className="ctx-ico">
                  <Icon name={item.icon} size={14} />
                </span>
              )}
              <span className="ctx-label">{item.label}</span>
              {item.submenu && (
                <span className="ctx-arrow">
                  <Icon name="chevron" size={12} />
                </span>
              )}
            </button>
            {item.submenu && openSub === itemKey(item) && (
              <div className="ctx-submenu">
                {item.submenu.map((sub) => (
                  <button
                    type="button"
                    key={itemKey(sub)}
                    className="ctx-item"
                    onClick={() => {
                      sub.onClick?.()
                      onClose()
                    }}
                  >
                    {sub.icon && (
                      <span className="ctx-ico">
                        <Icon name={sub.icon} size={14} />
                      </span>
                    )}
                    <span className="ctx-label">{sub.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}
