import { app, type BrowserWindow, type Rectangle } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

// Persist window size/position/maximized across launches.
const stateFile = path.join(app.getPath('userData'), 'window-state.json')

interface WindowState {
  bounds?: Rectangle
  maximized?: boolean
}

export function loadWindowState(): WindowState {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as WindowState
  } catch {
    return {}
  }
}

function save(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  try {
    fs.writeFileSync(
      stateFile,
      JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() })
    )
  } catch {
    // best-effort
  }
}

// Debounce rapid resize/move events.
export function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => save(win), 400)
  }
  win.on('resize', schedule)
  win.on('move', schedule)
  win.on('maximize', schedule)
  win.on('unmaximize', schedule)
  win.on('close', () => save(win))
}
