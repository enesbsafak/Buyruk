import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFileTree, type TreeRow } from '../hooks/useFileTree'
import { basename, dirname, joinPath } from '../utils/pathUtils'
import { fileIcon } from '../utils/fileIcon'
import { useDialog } from './DialogProvider'
import { Icon } from './Icon'
import { ContextMenu, type MenuItem } from './ContextMenu'
import type { FileNode, TerminalType } from '../types'

const ROW_HEIGHT = 24
// Below this many rows the whole tree is cheap to render; above it we only mount
// the slice inside the viewport (plus a small overscan).
const VIRTUALIZE_ABOVE = 200
const OVERSCAN = 12

const TERMINAL_LABELS: { type: TerminalType; label: string }[] = [
  { type: 'cmd', label: 'CMD' },
  { type: 'powershell', label: 'PowerShell' },
  { type: 'claude', label: 'Claude' },
  { type: 'codex', label: 'Codex' },
  { type: 'opencode', label: 'OpenCode' },
  { type: 'antigravity', label: 'Antigravity' }
]

interface Clipboard {
  paths: string[]
  mode: 'copy' | 'cut'
}

function gitBadge(code: string | undefined): { label: string; cls: string } | null {
  if (!code) return null
  if (code === '??') return { label: 'U', cls: 'git-new' }
  if (code.includes('D')) return { label: 'D', cls: 'git-del' }
  if (code.includes('A')) return { label: 'A', cls: 'git-new' }
  if (code.includes('R')) return { label: 'R', cls: 'git-mod' }
  return { label: 'M', cls: 'git-mod' }
}

// A folder is marked when any tracked change lives underneath it, so you can see
// where the work is without expanding every level.
function folderHasChanges(gitFiles: Record<string, string>, folderPath: string): boolean {
  const prefix = `${folderPath.toLowerCase()}\\`
  for (const path of Object.keys(gitFiles)) {
    if (path.startsWith(prefix)) return true
  }
  return false
}

interface FileExplorerProps {
  rootPath: string | null
  hiddenFolders: string[]
  gitFiles: Record<string, string>
  onOpenFile: (path: string) => void
  onOpenGitDiff: (path: string) => void
  onOpenTerminalHere: (cwd: string, type: TerminalType) => void
  refreshNonce: number
  onRefresh: () => void
}

export function FileExplorer(props: FileExplorerProps) {
  if (!props.rootPath) {
    return (
      <div className="explorer">
        <div className="panel-head">
          <span className="panel-label">Dosya Yöneticisi</span>
        </div>
        <div className="placeholder">
          <div className="placeholder-icon">
            <Icon name="folder" size={24} />
          </div>
          <div className="placeholder-text">Aktif bir terminal oturumu yok.</div>
        </div>
      </div>
    )
  }

  return <FileExplorerContent key={props.rootPath} {...props} rootPath={props.rootPath} />
}

