import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { AppView } from './components/AppView'
import type { Command } from './components/CommandPalette'
import { useDialog } from './components/DialogProvider'
import { useSessions } from './hooks/useSessions'
import { useSettings } from './hooks/useSettings'
import { useOrchestrator } from './hooks/useOrchestrator'
import { terminalBus } from './terminalBus'
import { describeOrchestratorConfig } from './orchestrator'
import { getLanguage, isImageFile } from './utils/language'
import { basename, joinPath } from './utils/pathUtils'
import {
  loadRecents,
  loadSavedSessions,
  pushRecent,
  saveSessions,
  type RecentFolder
} from './utils/persistence'
import { INITIAL_UPDATE_STATUS, type AppUpdateStatus } from './updateTypes'
import type { GitOverview, GitStatus, SessionRuntime, Settings, TerminalType } from './types'

const EMPTY_GIT: GitStatus = { isRepo: false, branch: '', files: {} }
const EMPTY_GIT_OVERVIEW: GitOverview = {
  isRepo: false,
  root: '',
  branch: '',
  upstream: '',
  ahead: 0,
  behind: 0,
  stashCount: 0,
  changes: [],
  recentCommits: [],
  remoteActivity: [],
  lastUpdated: 0
}

function commandFor(type: TerminalType, settings: Settings): string {
  switch (type) {
    case 'cmd':
      return settings.cmdCommand
    case 'powershell':
      return settings.powershellCommand
    case 'claude':
      return settings.claudeCommand
    case 'codex':
      return settings.codexCommand
  }
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err))

interface UiState {
  settingsOpen: boolean
  explorerNonce: number
  statusMessage: string
  recents: RecentFolder[]
  broadcast: boolean
  gitStatus: GitStatus
  gitOverview: GitOverview
  gitPanelOpen: boolean
  quickOpenOpen: boolean
  paletteOpen: boolean
  orchestratorOpen: boolean
  updateStatus: AppUpdateStatus
}

type UiAction =
  | { type: 'set-settings-open'; open: boolean }
  | { type: 'bump-explorer' }
  | { type: 'set-status-message'; message: string }
  | { type: 'set-recents'; recents: RecentFolder[] }
  | { type: 'toggle-broadcast' }
  | { type: 'set-git-status'; gitStatus: GitStatus }
  | { type: 'set-git-overview'; gitOverview: GitOverview }
  | { type: 'toggle-git-panel' }
  | { type: 'set-quick-open'; open: boolean }
  | { type: 'set-palette-open'; open: boolean }
  | { type: 'set-orchestrator-open'; open: boolean }
  | { type: 'set-update-status'; status: AppUpdateStatus }

function createInitialUiState(): UiState {
  return {
    settingsOpen: false,
    explorerNonce: 0,
    statusMessage: '',
    recents: loadRecents(),
    broadcast: false,
    gitStatus: EMPTY_GIT,
    gitOverview: EMPTY_GIT_OVERVIEW,
    gitPanelOpen: false,
    quickOpenOpen: false,
    paletteOpen: false,
    orchestratorOpen: false,
    updateStatus: INITIAL_UPDATE_STATUS
  }
}

function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'set-settings-open':
      return { ...state, settingsOpen: action.open }
    case 'bump-explorer':
      return { ...state, explorerNonce: state.explorerNonce + 1 }
    case 'set-status-message':
      return { ...state, statusMessage: action.message }
    case 'set-recents':
      return { ...state, recents: action.recents }
    case 'toggle-broadcast':
      return { ...state, broadcast: !state.broadcast }
    case 'set-git-status':
      return { ...state, gitStatus: action.gitStatus }
    case 'set-git-overview':
      return { ...state, gitOverview: action.gitOverview }
    case 'toggle-git-panel':
      return { ...state, gitPanelOpen: !state.gitPanelOpen }
    case 'set-quick-open':
      return { ...state, quickOpenOpen: action.open }
    case 'set-palette-open':
      return { ...state, paletteOpen: action.open }
    case 'set-orchestrator-open':
      return { ...state, orchestratorOpen: action.open }
    case 'set-update-status':
      return { ...state, updateStatus: action.status }
  }
}

