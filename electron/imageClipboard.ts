import { app, clipboard, nativeImage, type BrowserWindow, type IpcMain } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { IPC } from './ipcChannels'
import { assertTrustedIpcSender } from './security'
import type { ClipboardImage } from '../src/types'

// Windows gives no clipboard-change event, so the image is polled. The interval
// is slow enough to be invisible on a CPU graph and fast enough that a
// screenshot shows up by the time you look at the panel.
const POLL_MS = 1500
const MAX_ITEMS = 60
const MAX_BYTES = 8 * 1024 * 1024
const THUMB_WIDTH = 220

let timer: NodeJS.Timeout | null = null
let lastHash = ''

function imagesDir(): string {
  return path.join(app.getPath('userData'), 'clipboard')
}

function metaPath(): string {
  return path.join(imagesDir(), 'index.json')
}

function readIndex(): ClipboardImage[] {
  try {
    const parsed = JSON.parse(readFileSync(metaPath(), 'utf8')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ClipboardImage => {
      const candidate = item as Partial<ClipboardImage>
      return typeof candidate.id === 'string' && typeof candidate.path === 'string'
    })
  } catch {
    return []
  }
}

function writeIndex(items: ClipboardImage[]): void {
  try {
    mkdirSync(imagesDir(), { recursive: true })
    writeFileSync(metaPath(), `${JSON.stringify(items, null, 2)}\n`, 'utf8')
  } catch {
    // a failed write only costs us the history, never the running app
  }
}

function removeFile(filePath: string): void {
  try {
    unlinkSync(filePath)
  } catch {
    // already gone
  }
}

// Keep the newest MAX_ITEMS and drop their files along with the entries.
function prune(items: ClipboardImage[]): ClipboardImage[] {
  const kept = items.slice(0, MAX_ITEMS)
  for (const dropped of items.slice(MAX_ITEMS)) removeFile(dropped.path)
  return kept
}

/** Removes index entries whose file vanished, and files with no entry. */
function reconcile(items: ClipboardImage[]): ClipboardImage[] {
  const alive = items.filter((item) => existsSync(item.path))
  const known = new Set(alive.map((item) => path.basename(item.path).toLowerCase()))
  try {
    for (const name of readdirSync(imagesDir())) {
      if (name === 'index.json') continue
      if (!known.has(name.toLowerCase())) removeFile(path.join(imagesDir(), name))
    }
  } catch {
    // directory may not exist yet
  }
  if (alive.length !== items.length) writeIndex(alive)
  return alive
}

function capture(win: BrowserWindow | null): void {
  const image = clipboard.readImage()
  if (image.isEmpty()) return

  const png = image.toPNG()
  if (png.length === 0 || png.length > MAX_BYTES) return

  const hash = createHash('sha1').update(png).digest('hex')
  if (hash === lastHash) return
  lastHash = hash

  const items = readIndex()
  if (items.some((item) => item.hash === hash && existsSync(item.path))) return

  const size = image.getSize()
  const filePath = path.join(imagesDir(), `${hash.slice(0, 16)}.png`)
  try {
    mkdirSync(imagesDir(), { recursive: true })
    writeFileSync(filePath, png)
  } catch {
    return
  }

  // A downscaled copy keeps the panel light even with 4K screenshots in history.
  const thumbnail = image.getSize().width > THUMB_WIDTH
    ? image.resize({ width: THUMB_WIDTH, quality: 'good' }).toDataURL()
    : image.toDataURL()

  const entry: ClipboardImage = {
    id: hash.slice(0, 16),
    hash,
    path: filePath,
    width: size.width,
    height: size.height,
    bytes: png.length,
    createdAt: Date.now(),
    thumbnail
  }

  const next = prune([entry, ...items.filter((item) => item.hash !== hash)])
  writeIndex(next)

  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send(IPC.CLIP_ADDED, entry)
  }
}

export function registerImageClipboardHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null
): void {
  const handle = (channel: string, listener: (...args: any[]) => unknown): void => {
    ipcMain.handle(channel, async (event, ...args) => {
      assertTrustedIpcSender(event)
      return listener(...args)
    })
  }

  handle(IPC.CLIP_LIST, (): ClipboardImage[] => reconcile(readIndex()))

  handle(IPC.CLIP_DELETE, (id: string): ClipboardImage[] => {
    const items = readIndex()
    const target = items.find((item) => item.id === id)
    if (target) removeFile(target.path)
    const next = items.filter((item) => item.id !== id)
    writeIndex(next)
    return next
  })

  handle(IPC.CLIP_CLEAR, (): ClipboardImage[] => {
    for (const item of readIndex()) removeFile(item.path)
    writeIndex([])
    return []
  })

  handle(IPC.CLIP_COPY_BACK, (id: string): void => {
    const target = readIndex().find((item) => item.id === id)
    if (!target || !existsSync(target.path)) throw new Error('Görsel bulunamadı')
    const image = nativeImage.createFromPath(target.path)
    if (image.isEmpty()) throw new Error('Görsel okunamadı')
    // Skip the next poll so copying back doesn't re-add the same image.
    lastHash = target.hash
    clipboard.writeImage(image)
  })

  // Seed the hash from whatever is already on the clipboard so launching the app
  // doesn't import an image the user copied hours ago.
  const existing = clipboard.readImage()
  if (!existing.isEmpty()) {
    try {
      lastHash = createHash('sha1').update(existing.toPNG()).digest('hex')
    } catch {
      lastHash = ''
    }
  }

  timer = setInterval(() => capture(getWindow()), POLL_MS)
}

export function stopImageClipboardWatch(): void {
  if (timer) clearInterval(timer)
  timer = null
}
