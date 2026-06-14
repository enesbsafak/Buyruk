import { useCallback, useMemo, useReducer } from 'react'
import type {
  OpenFile,
  SessionRuntime,
  TerminalSession,
  TerminalStatus
} from '../types'

interface State {
  sessions: SessionRuntime[]
  activeId: string | null
}

type Action =
  | { type: 'ADD'; session: TerminalSession }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'REMOVE'; id: string }
  | { type: 'SET_STATUS'; id: string; status: TerminalStatus; exitCode?: number }
  | { type: 'RESTART'; id: string }
  | { type: 'RENAME'; id: string; title: string }
  | { type: 'SET_CWD'; id: string; cwd: string; title: string }
  | { type: 'OPEN_FILE'; id: string; file: OpenFile }
  | { type: 'CLOSE_FILE'; id: string; path: string }
  | { type: 'ACTIVE_FILE'; id: string; path: string }
  | { type: 'UPDATE_CONTENT'; id: string; path: string; content: string }
  | { type: 'MARK_SAVED'; id: string; path: string }

// Keep each session's isActive flag in sync with the single activeId.
function withActiveFlags(state: State): State {
  return {
    ...state,
    sessions: state.sessions.map((s) => ({ ...s, isActive: s.id === state.activeId }))
  }
}

function mapSession(
  state: State,
  id: string,
  fn: (s: SessionRuntime) => SessionRuntime
): State {
  return {
    ...state,
    sessions: state.sessions.map((s) => (s.id === id ? fn(s) : s))
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD': {
      const runtime: SessionRuntime = {
        ...action.session,
        status: 'running',
        gen: 0,
        openFiles: [],
        activeFilePath: null
      }
      return withActiveFlags({
        sessions: [...state.sessions, runtime],
        activeId: runtime.id
      })
    }

    case 'SET_ACTIVE':
      return withActiveFlags({ ...state, activeId: action.id })

    case 'REMOVE': {
      const remaining = state.sessions.filter((s) => s.id !== action.id)
      let activeId = state.activeId
      if (activeId === action.id) {
        activeId = remaining.length ? remaining[remaining.length - 1].id : null
      }
      return withActiveFlags({ sessions: remaining, activeId })
    }

    case 'SET_STATUS':
      return mapSession(state, action.id, (s) => ({
        ...s,
        status: action.status,
        exitCode: action.exitCode
      }))

    case 'RESTART':
      return mapSession(state, action.id, (s) => ({
        ...s,
        status: 'running',
        exitCode: undefined,
        gen: s.gen + 1
      }))

    case 'RENAME':
      return mapSession(state, action.id, (s) => ({ ...s, title: action.title }))

    case 'SET_CWD':
      return mapSession(state, action.id, (s) => ({
        ...s,
        cwd: action.cwd,
        title: action.title
      }))

    case 'OPEN_FILE':
      return mapSession(state, action.id, (s) => {
        const existing = s.openFiles.find((f) => f.path === action.file.path)
        if (existing) {
          if (action.file.readOnly) {
            return {
              ...s,
              openFiles: s.openFiles.map((f) =>
                f.path === action.file.path ? action.file : f
              ),
              activeFilePath: action.file.path
            }
          }
          return { ...s, activeFilePath: existing.path }
        }
        return {
          ...s,
          openFiles: [...s.openFiles, action.file],
          activeFilePath: action.file.path
        }
      })

    case 'CLOSE_FILE':
      return mapSession(state, action.id, (s) => {
        const openFiles = s.openFiles.filter((f) => f.path !== action.path)
        let activeFilePath = s.activeFilePath
        if (activeFilePath === action.path) {
          activeFilePath = openFiles.length ? openFiles[openFiles.length - 1].path : null
        }
        return { ...s, openFiles, activeFilePath }
      })

    case 'ACTIVE_FILE':
      return mapSession(state, action.id, (s) => ({ ...s, activeFilePath: action.path }))

    case 'UPDATE_CONTENT':
      return mapSession(state, action.id, (s) => ({
        ...s,
        openFiles: s.openFiles.map((f) =>
          f.path === action.path ? { ...f, content: action.content } : f
        )
      }))

    case 'MARK_SAVED':
      return mapSession(state, action.id, (s) => ({
        ...s,
        openFiles: s.openFiles.map((f) =>
          f.path === action.path ? { ...f, savedContent: f.content } : f
        )
      }))

    default:
      return state
  }
}

export function useSessions() {
  const [state, dispatch] = useReducer(reducer, { sessions: [], activeId: null })

  const activeSession = useMemo(
    () => state.sessions.find((s) => s.id === state.activeId) ?? null,
    [state.sessions, state.activeId]
  )

  const actions = useMemo(
    () => ({
      add: (session: TerminalSession) => dispatch({ type: 'ADD', session }),
      setActive: (id: string) => dispatch({ type: 'SET_ACTIVE', id }),
      remove: (id: string) => dispatch({ type: 'REMOVE', id }),
      setStatus: (id: string, status: TerminalStatus, exitCode?: number) =>
        dispatch({ type: 'SET_STATUS', id, status, exitCode }),
      restart: (id: string) => dispatch({ type: 'RESTART', id }),
      rename: (id: string, title: string) => dispatch({ type: 'RENAME', id, title }),
      setCwd: (id: string, cwd: string, title: string) =>
        dispatch({ type: 'SET_CWD', id, cwd, title }),
      openFile: (id: string, file: OpenFile) => dispatch({ type: 'OPEN_FILE', id, file }),
      closeFile: (id: string, path: string) => dispatch({ type: 'CLOSE_FILE', id, path }),
      setActiveFile: (id: string, path: string) =>
        dispatch({ type: 'ACTIVE_FILE', id, path }),
      updateContent: (id: string, path: string, content: string) =>
        dispatch({ type: 'UPDATE_CONTENT', id, path, content }),
      markSaved: (id: string, path: string) => dispatch({ type: 'MARK_SAVED', id, path })
    }),
    []
  )

  return { sessions: state.sessions, activeId: state.activeId, activeSession, actions }
}
