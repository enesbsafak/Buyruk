import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useFileTree } from '../hooks/useFileTree'
import { basename, dirname, joinPath } from '../utils/pathUtils'
import { useDialog } from './DialogProvider'
import { Icon } from './Icon'
import { ContextMenu, type MenuItem } from './ContextMenu'
import type { FileNode, TerminalType } from '../types'

interface ExplorerContextValue {
  hiddenFolders: string[]
  gitFiles: Record<string, string>
  onOpenFile: (path: string) => void
  selected: FileNode | null
  setSelected: (node: FileNode | null) => void
  openMenu: (e: React.MouseEvent, node: FileNode) => void
  refreshNonce: number
}

const ExplorerContext = createContext<ExplorerContextValue | null>(null)
const useExplorer = () => {
  const ctx = useContext(ExplorerContext)
  if (!ctx) throw new Error('Explorer context missing')
  return ctx
}

function gitBadge(code: string | undefined): { label: string; cls: string } | null {
  if (!code) return null
  if (code === '??') return { label: 'U', cls: 'git-new' }
  if (code.includes('D')) return { label: 'D', cls: 'git-del' }
  if (code.includes('A')) return { label: 'A', cls: 'git-new' }
  if (code.includes('R')) return { label: 'R', cls: 'git-mod' }
  return { label: 'M', cls: 'git-mod' }
}

function DirChildren({ path, depth }: { path: string; depth: number }) {
  const { refreshNonce } = useExplorer()
  const { nodes, error } = useFileTree(path, refreshNonce)
  const pad = depth * 14 + 12

  if (error) return <div className="tree-note error" style={{ paddingLeft: pad }}>{error}</div>
  if (!nodes) return <div className="tree-note" style={{ paddingLeft: pad }}>yükleniyor…</div>
  if (nodes.length === 0) return <div className="tree-note" style={{ paddingLeft: pad }}>boş</div>
  return (
    <>
      {nodes.map((node) => (
        <TreeNode key={node.path} node={node} depth={depth} />
      ))}
    </>
  )
}