function currentOpenFile(
  sessions: SessionRuntime[],
  sessionId: string,
  filePath: string
): SessionRuntime['openFiles'][number] | undefined {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const fileByPath = new Map(
    (sessionById.get(sessionId)?.openFiles ?? []).map((file) => [file.path, file])
  )
  return fileByPath.get(filePath)
}

interface UseCommandListOptions {
  activeSession: SessionRuntime | null
  broadcast: boolean
  settings: Settings
  onNewTerminal: (type: TerminalType) => void
  onOpenFolder: () => void
  onNewFolder: () => void
  onBroadcastPrompt: () => void
  onOpenOrchestrator: () => void
  onSaveFile: () => void
  onCloseActive: () => void
  onRestart: (session: SessionRuntime) => void
  updateSettings: (settings: Settings) => void
  dispatchUi: (action: UiAction) => void
}

function useCommandList({
  activeSession,
  broadcast,
  settings,
  onNewTerminal,
  onOpenFolder,
  onNewFolder,
  onBroadcastPrompt,
  onOpenOrchestrator,
  onSaveFile,
  onCloseActive,
  onRestart,
  updateSettings,
  dispatchUi
}: UseCommandListOptions): Command[] {
  return useMemo(() => {
    const list: Command[] = [
      { id: 'new-cmd', label: 'Yeni CMD', icon: 'terminal', run: () => onNewTerminal('cmd') },
      { id: 'new-ps', label: 'Yeni PowerShell', icon: 'terminal', run: () => onNewTerminal('powershell') },
      { id: 'new-claude', label: 'Yeni Claude', icon: 'terminal', run: () => onNewTerminal('claude') },
      { id: 'new-codex', label: 'Yeni Codex', icon: 'terminal', run: () => onNewTerminal('codex') },
      { id: 'open-folder', label: 'Klasör Aç (workspace değiştir)', icon: 'folder', run: onOpenFolder },
      { id: 'new-folder', label: 'Yeni Klasör', icon: 'folder-plus', run: onNewFolder },
      { id: 'orchestrator', label: 'AI Orkestrasyon', icon: 'orchestrator', run: onOpenOrchestrator },
      { id: 'quick-open', label: 'Hızlı Dosya Aç', hint: 'Ctrl+P', icon: 'search', run: () => activeSession && dispatchUi({ type: 'set-quick-open', open: true }) },
      { id: 'save', label: 'Dosyayı Kaydet', hint: 'Ctrl+S', icon: 'save', run: onSaveFile },
      { id: 'close-term', label: 'Aktif Terminali Kapat', icon: 'close', run: onCloseActive },
      { id: 'broadcast-send', label: 'Broadcast Gönder', icon: 'broadcast', run: onBroadcastPrompt },
      { id: 'broadcast-mode', label: broadcast ? 'Broadcast Modunu Kapat' : 'Broadcast Modunu Aç', icon: 'broadcast', run: () => dispatchUi({ type: 'toggle-broadcast' }) },
      { id: 'theme', label: settings.theme === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç', icon: 'bolt', run: () => updateSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' }) },
      { id: 'settings', label: 'Ayarlar', hint: 'Ctrl+,', icon: 'settings', run: () => dispatchUi({ type: 'set-settings-open', open: true }) }
    ]
    if (activeSession) {
      list.splice(9, 0, {
        id: 'restart-term',
        label: 'Aktif Terminali Yeniden Başlat',
        icon: 'restart',
        run: () => onRestart(activeSession)
      })
    }
    return list
  }, [
    activeSession,
    broadcast,
    settings,
    onNewTerminal,
    onOpenFolder,
    onNewFolder,
    onBroadcastPrompt,
    onOpenOrchestrator,
    onSaveFile,
    onCloseActive,
    onRestart,
    updateSettings,
    dispatchUi
  ])
}

