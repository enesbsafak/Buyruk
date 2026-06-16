import { app, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type IpcEvent = IpcMainEvent | IpcMainInvokeEvent

const SECURITY_DIR = 'security'
const WORKSPACES_FILE = 'allowed-workspaces.json'

let allowedRootsCache: string[] | null = null

function securityDir(): string {
  return path.join(app.getPath('userData'), SECURITY_DIR)
}

function workspaceStorePath(): string {
  return path.join(securityDir(), WORKSPACES_FILE)
}

function normalizeInputPath(value: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} geçersiz`)
  }
  if (value.includes('\0')) {
    throw new Error(`${label} geçersiz`)
  }
  return path.resolve(value)
}

function canonicalExistingPath(value: string): string | null {
  try {
    return realpathSync.native(value)
  } catch {
    return null
  }
}

function nearestExistingParent(value: string): string | null {
  let current = value
  for (;;) {
    const real = canonicalExistingPath(current)
    if (real) return real
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function isPathInside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function loadAllowedRoots(): string[] {
  if (allowedRootsCache) return allowedRootsCache
  try {
    const raw = readFileSync(workspaceStorePath(), 'utf8')
    const parsed = JSON.parse(raw) as unknown
    allowedRootsCache = Array.isArray(parsed)
      ? parsed
          .flatMap((item) => (typeof item === 'string' ? [canonicalExistingPath(item)] : []))
          .filter((item): item is string => !!item)
      : []
  } catch {
    allowedRootsCache = []
  }
  return allowedRootsCache
}

function saveAllowedRoots(roots: string[]): void {
  allowedRootsCache = [...new Set(roots)]
  mkdirSync(securityDir(), { recursive: true })
  writeFileSync(workspaceStorePath(), `${JSON.stringify(allowedRootsCache, null, 2)}\n`, 'utf8')
}

export function rememberWorkspaceRoot(root: string): string {
  const resolved = normalizeInputPath(root, 'Çalışma klasörü')
  const stat = statSync(resolved)
  if (!stat.isDirectory()) throw new Error('Çalışma klasörü bir dizin olmalı')
  const real = realpathSync.native(resolved)
  saveAllowedRoots([...loadAllowedRoots(), real])
  return resolved
}

function containingAllowedRoot(target: string): string | null {
  return loadAllowedRoots().find((root) => isPathInside(root, target)) ?? null
}

export function assertWorkspaceRoot(root: string): string {
  const resolved = normalizeInputPath(root, 'Çalışma klasörü')
  const real = canonicalExistingPath(resolved)
  if (!real || !containingAllowedRoot(real)) {
    throw new Error('Bu çalışma klasörü uygulama tarafından yetkilendirilmemiş')
  }
  const stat = statSync(real)
  if (!stat.isDirectory()) throw new Error('Çalışma klasörü bir dizin olmalı')
  return resolved
}

export function assertAllowedPath(value: string, label = 'Yol'): string {
  const resolved = normalizeInputPath(value, label)
  const realTarget = canonicalExistingPath(resolved)
  const checkPath = realTarget ?? nearestExistingParent(resolved)
  if (!checkPath || !containingAllowedRoot(checkPath)) {
    throw new Error(`${label} yetkili çalışma klasörlerinin dışında`)
  }
  return resolved
}

export function assertSameAllowedRoot(first: string, second: string): void {
  const firstCheck = canonicalExistingPath(first) ?? nearestExistingParent(first)
  const secondCheck = canonicalExistingPath(second) ?? nearestExistingParent(second)
  const firstRoot = firstCheck ? containingAllowedRoot(firstCheck) : null
  const secondRoot = secondCheck ? containingAllowedRoot(secondCheck) : null
  if (!firstRoot || !secondRoot || firstRoot !== secondRoot) {
    throw new Error('İşlem aynı yetkili çalışma klasörü içinde kalmalı')
  }
}

export function assertNotWorkspaceRoot(value: string, label = 'Yol'): void {
  const real = canonicalExistingPath(value)
  if (real && loadAllowedRoots().some((root) => root === real)) {
    throw new Error(`${label} çalışma klasörünün kökü olamaz`)
  }
}

function isLocalDevServer(url: URL): boolean {
  if (url.protocol !== 'http:') return false
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false
  const configured = process.env.VITE_DEV_SERVER_URL
  if (!configured) return false
  try {
    return url.origin === new URL(configured).origin
  } catch {
    return false
  }
}

function isBundledAppFile(url: URL): boolean {
  if (url.protocol !== 'file:') return false
  try {
    const target = fileURLToPath(url)
    const distRoot = path.resolve(__dirname, '../dist')
    return isPathInside(distRoot, target)
  } catch {
    return false
  }
}

export function isTrustedAppUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    if (!app.isPackaged && isLocalDevServer(url)) return true
    return isBundledAppFile(url)
  } catch {
    return false
  }
}

export function isSafeDevServerUrl(rawUrl: string | undefined): rawUrl is string {
  if (!rawUrl) return false
  try {
    return isLocalDevServer(new URL(rawUrl))
  } catch {
    return false
  }
}

export function assertTrustedIpcSender(event: IpcEvent): void {
  const senderUrl = event.senderFrame?.url || event.sender.getURL()
  if (!isTrustedAppUrl(senderUrl)) {
    throw new Error('Güvenilmeyen renderer isteği reddedildi')
  }
}

export function assertSafeImagePreview(filePath: string, maxBytes: number): void {
  const stat = statSync(filePath)
  if (!stat.isFile()) throw new Error('Önizleme için dosya bekleniyor')
  if (stat.size > maxBytes) {
    throw new Error(`Görsel önizleme limiti aşıldı (${Math.round(maxBytes / 1024 / 1024)} MB)`)
  }
}

export function pathExists(value: string): boolean {
  return existsSync(value)
}