function FileExplorerContent({
  rootPath,
  hiddenFolders,
  gitFiles,
  onOpenFile,
  onOpenGitDiff,
  onOpenTerminalHere,
  refreshNonce,
  onRefresh
}: FileExplorerProps & { rootPath: string }) {
  const dialog = useDialog()
  const [selected, setSelected] = useState<string[]>([])
  const [anchor, setAnchor] = useState<string | null>(null)
  const [focusPath, setFocusPath] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null)
  const [filter, setFilter] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [dragPaths, setDragPaths] = useState<string[]>([])
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const { rows, expanded, toggle, expand, collapse, collapseAll, rootError, rootLoading } =
    useFileTree({ rootPath, hiddenFolders, showHidden, filter, refreshNonce })

  const rowByPath = useMemo(() => new Map(rows.map((row) => [row.node.path, row])), [rows])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const cutSet = useMemo(
    () => new Set(clipboard?.mode === 'cut' ? clipboard.paths : []),
    [clipboard]
  )

  const focusRow = focusPath ? rowByPath.get(focusPath) : undefined
  const lastSelected = selected.length ? selected[selected.length - 1] : null
  const lastNode = lastSelected ? rowByPath.get(lastSelected)?.node : undefined
  const targetDirFor = useCallback(
    (node: FileNode | undefined): string =>
      node ? (node.isDirectory ? node.path : dirname(node.path)) : rootPath,
    [rootPath]
  )
  const targetDir = targetDirFor(lastNode)

  const fail = useCallback(
    (action: string, err: unknown) =>
      dialog.notify(`${action}: ${err instanceof Error ? err.message : String(err)}`, 'error'),
    [dialog]
  )

  // ---- selection -------------------------------------------------------

  const selectOnly = useCallback((path: string) => {
    setSelected([path])
    setAnchor(path)
    setFocusPath(path)
  }, [])

  const selectRange = useCallback(
    (path: string) => {
      const from = rows.findIndex((row) => row.node.path === (anchor ?? path))
      const to = rows.findIndex((row) => row.node.path === path)
      if (from === -1 || to === -1) return selectOnly(path)
      const [start, end] = from <= to ? [from, to] : [to, from]
      setSelected(rows.slice(start, end + 1).map((row) => row.node.path))
      setFocusPath(path)
    },
    [anchor, rows, selectOnly]
  )

  const toggleSelect = useCallback((path: string) => {
    setSelected((prev) =>
      prev.includes(path) ? prev.filter((item) => item !== path) : [...prev, path]
    )
    setAnchor(path)
    setFocusPath(path)
  }, [])

  // Drop selections whose rows disappeared (filtered out, deleted, collapsed).
  useEffect(() => {
    setSelected((prev) => {
      const next = prev.filter((path) => rowByPath.has(path))
      return next.length === prev.length ? prev : next
    })
  }, [rowByPath])

  // ---- file operations -------------------------------------------------

  const handleNewFile = useCallback(async () => {
    const name = await dialog.prompt({
      title: 'Yeni Dosya',
      label: `Konum · ${targetDir}`,
      placeholder: 'index.ts',
      confirmText: 'Oluştur'
    })
    if (!name) return
    try {
      const path = joinPath(targetDir, name)
      await window.api.createFile(path)
      if (targetDir !== rootPath) expand(targetDir)
      selectOnly(path)
      onRefresh()
      onOpenFile(path)
    } catch (err) {
      fail('Dosya oluşturulamadı', err)
    }
  }, [dialog, expand, fail, onOpenFile, onRefresh, rootPath, selectOnly, targetDir])

  const handleNewFolder = useCallback(async () => {
    const name = await dialog.prompt({
      title: 'Yeni Klasör',
      label: `Konum · ${targetDir}`,
      placeholder: 'src',
      confirmText: 'Oluştur'
    })
    if (!name) return
    try {
      const path = joinPath(targetDir, name)
      await window.api.createFolder(path)
      if (targetDir !== rootPath) expand(targetDir)
      selectOnly(path)
      onRefresh()
    } catch (err) {
      fail('Klasör oluşturulamadı', err)
    }
  }, [dialog, expand, fail, onRefresh, rootPath, selectOnly, targetDir])

  const handleRename = useCallback(
    async (path?: string) => {
      const target = path ?? lastSelected
      if (!target) return
      const currentName = basename(target)
      const name = await dialog.prompt({
        title: 'Yeniden Adlandır',
        label: currentName,
        defaultValue: currentName,
        confirmText: 'Değiştir'
      })
      if (!name || name === currentName) return
      try {
        const next = joinPath(dirname(target), name)
        await window.api.renamePath(target, next)
        selectOnly(next)
        onRefresh()
      } catch (err) {
        fail('Yeniden adlandırılamadı', err)
      }
    },
    [dialog, fail, lastSelected, onRefresh, selectOnly]
  )

  const handleDelete = useCallback(
    async (paths?: string[]) => {
      const targets = paths ?? selected
      if (targets.length === 0) return
      const label =
        targets.length === 1 ? `"${basename(targets[0])}"` : `${targets.length} öğe`
      const ok = await dialog.confirm({
        title: 'Sil',
        message: `${label} geri dönüşüm kutusuna taşınsın mı?`,
        danger: true,
        confirmText: 'Sil'
      })
      if (!ok) return
      const failures: string[] = []
      for (const path of targets) {
        try {
          await window.api.trashPath(path)
        } catch {
          failures.push(basename(path))
        }
      }
      setSelected([])
      onRefresh()
      if (failures.length) {
        dialog.notify(`Silinemedi: ${failures.join(', ')}`, 'error')
      }
    },
    [dialog, onRefresh, selected]
  )

  const handlePaste = useCallback(
    async (destination?: string) => {
      if (!clipboard || clipboard.paths.length === 0) return
      const dir = destination ?? targetDir
      const created: string[] = []
      const failures: string[] = []
      for (const source of clipboard.paths) {
        try {
          const path =
            clipboard.mode === 'copy'
              ? await window.api.copyPath(source, dir)
              : await window.api.movePath(source, dir)
          created.push(path)
        } catch {
          failures.push(basename(source))
        }
      }
      if (clipboard.mode === 'cut') setClipboard(null)
      if (created.length) {
        if (dir !== rootPath) expand(dir)
        setSelected(created)
        setFocusPath(created[created.length - 1])
      }
      onRefresh()
      if (failures.length) dialog.notify(`Yapıştırılamadı: ${failures.join(', ')}`, 'error')
    },
    [clipboard, dialog, expand, onRefresh, rootPath, targetDir]
  )

  const handleDuplicate = useCallback(
    async (path: string) => {
      try {
        const created = await window.api.copyPath(path, dirname(path))
        selectOnly(created)
        onRefresh()
      } catch (err) {
        fail('Çoğaltılamadı', err)
      }
    },
    [fail, onRefresh, selectOnly]
  )

  const handleDropOn = useCallback(
    async (folder: string, sources: string[]) => {
      const failures: string[] = []
      for (const source of sources) {
        if (source === folder || dirname(source) === folder) continue
        try {
          await window.api.movePath(source, folder)
        } catch {
          failures.push(basename(source))
        }
      }
      expand(folder)
      onRefresh()
      if (failures.length) dialog.notify(`Taşınamadı: ${failures.join(', ')}`, 'error')
    },
    [dialog, expand, onRefresh]
  )

  // Files dragged in from Explorer/desktop are copied into the drop folder.
  const handleExternalDrop = useCallback(
    async (folder: string, files: FileList) => {
      const list = Array.from(files)
      if (list.length === 0) return
      try {
        const imported = await window.api.importDroppedFiles(list, folder)
        if (imported.length) {
          expand(folder)
          setSelected(imported)
          setFocusPath(imported[imported.length - 1])
          dialog.notify(
            imported.length === 1
              ? `Eklendi: ${basename(imported[0])}`
              : `${imported.length} öğe eklendi`,
            'success'
          )
        }
        onRefresh()
      } catch (err) {
        fail('Dosya eklenemedi', err)
      }
    },
    [dialog, expand, fail, onRefresh]
  )

  // A drag carrying real files comes from outside; internal drags carry none.
  const isExternalDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files')

  // ---- keyboard --------------------------------------------------------

  // Scrolls by index rather than by element: with windowing on, the target row
  // may not be mounted yet, so there is nothing to scrollIntoView.
  const revealIndex = useCallback((index: number) => {
    const list = listRef.current
    if (!list) return
    const top = index * ROW_HEIGHT
    const bottom = top + ROW_HEIGHT
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight
    }
  }, [])

  const moveFocus = useCallback(
    (delta: number, extend: boolean) => {
      if (rows.length === 0) return
      const current = focusPath ? rows.findIndex((row) => row.node.path === focusPath) : -1
      const nextIndex = Math.max(0, Math.min(rows.length - 1, current + delta))
      const next = rows[nextIndex]
      if (!next) return
      if (extend) selectRange(next.node.path)
      else selectOnly(next.node.path)
      revealIndex(nextIndex)
    },
    [focusPath, revealIndex, rows, selectOnly, selectRange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const row = focusRow
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'c' && selected.length) {
        e.preventDefault()
        setClipboard({ paths: selected, mode: 'copy' })
        return
      }
      if (mod && e.key.toLowerCase() === 'x' && selected.length) {
        e.preventDefault()
        setClipboard({ paths: selected, mode: 'cut' })
        return
      }
      if (mod && e.key.toLowerCase() === 'v' && clipboard) {
        e.preventDefault()
        void handlePaste()
        return
      }
      if (mod && e.key.toLowerCase() === 'd' && row && !row.node.isDirectory) {
        e.preventDefault()
        void handleDuplicate(row.node.path)
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelected(rows.map((item) => item.node.path))
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          moveFocus(1, e.shiftKey)
          break
        case 'ArrowUp':
          e.preventDefault()
          moveFocus(-1, e.shiftKey)
          break
        case 'Home':
          e.preventDefault()
          moveFocus(-rows.length, e.shiftKey)
          break
        case 'End':
          e.preventDefault()
          moveFocus(rows.length, e.shiftKey)
          break
        case 'ArrowRight':
          if (!row) break
          e.preventDefault()
          if (row.node.isDirectory && !row.expanded) expand(row.node.path)
          else if (row.node.isDirectory) moveFocus(1, false)
          break
        case 'ArrowLeft': {
          if (!row) break
          e.preventDefault()
          if (row.node.isDirectory && row.expanded) {
            collapse(row.node.path)
            break
          }
          const parent = dirname(row.node.path)
          if (rowByPath.has(parent)) selectOnly(parent)
          break
        }
        case 'Enter':
          if (!row) break
          e.preventDefault()
          if (row.node.isDirectory) toggle(row.node.path)
          else onOpenFile(row.node.path)
          break
        case 'F2':
          if (!row) break
          e.preventDefault()
          void handleRename(row.node.path)
          break
        case 'Delete':
          if (selected.length === 0) break
          e.preventDefault()
          void handleDelete()
          break
        case 'Escape':
          if (filter) {
            e.preventDefault()
            setFilter('')
          }
          break
        default:
          break
      }
    },
    [
      clipboard,
      collapse,
      expand,
      filter,
      focusRow,
      handleDelete,
      handleDuplicate,
      handlePaste,
      handleRename,
      moveFocus,
      onOpenFile,
      rowByPath,
      rows,
      selectOnly,
      selected,
      toggle
    ]
  )

  // ---- windowing -------------------------------------------------------

  useEffect(() => {
    const element = listRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight))
    observer.observe(element)
    setViewportHeight(element.clientHeight)
    return () => observer.disconnect()
  }, [])

  const virtualize = rows.length > VIRTUALIZE_ABOVE && viewportHeight > 0
  const firstIndex = virtualize
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    : 0
  const lastIndex = virtualize
    ? Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
    : rows.length
  const visibleRows = virtualize ? rows.slice(firstIndex, lastIndex) : rows

  // ---- context menu ----------------------------------------------------

  const menuItems = useCallback(
    (node: FileNode): MenuItem[] => {
      const dir = targetDirFor(node)
      const multi = selectedSet.has(node.path) && selected.length > 1
      const targets = multi ? selected : [node.path]
      const items: MenuItem[] = []

      if (!node.isDirectory) {
        items.push({
          label: 'Düzenleyicide aç',
          icon: 'file',
          onClick: () => onOpenFile(node.path)
        })
        if (gitFiles[node.path.toLowerCase()]) {
          items.push({
            label: 'Git diff göster',
            icon: 'git-diff',
            onClick: () => onOpenGitDiff(node.path)
          })
        }
      }

      items.push({
        label: 'Burada terminal aç',
        icon: 'terminal',
        submenu: TERMINAL_LABELS.map(({ type, label }) => ({
          label,
          icon: 'terminal',
          onClick: () => onOpenTerminalHere(dir, type)
        }))
      })
      items.push({ separator: true })
      items.push({
        label: multi ? `${targets.length} öğeyi kopyala` : 'Kopyala',
        icon: 'copy',
        onClick: () => setClipboard({ paths: targets, mode: 'copy' })
      })
      items.push({
        label: multi ? `${targets.length} öğeyi kes` : 'Kes',
        icon: 'scissors',
        onClick: () => setClipboard({ paths: targets, mode: 'cut' })
      })
      items.push({
        label: 'Yapıştır',
        icon: 'clipboard',
        disabled: !clipboard,
        onClick: () => void handlePaste(dir)
      })
      if (!multi) {
        items.push({
          label: 'Çoğalt',
          icon: 'copy',
          onClick: () => void handleDuplicate(node.path)
        })
      }
      items.push({ separator: true })
      items.push({ label: 'Yeni dosya', icon: 'file-plus', onClick: handleNewFile })
      items.push({ label: 'Yeni klasör', icon: 'folder-plus', onClick: handleNewFolder })
      if (!multi) {
        items.push({
          label: 'Yeniden adlandır',
          icon: 'edit',
          onClick: () => void handleRename(node.path)
        })
      }
      items.push({ separator: true })
      items.push({
        label: "Explorer'da göster",
        icon: 'folder-open',
        onClick: () => window.api.revealPath(node.path)
      })
      items.push({
        label: 'Yolu kopyala',
        icon: 'file',
        onClick: () => window.api.copyText(node.path)
      })
      items.push({
        label: multi ? `${targets.length} öğeyi sil` : 'Sil',
        icon: 'trash',
        danger: true,
        onClick: () => void handleDelete(targets)
      })
      return items
    },
    [
      clipboard,
      gitFiles,
      handleDelete,
      handleDuplicate,
      handleNewFile,
      handleNewFolder,
      handlePaste,
      handleRename,
      onOpenFile,
      onOpenGitDiff,
      onOpenTerminalHere,
      selected,
      selectedSet,
      targetDirFor
    ]
  )

  const selectedGitCode =
    lastNode && !lastNode.isDirectory ? gitFiles[lastNode.path.toLowerCase()] : undefined

  return (
    <div className="explorer">
      <div className="panel-head">
        <span className="explorer-title" title={rootPath}>
          <span className="folder-ico">
            <Icon name="folder" size={15} />
          </span>
          {basename(rootPath)}
        </span>
        <div className="explorer-actions">
          <button type="button" className="icon-btn" title="Yeni Dosya" onClick={handleNewFile}>
            <Icon name="file-plus" />
          </button>
          <button type="button" className="icon-btn" title="Yeni Klasör" onClick={handleNewFolder}>
            <Icon name="folder-plus" />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Git diff"
            disabled={!selectedGitCode}
            onClick={() => lastSelected && onOpenGitDiff(lastSelected)}
          >
            <Icon name="git-diff" />
          </button>
          <button
            type="button"
            className={`icon-btn ${showHidden ? 'is-on' : ''}`}
            title={showHidden ? 'Gizli klasörleri gizle' : 'Gizli klasörleri göster'}
            aria-pressed={showHidden}
            onClick={() => setShowHidden((value) => !value)}
          >
            <Icon name={showHidden ? 'eye' : 'eye-off'} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Tümünü kapat"
            onClick={collapseAll}
          >
            <Icon name="collapse" />
          </button>
          <button type="button" className="icon-btn" title="Yenile" onClick={onRefresh}>
            <Icon name="refresh" />
          </button>
        </div>
      </div>

      <div className="explorer-filter">
        <Icon name="search" size={13} />
        <input
          value={filter}
          placeholder="Açık klasörlerde filtrele…"
          aria-label="Dosya ağacında filtrele"
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setFilter('')
          }}
        />
        {filter && (
          <button type="button" className="icon-btn" title="Filtreyi temizle" onClick={() => setFilter('')}>
            <Icon name="close" size={13} />
          </button>
        )}
      </div>

      <div
        className="explorer-tree"
        ref={listRef}
        role="tree"
        aria-label="Dosya ağacı"
        aria-multiselectable="true"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onDragOver={(e) => {
          if (!dragPaths.length && !isExternalDrag(e)) return
          e.preventDefault()
          setDropTarget(rootPath)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropTarget(null)
        }}
        onDrop={(e) => {
          if (isExternalDrag(e)) {
            e.preventDefault()
            void handleExternalDrop(rootPath, e.dataTransfer.files)
          } else if (dragPaths.length) {
            e.preventDefault()
            void handleDropOn(rootPath, dragPaths)
          }
          setDragPaths([])
          setDropTarget(null)
        }}
      >
        {rootError && <div className="tree-note error">{rootError}</div>}
        {!rootError && rootLoading && <div className="tree-note">yükleniyor…</div>}
        {!rootError && !rootLoading && rows.length === 0 && (
          <div className="tree-note">{filter ? 'eşleşme yok' : 'boş'}</div>
        )}

        <div
          style={
            virtualize
              ? { height: rows.length * ROW_HEIGHT, position: 'relative' }
              : undefined
          }
        >
          <div
            style={
              virtualize
                ? {
                    position: 'absolute',
                    top: firstIndex * ROW_HEIGHT,
                    left: 0,
                    right: 0
                  }
                : undefined
            }
          >
            {visibleRows.map((row, index) => (
              <TreeRowItem
                key={row.node.path}
                row={row}
                index={firstIndex + index}
                total={rows.length}
                selected={selectedSet.has(row.node.path)}
                focused={focusPath === row.node.path}
                cut={cutSet.has(row.node.path)}
                dropTarget={dropTarget === row.node.path}
                gitFiles={gitFiles}
                onSelect={(e) => {
                  // Keyboard handling lives on the tree container, so clicking a
                  // row must hand it focus.
                  listRef.current?.focus()
                  if (e.shiftKey) selectRange(row.node.path)
                  else if (e.ctrlKey || e.metaKey) toggleSelect(row.node.path)
                  else {
                    selectOnly(row.node.path)
                    if (row.node.isDirectory) toggle(row.node.path)
                    else onOpenFile(row.node.path)
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!selectedSet.has(row.node.path)) selectOnly(row.node.path)
                  setMenu({ x: e.clientX, y: e.clientY, node: row.node })
                }}
                onDragStart={() => {
                  const paths = selectedSet.has(row.node.path) ? selected : [row.node.path]
                  setDragPaths(paths)
                }}
                onDragEnd={() => {
                  setDragPaths([])
                  setDropTarget(null)
                }}
                onDragOver={(e) => {
                  if (!dragPaths.length && !isExternalDrag(e)) return
                  e.preventDefault()
                  e.stopPropagation()
                  setDropTarget(row.node.isDirectory ? row.node.path : dirname(row.node.path))
                }}
                onDrop={(e) => {
                  const folder = row.node.isDirectory ? row.node.path : dirname(row.node.path)
                  if (isExternalDrag(e)) {
                    e.preventDefault()
                    e.stopPropagation()
                    void handleExternalDrop(folder, e.dataTransfer.files)
                  } else if (dragPaths.length) {
                    e.preventDefault()
                    e.stopPropagation()
                    void handleDropOn(folder, dragPaths)
                  }
                  setDragPaths([])
                  setDropTarget(null)
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.node)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

interface TreeRowItemProps {
  row: TreeRow
  index: number
  total: number
  selected: boolean
  focused: boolean
  cut: boolean
  dropTarget: boolean
  gitFiles: Record<string, string>
  onSelect: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

function TreeRowItem({
  row,
  index,
  total,
  selected,
  focused,
  cut,
  dropTarget,
  gitFiles,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}: TreeRowItemProps) {
  const { node, depth, expanded, loading } = row
  const badge = node.isDirectory
    ? folderHasChanges(gitFiles, node.path)
      ? { label: '', cls: 'git-mod' }
      : null
    : gitBadge(gitFiles[node.path.toLowerCase()])
  const spec = fileIcon(node.name)

  return (
    <div
      className={[
        'tree-row',
        selected ? 'is-selected' : '',
        focused ? 'is-focused' : '',
        row.hidden ? 'is-dimmed' : '',
        cut ? 'is-cut' : '',
        dropTarget ? 'is-drop' : '',
        badge ? badge.cls : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ paddingLeft: depth * 14 + 8 }}
      data-path={node.path}
      role="treeitem"
      aria-level={depth + 1}
      aria-setsize={total}
      aria-posinset={index + 1}
      aria-selected={selected}
      aria-expanded={node.isDirectory ? expanded : undefined}
      title={node.path}
      draggable
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span className={`tree-twisty ${node.isDirectory ? (expanded ? 'open' : '') : 'spacer'}`}>
        <Icon name="chevron" size={12} />
      </span>
      <span className={`tree-ico ${node.isDirectory ? 'folder' : `tone-${spec.tone}`}`}>
        <Icon
          name={node.isDirectory ? (expanded ? 'folder-open' : 'folder') : spec.icon}
          size={15}
        />
      </span>
      <span className="tree-label">{node.name}</span>
      {loading && <span className="tree-row-spinner" aria-hidden="true" />}
      {badge?.label && <span className={`git-badge ${badge.cls}`}>{badge.label}</span>}
      {badge && !badge.label && <span className="git-dot" aria-label="değişiklik var" />}
    </div>
  )
}