interface GlobalShortcutsOptions {
  activeSessionRef: { current: SessionRuntime | null }
  sessionsRef: { current: SessionRuntime[] }
  onSetActive: (id: string) => void
  dispatchUi: (action: UiAction) => void
}

function useGlobalShortcuts({
  activeSessionRef,
  sessionsRef,
  onSetActive,
  dispatchUi
}: GlobalShortcutsOptions): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        dispatchUi({ type: 'set-palette-open', open: true })
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        if (activeSessionRef.current) dispatchUi({ type: 'set-quick-open', open: true })
      } else if (mod && e.key === ',') {
        e.preventDefault()
        dispatchUi({ type: 'set-settings-open', open: true })
      } else if (mod && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        const session = sessionsRef.current[parseInt(e.key, 10) - 1]
        if (session) {
          e.preventDefault()
          onSetActive(session.id)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeSessionRef, sessionsRef, onSetActive, dispatchUi])
}

interface TerminalControllerOptions {
  activeId: string | null
  activeSessionRef: { current: SessionRuntime | null }
  actions: ReturnType<typeof useSessions>['actions']
  broadcast: boolean
  dialog: ReturnType<typeof useDialog>
  sessionsRef: { current: SessionRuntime[] }
  settings: Settings
  dispatchUi: (action: UiAction) => void
}