function TreeNode({ node, depth }: { node: FileNode; depth: number }) {
  const { hiddenFolders, gitFiles, onOpenFile, selected, setSelected, openMenu } = useExplorer()
  const [open, setOpen] = useState(false)
  const isHidden = node.isDirectory && hiddenFolders.includes(node.name)
  const isSelected = selected?.path === node.path
  const badge = node.isDirectory ? null : gitBadge(gitFiles[node.path.toLowerCase()])

  const handleClick = () => {
    setSelected(node)
    if (node.isDirectory) setOpen((o) => !o)
    else onOpenFile(node.path)
  }

  return (
    <div className="tree-node">
      <button
        type="button"
        className={[
          'tree-row',
          isSelected ? 'is-selected' : '',
          isHidden ? 'is-dimmed' : '',
          badge ? badge.cls : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openMenu(e, node)
        }}
        title={node.path}
      >
        <span className={`tree-twisty ${node.isDirectory ? (open ? 'open' : '') : 'spacer'}`}>
          <Icon name="chevron" size={12} />
        </span>
        <span className={`tree-ico ${node.isDirectory ? 'folder' : ''}`}>
          <Icon name={node.isDirectory ? 'folder' : 'file'} size={15} />
        </span>
        <span className="tree-label">{node.name}</span>
        {badge && <span className={`git-badge ${badge.cls}`}>{badge.label}</span>}
      </button>
      {node.isDirectory && open && <DirChildren path={node.path} depth={depth + 1} />}
    </div>
  )
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

export function FileExplorer({
  rootPath,
  hiddenFolders,
  gitFiles,
  onOpenFile,
  onOpenGitDiff,
  onOpenTerminalHere,
  refreshNonce,
  onRefresh
}: FileExplorerProps) {
  if (!rootPath) {
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

  return (
    <FileExplorerContent
      key={rootPath}
      rootPath={rootPath}
      hiddenFolders={hiddenFolders}
      gitFiles={gitFiles}
      onOpenFile={onOpenFile}
      onOpenGitDiff={onOpenGitDiff}
      onOpenTerminalHere={onOpenTerminalHere}
      refreshNonce={refreshNonce}
      onRefresh={onRefresh}
    />
  )
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
  const [selected, setSelected] = useState<FileNode | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null)

  const targetDirFor = (node: FileNode | null): string =>
    node ? (node.isDirectory ? node.path : dirname(node.path)) : rootPath

  const targetDir = targetDirFor(selected)
  const selectedGitCode =
    selected && !selected.isDirectory ? gitFiles[selected.path.toLowerCase()] : undefined

  const fail = (action: string, err: unknown) =>
    dialog.notify(`${action}: ${err instanceof Error ? err.message : String(err)}`, 'error')

  const handleNewFile = async () => {
    const name = await dialog.prompt({ title: 'Yeni Dosya', label: `Konum · ${targetDir}`, placeholder: 'index.ts', confirmText: 'Oluştur' })
    if (!name) return
    try {
      await window.api.createFile(joinPath(targetDir, name))
      onRefresh()
    } catch (err) {
      fail('Dosya oluşturulamadı', err)
    }
  }

  const handleNewFolder = async () => {
    const name = await dialog.prompt({ title: 'Yeni Klasör', label: `Konum · ${targetDir}`, placeholder: 'src', confirmText: 'Oluştur' })
    if (!name) return
    try {
      await window.api.createFolder(joinPath(targetDir, name))
      onRefresh()
    } catch (err) {
      fail('Klasör oluşturulamadı', err)
    }
  }

  const handleRename = async () => {
    if (!selected) return
    const name = await dialog.prompt({ title: 'Yeniden Adlandır', label: selected.name, defaultValue: selected.name, confirmText: 'Değiştir' })
    if (!name || name === selected.name) return
    try {
      await window.api.renamePath(selected.path, joinPath(dirname(selected.path), name))
      setSelected(null)
      onRefresh()
    } catch (err) {
      fail('Yeniden adlandırılamadı', err)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    const ok = await dialog.confirm({ title: 'Sil', message: `"${selected.name}" kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`, danger: true, confirmText: 'Sil' })
    if (!ok) return
    try {
      await window.api.deletePath(selected.path)
      setSelected(null)
      onRefresh()
    } catch (err) {
      fail('Silinemedi', err)
    }
  }

  const openMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    setSelected(node)
    setMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  const contextValue = useMemo(
    () => ({ hiddenFolders, gitFiles, onOpenFile, selected, setSelected, openMenu, refreshNonce }),
    [hiddenFolders, gitFiles, onOpenFile, selected, openMenu, refreshNonce]
  )

  const menuItems = (node: FileNode): MenuItem[] => {
    const dir = targetDirFor(node)
    const items: MenuItem[] = []
    if (!node.isDirectory) {
      items.push({ label: 'Düzenleyicide aç', icon: 'file', onClick: () => onOpenFile(node.path) })
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
      submenu: (['cmd', 'powershell', 'claude', 'codex', 'opencode'] as TerminalType[]).map((t) => ({
        label:
          t === 'cmd'
            ? 'CMD'
            : t === 'powershell'
              ? 'PowerShell'
              : t === 'claude'
                ? 'Claude'
                : t === 'codex'
                  ? 'Codex'
                  : 'OpenCode',
        icon: 'terminal',
        onClick: () => onOpenTerminalHere(dir, t)
      }))
    })
    items.push({ label: "Explorer'da göster", icon: 'folder', onClick: () => window.api.revealPath(node.path) })
    items.push({ label: 'Yolu kopyala', icon: 'file', onClick: () => window.api.copyText(node.path) })
    items.push({ separator: true })
    items.push({ label: 'Yeni dosya', icon: 'file-plus', onClick: handleNewFile })
    items.push({ label: 'Yeni klasör', icon: 'folder-plus', onClick: handleNewFolder })
    items.push({ label: 'Yeniden adlandır', icon: 'edit', onClick: handleRename })
    items.push({ label: 'Sil', icon: 'trash', danger: true, onClick: handleDelete })
    return items
  }

  return (
    <ExplorerContext.Provider value={contextValue}>
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
            <button type="button" className="icon-btn" title="Yeniden Adlandır" disabled={!selected} onClick={handleRename}>
              <Icon name="edit" />
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Git diff"
              disabled={!selectedGitCode}
              onClick={() => selected && onOpenGitDiff(selected.path)}
            >
              <Icon name="git-diff" />
            </button>
            <button type="button" className="icon-btn" title="Sil" disabled={!selected} onClick={handleDelete}>
              <Icon name="trash" />
            </button>
            <button type="button" className="icon-btn" title="Yenile" onClick={onRefresh}>
              <Icon name="refresh" />
            </button>
          </div>
        </div>
        <div className="explorer-tree">
          <DirChildren path={rootPath} depth={0} />
        </div>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.node)} onClose={() => setMenu(null)} />
      )}
    </ExplorerContext.Provider>
  )
}