function useTerminalController({
  activeId,
  activeSessionRef,
  actions,
  broadcast,
  dialog,
  sessionsRef,
  settings,
  dispatchUi
}: TerminalControllerOptions) {
  const bellThrottle = useRef<Record<string, number>>({})
  const broadcastRef = useRef(false)
  broadcastRef.current = broadcast

  const handleInput = useCallback((id: string, data: string) => {
    if (broadcastRef.current) {
      for (const session of sessionsRef.current) {
        window.api.writeTerminal(session.id, data)
        if (session.type === 'codex' && data.endsWith('\r')) {
          window.api.writeTerminal(session.id, '\r')
        }
      }
    } else {
      window.api.writeTerminal(id, data)
    }
  }, [sessionsRef])

  const handleBroadcastPrompt = useCallback(async () => {
    const targets = sessionsRef.current
    if (targets.length === 0) {
      dialog.notify('Broadcast için açık terminal yok.', 'info')
      return
    }

    const message = await dialog.prompt({
      title: 'Broadcast Gönder',
      label: `${targets.length} terminale gönder`,
      placeholder: 'Komut veya prompt',
      confirmText: 'Gönder'
    })
    if (!message) return

    for (const session of targets) {
      window.api.writeTerminal(session.id, `${message}\r`)
      if (session.type === 'codex') window.api.writeTerminal(session.id, '\r')
    }
    dispatchUi({ type: 'set-status-message', message: `${targets.length} terminale gönderildi` })
  }, [dialog, dispatchUi, sessionsRef])

  useEffect(() => {
    const offData = window.api.onTerminalData((id, data) => terminalBus.push(id, data))
    const offExit = window.api.onTerminalExit((id, code) => {
      terminalBus.push(id, `\r\n\x1b[33m[süreç ${code} koduyla kapandı]\x1b[0m\r\n`)
      actions.setStatus(id, 'exited', code)
    })
    return () => {
      offData()
      offExit()
    }
  }, [actions])

  const spawnTerminal = useCallback(
    async (type: TerminalType, cwd: string) => {
      try {
        const session = await window.api.createTerminal({
          type,
          cwd,
          command: commandFor(type, settings),
          cols: 80,
          rows: 24
        })
        actions.add(session)
        dispatchUi({ type: 'set-status-message', message: `Açıldı: ${session.title}` })
        dispatchUi({ type: 'set-recents', recents: pushRecent(cwd, type) })
      } catch (err) {
        dialog.notify(`Terminal açılamadı: ${errMsg(err)}`, 'error')
      }
    },
    [actions, settings, dialog, dispatchUi]
  )

  const handleNewTerminal = useCallback(
    async (type: TerminalType) => {
      const cwd = await window.api.selectFolder()
      if (!cwd) return
      await spawnTerminal(type, cwd)
    },
    [spawnTerminal]
  )

  const handleOpenRecent = useCallback(
    (recent: RecentFolder) => spawnTerminal(recent.type, recent.cwd),
    [spawnTerminal]
  )

  const handleRestart = useCallback(
    async (session: SessionRuntime) => {
      terminalBus.clear(session.id)
      actions.restart(session.id)
      try {
        await window.api.restartTerminal({
          id: session.id,
          type: session.type,
          cwd: session.cwd,
          command: commandFor(session.type, settings),
          cols: 80,
          rows: 24
        })
        dispatchUi({ type: 'set-status-message', message: `Yeniden başlatıldı: ${session.title}` })
      } catch (err) {
        dialog.notify(`Yeniden başlatılamadı: ${errMsg(err)}`, 'error')
      }
    },
    [actions, settings, dialog, dispatchUi]
  )

  const handleOpenTerminalHere = useCallback(
    (cwd: string, type: TerminalType) => spawnTerminal(type, cwd),
    [spawnTerminal]
  )

  const handleRenameSession = useCallback(
    async (session: SessionRuntime) => {
      const title = await dialog.prompt({
        title: 'Oturumu Yeniden Adlandır',
        label: 'Başlık',
        defaultValue: session.title,
        confirmText: 'Değiştir'
      })
      if (title) actions.rename(session.id, title)
    },
    [dialog, actions]
  )

  const handleBell = useCallback(
    (id: string) => {
      const now = Date.now()
      if (now - (bellThrottle.current[id] ?? 0) < 1500) return
      bellThrottle.current[id] = now
      const session = sessionsRef.current.find((item) => item.id === id)
      if (!session) return
      const unfocused = document.hidden || !document.hasFocus()
      if (unfocused || id !== activeSessionRef.current?.id) {
        try {
          new Notification(`MultiCLI · ${session.title}`, {
            body: 'Terminalden bildirim (bell)'
          })
        } catch {
          // notifications may be unavailable
        }
        dialog.notify(`🔔 ${session.title}`, 'info')
      }
    },
    [activeSessionRef, dialog, sessionsRef]
  )

  const handleCloseSession = useCallback(
    async (id: string) => {
      try {
        await window.api.killTerminal(id)
      } catch {
        // already gone
      }
      terminalBus.clear(id)
      actions.remove(id)
    },
    [actions]
  )

  const handleCloseActive = useCallback(() => {
    if (activeId) handleCloseSession(activeId)
  }, [activeId, handleCloseSession])

  return {
    handleInput,
    handleBroadcastPrompt,
    handleNewTerminal,
    handleOpenRecent,
    handleRestart,
    handleOpenTerminalHere,
    handleRenameSession,
    handleBell,
    handleCloseSession,
    handleCloseActive
  }
}

interface FileControllerOptions {
  activeSession: SessionRuntime | null
  activeSessionRef: { current: SessionRuntime | null }
  actions: ReturnType<typeof useSessions>['actions']
  dialog: ReturnType<typeof useDialog>
  explorerNonce: number
  sessionsRef: { current: SessionRuntime[] }
  bumpExplorer: () => void
  dispatchUi: (action: UiAction) => void
}

function useFileController({
  activeSession,
  activeSessionRef,
  actions,
  dialog,
  explorerNonce,
  sessionsRef,
  bumpExplorer,
  dispatchUi
}: FileControllerOptions) {
  useEffect(() => {
    window.api.watchDir(activeSession?.cwd ?? null)
  }, [activeSession?.cwd])

  const handleFsChanged = useCallback(() => {
    bumpExplorer()
    const session = activeSessionRef.current
    if (!session) return
    for (const file of session.openFiles) {
      if (file.readOnly || file.isBinary || file.isImage) continue
      window.api
        .readFile(file.path)
        .then((res) => {
          if (res.isBinary) return
          const current = currentOpenFile(sessionsRef.current, session.id, file.path)
          if (!current || res.content === current.savedContent) return
          if (current.content === current.savedContent) {
            actions.updateContent(session.id, file.path, res.content)
            actions.markSaved(session.id, file.path)
          } else {
            dialog.notify(`Diskte değişti: ${current.name} (kaydedilmemiş değişikliğin var)`, 'info')
          }
        })
        .catch(() => {})
    }
  }, [activeSessionRef, actions, bumpExplorer, dialog, sessionsRef])

  useEffect(() => window.api.onFsChanged(handleFsChanged), [handleFsChanged])

  useEffect(() => {
    const root = activeSession?.cwd
    if (!root) {
      dispatchUi({ type: 'set-git-status', gitStatus: EMPTY_GIT })
      dispatchUi({ type: 'set-git-overview', gitOverview: EMPTY_GIT_OVERVIEW })
      return
    }
    let cancelled = false
    Promise.all([window.api.gitStatus(root), window.api.gitOverview(root)])
      .then(([status, overview]) => {
        if (cancelled) return
        dispatchUi({ type: 'set-git-status', gitStatus: status })
        dispatchUi({ type: 'set-git-overview', gitOverview: overview })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeSession?.cwd, explorerNonce, dispatchUi])

  const handleRefreshGit = useCallback(async () => {
    const root = activeSessionRef.current?.cwd
    if (!root) return
    try {
      const [status, overview] = await Promise.all([
        window.api.gitStatus(root),
        window.api.gitOverview(root)
      ])
      dispatchUi({ type: 'set-git-status', gitStatus: status })
      dispatchUi({ type: 'set-git-overview', gitOverview: overview })
      dispatchUi({ type: 'set-status-message', message: 'Git bilgisi yenilendi' })
    } catch (err) {
      dialog.notify(`Git bilgisi alınamadı: ${errMsg(err)}`, 'error')
    }
  }, [activeSessionRef, dialog, dispatchUi])

  const handleFetchGit = useCallback(async () => {
    const root = activeSessionRef.current?.cwd
    if (!root) return
    try {
      const overview = await window.api.gitFetch(root)
      const status = await window.api.gitStatus(root)
      dispatchUi({ type: 'set-git-status', gitStatus: status })
      dispatchUi({ type: 'set-git-overview', gitOverview: overview })
      dispatchUi({ type: 'set-status-message', message: 'Git remote bilgisi güncellendi' })
    } catch (err) {
      dialog.notify(`Git fetch başarısız: ${errMsg(err)}`, 'error')
    }
  }, [activeSessionRef, dialog, dispatchUi])

  const handleOpenFolder = useCallback(async () => {
    if (!activeSession) {
      dialog.notify('Önce bir terminal oturumu açın.', 'info')
      return
    }
    const dir = await window.api.selectFolder()
    if (!dir) return
    const label = activeSession.title.split(' · ')[0]
    actions.setCwd(activeSession.id, dir, `${label} · ${basename(dir)}`)
    bumpExplorer()
  }, [activeSession, actions, bumpExplorer, dialog])

  const handleNewFolder = useCallback(async () => {
    const parent = await window.api.createFolderDialog()
    if (!parent) return
    const name = await dialog.prompt({
      title: 'Yeni Klasör',
      label: `Konum · ${parent}`,
      placeholder: 'my-folder',
      confirmText: 'Oluştur'
    })
    if (!name) return
    try {
      await window.api.createFolder(joinPath(parent, name))
      dispatchUi({ type: 'set-status-message', message: `Klasör oluşturuldu: ${name}` })
      dialog.notify(`Klasör oluşturuldu: ${name}`, 'success')
      bumpExplorer()
    } catch (err) {
      dialog.notify(`Klasör oluşturulamadı: ${errMsg(err)}`, 'error')
    }
  }, [dialog, bumpExplorer, dispatchUi])

  const handleOpenFile = useCallback(
    async (path: string) => {
      if (!activeSession) return
      try {
        if (isImageFile(path)) {
          const dataUrl = await window.api.readFileBase64(path)
          actions.openFile(activeSession.id, {
            path,
            name: basename(path),
            content: '',
            savedContent: '',
            language: 'plaintext',
            isBinary: false,
            isImage: true,
            dataUrl
          })
          return
        }
        const res = await window.api.readFile(path)
        actions.openFile(activeSession.id, {
          path,
          name: basename(path),
          content: res.isBinary ? '' : res.content,
          savedContent: res.isBinary ? '' : res.content,
          language: getLanguage(path),
          isBinary: res.isBinary,
          isImage: false
        })
      } catch (err) {
        dialog.notify(`Dosya açılamadı: ${errMsg(err)}`, 'error')
      }
    },
    [activeSession, actions, dialog]
  )

  const saveActiveFile = useCallback(async () => {
    if (!activeSession) return
    const file = activeSession.openFiles.find((item) => item.path === activeSession.activeFilePath)
    if (!file || file.readOnly || file.isBinary) return
    try {
      await window.api.writeFile(file.path, file.content)
      actions.markSaved(activeSession.id, file.path)
      dispatchUi({ type: 'set-status-message', message: `Kaydedildi: ${file.name}` })
    } catch (err) {
      dialog.notify(`Kaydedilemedi: ${errMsg(err)}`, 'error')
    }
  }, [activeSession, actions, dialog, dispatchUi])

  const saveRef = useRef(saveActiveFile)
  saveRef.current = saveActiveFile
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleChangeContent = useCallback(
    (path: string, content: string) => {
      const session = activeSessionRef.current
      if (session) actions.updateContent(session.id, path, content)
    },
    [activeSessionRef, actions]
  )

  const handleOpenGitDiff = useCallback(
    async (path: string) => {
      const session = activeSessionRef.current
      if (!session) return

      try {
        const diff = await window.api.gitDiff(session.cwd, path)
        const content = diff.trimEnd()
        if (!content) {
          dialog.notify('Bu dosyada Git diff yok.', 'info')
          return
        }

        actions.openFile(session.id, {
          path: `git-diff:${path}`,
          name: `${basename(path)}.diff`,
          content,
          savedContent: content,
          language: 'diff',
          isBinary: false,
          isImage: false,
          readOnly: true
        })
        dispatchUi({ type: 'set-status-message', message: `Git diff açıldı: ${basename(path)}` })
      } catch (err) {
        dialog.notify(`Git diff açılamadı: ${errMsg(err)}`, 'error')
      }
    },
    [activeSessionRef, actions, dialog, dispatchUi]
  )

  const handleSelectFile = useCallback(
    (path: string) => {
      const session = activeSessionRef.current
      if (session) actions.setActiveFile(session.id, path)
    },
    [activeSessionRef, actions]
  )

  const handleCloseFile = useCallback(
    (path: string) => {
      const session = activeSessionRef.current
      if (session) actions.closeFile(session.id, path)
    },
    [activeSessionRef, actions]
  )

  return {
    handleOpenFolder,
    handleNewFolder,
    handleOpenFile,
    handleOpenGitDiff,
    saveActiveFile,
    handleChangeContent,
    handleSelectFile,
    handleCloseFile,
    handleRefreshGit,
    handleFetchGit
  }
}

function useAppModel() {
  const dialog = useDialog()
  const { settings, update: updateSettings } = useSettings()
  const {
    config: orchestratorConfig,
    update: updateOrchestrator,
    reset: resetOrchestrator
  } = useOrchestrator(settings)
  const { sessions, activeId, activeSession, actions } = useSessions()

  const [ui, dispatchUi] = useReducer(uiReducer, undefined, createInitialUiState)
  const {
    settingsOpen,
    explorerNonce,
    statusMessage,
    recents,
    broadcast,
    gitStatus,
    gitOverview,
    gitPanelOpen,
    quickOpenOpen,
    paletteOpen,
    orchestratorOpen,
    updateStatus
  } = ui
  const restoredRef = useRef(false)
  const initialSettingsRef = useRef(settings)
  const addSessionRef = useRef(actions.add)
  addSessionRef.current = actions.add

  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  const activeSessionRef = useRef(activeSession)
  activeSessionRef.current = activeSession

  const bumpExplorer = useCallback(() => dispatchUi({ type: 'bump-explorer' }), [])
  const openOrchestrator = useCallback(
    () => dispatchUi({ type: 'set-orchestrator-open', open: true }),
    []
  )
  const openSettings = useCallback(
    () => dispatchUi({ type: 'set-settings-open', open: true }),
    []
  )
  const toggleGitPanel = useCallback(() => dispatchUi({ type: 'toggle-git-panel' }), [])
  const closeQuickOpen = useCallback(() => dispatchUi({ type: 'set-quick-open', open: false }), [])
  const closePalette = useCallback(() => dispatchUi({ type: 'set-palette-open', open: false }), [])
  const closeOrchestrator = useCallback(
    () => dispatchUi({ type: 'set-orchestrator-open', open: false }),
    []
  )
  const closeSettings = useCallback(
    () => dispatchUi({ type: 'set-settings-open', open: false }),
    []
  )

  const {
    handleInput,
    handleBroadcastPrompt,
    handleNewTerminal,
    handleOpenRecent,
    handleRestart,
    handleOpenTerminalHere,
    handleRenameSession,
    handleBell,
    handleCloseSession,
    handleCloseActive
  } = useTerminalController({
    activeId,
    activeSessionRef,
    actions,
    broadcast,
    dialog,
    sessionsRef,
    settings,
    dispatchUi
  })

  const {
    handleOpenFolder,
    handleNewFolder,
    handleOpenFile,
    handleOpenGitDiff,
    saveActiveFile,
    handleChangeContent,
    handleSelectFile,
    handleCloseFile,
    handleRefreshGit,
    handleFetchGit
  } = useFileController({
    activeSession,
    activeSessionRef,
    actions,
    dialog,
    explorerNonce,
    sessionsRef,
    bumpExplorer,
    dispatchUi
  })

  // Ctrl+P quick file open.
  useGlobalShortcuts({
    activeSessionRef,
    sessionsRef,
    onSetActive: actions.setActive,
    dispatchUi
  })

  useEffect(() => {
    window.api.updates
      .getStatus()
      .then((status) => dispatchUi({ type: 'set-update-status', status }))
      .catch(() => {})
    return window.api.updates.onStatus((status) =>
      dispatchUi({ type: 'set-update-status', status })
    )
  }, [])

  const handleCheckForUpdates = useCallback(() => {
    window.api.updates
      .check()
      .then((status) => dispatchUi({ type: 'set-update-status', status }))
      .catch((err: unknown) =>
        dispatchUi({
          type: 'set-update-status',
          status: {
            state: 'error',
            message: 'Güncelleme kontrolü başarısız',
            error: errMsg(err)
          }
        })
      )
  }, [])

  const handleInstallUpdate = useCallback(() => {
    window.api.updates.install()
  }, [])

  // Apply the selected theme to the document root.
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  // Confirm before closing if there are unsaved editor changes.
  useEffect(() => {
    return window.api.windowControls.onConfirmClose(async () => {
      const hasUnsaved = sessionsRef.current.some((s) =>
        s.openFiles.some(
          (f) => !f.readOnly && !f.isBinary && !f.isImage && f.content !== f.savedContent
        )
      )
      if (!hasUnsaved) {
        window.api.windowControls.doClose()
        return
      }
      const ok = await dialog.confirm({
        title: 'Çıkış',
        message: 'Kaydedilmemiş değişiklikler var. Yine de kapatılsın mı?',
        danger: true,
        confirmText: 'Kapat'
      })
      if (ok) window.api.windowControls.doClose()
    })
  }, [dialog])

  // Restore previously-open sessions once on startup; persist on every change.
  useEffect(() => {
    const saved = loadSavedSessions()
    if (saved.length === 0) {
      restoredRef.current = true
      return
    }
    let cancelled = false
    Promise.all(
      saved.map(async (s) => {
        if (cancelled) return
        try {
          const session = await window.api.createTerminal({
            type: s.type,
            cwd: s.cwd,
            command: commandFor(s.type, initialSettingsRef.current),
            cols: 80,
            rows: 24
          })
          if (!cancelled) addSessionRef.current(session)
        } catch {
          // folder may no longer exist; skip it
        }
      })
    ).finally(() => {
      if (!cancelled) restoredRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!restoredRef.current) return
    saveSessions(sessions.map((s) => ({ type: s.type, cwd: s.cwd, title: s.title })))
  }, [sessions])

  const handleSaveSettings = useCallback(
    (next: Settings) => {
      updateSettings(next)
      dispatchUi({ type: 'set-settings-open', open: false })
      dispatchUi({ type: 'set-status-message', message: 'Ayarlar kaydedildi' })
      dialog.notify('Ayarlar kaydedildi', 'success')
    },
    [dialog, updateSettings]
  )

  const handleSaveOrchestrator = useCallback(
    (next: typeof orchestratorConfig) => {
      updateOrchestrator(next)
      dispatchUi({ type: 'set-orchestrator-open', open: false })
      dispatchUi({ type: 'set-status-message', message: 'AI orkestrasyon kaydedildi' })
      dialog.notify('AI orkestrasyon kaydedildi', 'success')
    },
    [dialog, updateOrchestrator]
  )

  const handleResetOrchestrator = useCallback(() => {
    resetOrchestrator()
    dispatchUi({ type: 'set-status-message', message: 'AI orkestrasyon varsayılana döndü' })
    dialog.notify('AI orkestrasyon varsayılana döndü', 'info')
  }, [dialog, resetOrchestrator])

  const orchestratorSummary = useMemo(
    () => describeOrchestratorConfig(orchestratorConfig),
    [orchestratorConfig]
  )

  const commands = useCommandList({
    activeSession,
    broadcast,
    settings,
    onNewTerminal: handleNewTerminal,
    onOpenFolder: handleOpenFolder,
    onNewFolder: handleNewFolder,
    onBroadcastPrompt: handleBroadcastPrompt,
    onOpenOrchestrator: openOrchestrator,
    onSaveFile: saveActiveFile,
    onCloseActive: handleCloseActive,
    onRestart: handleRestart,
    updateSettings,
    dispatchUi
  })

  return {
    activeId,
    activeSession,
    broadcast,
    closeOrchestrator,
    closePalette,
    closeQuickOpen,
    closeSettings,
    commands,
    explorerNonce,
    gitStatus,
    gitOverview,
    gitPanelOpen,
    handleBell,
    handleBroadcastPrompt,
    handleChangeContent,
    handleCheckForUpdates,
    handleCloseActive,
    handleCloseFile,
    handleCloseSession,
    handleInstallUpdate,
    handleFetchGit,
    handleInput,
    handleNewFolder,
    handleNewTerminal,
    handleOpenFile,
    handleOpenFolder,
    handleOpenGitDiff,
    handleOpenRecent,
    handleOpenTerminalHere,
    handleRenameSession,
    handleResetOrchestrator,
    handleRefreshGit,
    handleRestart,
    handleSaveOrchestrator,
    handleSaveSettings,
    handleSelectFile,
    openOrchestrator,
    openSettings,
    orchestratorConfig,
    orchestratorOpen,
    orchestratorSummary,
    paletteOpen,
    quickOpenOpen,
    recents,
    saveActiveFile,
    sessions,
    settings,
    settingsOpen,
    statusMessage,
    toggleGitPanel,
    updateStatus,
    setActiveSession: actions.setActive,
    bumpExplorer
  }
}

export function App() {
  return <AppView {...useAppModel()} />
}
