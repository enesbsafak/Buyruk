import { app, type IpcMain, type IpcMainInvokeEvent } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { IPC } from './ipcChannels'
import { assertTrustedIpcSender } from './security'
import type {
  AiLimitMetric,
  AiLimitWindow,
  AiLimitsOverview,
  AiLimitsRequest,
  AiToolLimit
} from '../src/types'

type AuthSourceKind = 'global'

interface AuthSource<T> {
  auth: T
  path: string
  kind: AuthSourceKind
}

interface CodexAuth {
  OPENAI_API_KEY?: string | null
  tokens?: {
    access_token?: string
    refresh_token?: string
    id_token?: string
    account_id?: string
  }
  last_refresh?: string
}

interface ClaudeAuthFile {
  claudeAiOauth?: {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    scopes?: string[]
    subscriptionType?: string
    rateLimitTier?: string
  }
}

interface HttpResult {
  status: number
  headers: Record<string, string>
  bodyText: string
}

interface CacheEntry {
  tool: AiToolLimit
  fetchedAt: number
}

const CODEX_REFRESH_URL = 'https://auth.openai.com/oauth/token'
const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage'
const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const CLAUDE_REFRESH_URL = 'https://platform.claude.com/v1/oauth/token'
const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const CLAUDE_SCOPES =
  'user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload'
const ACCESS_TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000
const CODEX_REFRESH_AGE_MS = 8 * 24 * 60 * 60 * 1000
const CODEX_CACHE_MS = 60 * 1000
const CLAUDE_CACHE_MS = 5 * 60 * 1000
const FORCE_REFRESH_FLOOR_MS = 15 * 1000
const HTTP_TIMEOUT_MS = 10 * 1000
const REFRESH_TIMEOUT_MS = 15 * 1000
const MAX_RESPONSE_BYTES = 256 * 1024

const cache = new Map<string, CacheEntry>()

function homePath(...parts: string[]): string {
  return path.join(app.getPath('home'), ...parts)
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null
  const raw = readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw) as T
  return parsed
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  )
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  try {
    renameSync(tmp, filePath)
  } catch (err) {
    try {
      unlinkSync(tmp)
    } catch {
      // Best-effort cleanup only.
    }
    throw err
  }
}

function findAuthSource<T>(
  candidates: { path: string; kind: AuthSourceKind }[],
  isUsable: (auth: T) => boolean
): AuthSource<T> | null {
  for (const candidate of candidates) {
    try {
      const auth = readJsonFile<T>(candidate.path)
      if (auth && isUsable(auth)) {
        return { auth, path: candidate.path, kind: candidate.kind }
      }
    } catch {
      // Try the next candidate; the caller returns a generic auth error if none work.
    }
  }
  return null
}

function codexAuthCandidates(): { path: string; kind: AuthSourceKind }[] {
  const candidates: { path: string; kind: AuthSourceKind }[] = []
  if (process.env.CODEX_HOME) {
    candidates.push({ path: path.join(process.env.CODEX_HOME, 'auth.json'), kind: 'global' })
  }
  candidates.push(
    { path: homePath('.config', 'codex', 'auth.json'), kind: 'global' },
    { path: homePath('.codex', 'auth.json'), kind: 'global' }
  )
  return candidates
}

function claudeAuthCandidates(): { path: string; kind: AuthSourceKind }[] {
  const candidates: { path: string; kind: AuthSourceKind }[] = []
  if (process.env.CLAUDE_CONFIG_DIR) {
    candidates.push({
      path: path.join(process.env.CLAUDE_CONFIG_DIR, '.credentials.json'),
      kind: 'global'
    })
  }
  candidates.push({ path: homePath('.claude', '.credentials.json'), kind: 'global' })
  return candidates
}

function hasCodexOAuth(auth: CodexAuth): boolean {
  return !!auth.tokens?.access_token
}

function hasClaudeOAuth(auth: ClaudeAuthFile): boolean {
  return !!auth.claudeAiOauth?.accessToken
}

function emptyTool(
  tool: 'codex' | 'claude',
  status: AiToolLimit['status'],
  detail: string,
  source?: Pick<AiToolLimit, 'source'>
): AiToolLimit {
  return {
    tool,
    label: tool === 'codex' ? 'Codex' : 'Claude',
    status,
    detail,
    windows: [],
    metrics: [],
    updatedAt: null,
    source: source?.source ?? 'none'
  }
}

function sourceFields(source: AuthSource<unknown>): Pick<AiToolLimit, 'source'> {
  return {
    source: source.kind
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function readNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function readPercent(value: unknown): number | null {
  const n = readNumber(value)
  return n === null ? null : clampPercent(n)
}

function unixSecondsToMs(value: unknown): number | null {
  const n = readNumber(value)
  return n === null ? null : n * 1000
}

function isoToMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function resetAtMs(nowMs: number, window: Record<string, unknown> | null): number | null {
  if (!window) return null
  const at = unixSecondsToMs(window.reset_at)
  if (at !== null) return at
  const after = readNumber(window.reset_after_seconds)
  if (after !== null) return nowMs + after * 1000
  return null
}

function limitWindowSeconds(window: Record<string, unknown> | null, fallbackMs: number): number {
  const seconds = window ? readNumber(window.limit_window_seconds) : null
  return seconds && seconds > 0 ? seconds * 1000 : fallbackMs
}

function progressWindow(
  id: string,
  label: string,
  used: number | null,
  resetsAt: number | null,
  periodDurationMs: number | null
): AiLimitWindow | null {
  if (used === null) return null
  return {
    id,
    label,
    usedPercent: used,
    remainingPercent: clampPercent(100 - used),
    periodDurationMs,
    resetsAt
  }
}

function parseJsonBody(bodyText: string): Record<string, unknown> {
  const parsed = JSON.parse(bodyText) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Kullanım yanıtı geçersiz.')
  }
  return parsed as Record<string, unknown>
}

async function readResponseText(response: Response): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_RESPONSE_BYTES) {
      try {
        await reader.cancel()
      } catch {
        // Ignore cancellation errors.
      }
      throw new Error('Kullanım yanıtı beklenenden büyük.')
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

async function httpRequest(
  url: string,
  init: RequestInit,
  timeoutMs = HTTP_TIMEOUT_MS
): Promise<HttpResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'manual',
      signal: controller.signal
    })
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
    return {
      status: response.status,
      headers,
      bodyText: await readResponseText(response)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Kullanım isteği zaman aşımına uğradı.')
    }
    throw new Error('Kullanım isteği başarısız oldu.')
  } finally {
    clearTimeout(timeout)
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split('.')[1]
    if (!segment) return null
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function codexNeedsRefresh(auth: CodexAuth, nowMs: number): boolean {
  const accessToken = auth.tokens?.access_token
  if (accessToken) {
    const exp = readNumber(decodeJwtPayload(accessToken)?.exp)
    if (exp !== null) return exp * 1000 <= nowMs + ACCESS_TOKEN_REFRESH_WINDOW_MS
  }

  if (!auth.last_refresh) return false
  const lastRefresh = Date.parse(auth.last_refresh)
  if (!Number.isFinite(lastRefresh)) return false
  return nowMs - lastRefresh > CODEX_REFRESH_AGE_MS
}

function authStatus(status: number): boolean {
  return status === 401 || status === 403
}

async function refreshCodexToken(source: AuthSource<CodexAuth>): Promise<string | null> {
  const refreshToken = source.auth.tokens?.refresh_token
  if (!refreshToken) return null

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CODEX_CLIENT_ID,
    refresh_token: refreshToken
  }).toString()
  const response = await httpRequest(
    CODEX_REFRESH_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    },
    REFRESH_TIMEOUT_MS
  )
  if (response.status < 200 || response.status >= 300) {
    throw new Error('Codex oturumu yenilenemedi. Codex ile tekrar giriş yap.')
  }

  const data = parseJsonBody(response.bodyText)
  const accessToken = typeof data.access_token === 'string' ? data.access_token : null
  if (!accessToken) throw new Error('Codex yenileme yanıtı geçersiz.')

  source.auth.tokens = {
    ...source.auth.tokens,
    access_token: accessToken,
    refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : source.auth.tokens?.refresh_token,
    id_token: typeof data.id_token === 'string' ? data.id_token : source.auth.tokens?.id_token
  }
  source.auth.last_refresh = new Date().toISOString()
  writeJsonAtomic(source.path, source.auth)
  return accessToken
}

async function fetchCodexUsage(accessToken: string, accountId?: string): Promise<HttpResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'User-Agent': `Buyruk/${app.getVersion()}`
  }
  if (accountId) headers['ChatGPT-Account-Id'] = accountId
  return httpRequest(CODEX_USAGE_URL, { method: 'GET', headers })
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function collectStringValues(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string' && value.trim()) {
    out.push(value.trim())
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, out))
    return out
  }
  const object = readObject(value)
  if (object) Object.values(object).forEach((item) => collectStringValues(item, out))
  return out
}

function firstMultiplier(values: string[]): string | null {
  for (const value of values) {
    const match = value.match(/(?:^|[_\s-])(\d+)x(?:$|[_\s-])/i) ?? value.match(/\b(\d+)x\b/i)
    if (match) return `${match[1]}x`
  }
  return null
}

function hasPlanToken(values: string[], token: string): boolean {
  const needle = token.toLowerCase()
  return values.some((value) => value.toLowerCase().split(/[^a-z0-9]+/).includes(needle))
}

function formatCodexPlan(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const value = raw.trim()
  const lower = value.toLowerCase()
  if (lower === 'prolite') return 'Pro 5x'
  if (lower === 'pro') return 'Pro 20x'
  if (lower === 'plus') return 'Plus'
  if (lower === 'team') return 'Team'
  if (lower === 'enterprise') return 'Enterprise'
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatClaudePlan(data: Record<string, unknown>, oauth: ClaudeAuthFile['claudeAiOauth']): string | null {
  const values = [
    ...collectStringValues(data).filter((value) => /claude|max|pro|team|enterprise|\d+x/i.test(value)),
    oauth?.subscriptionType,
    oauth?.rateLimitTier
  ].filter((value): value is string => typeof value === 'string' && !!value.trim())

  if (values.length === 0) return null

  let plan = 'Claude'
  if (hasPlanToken(values, 'max')) plan = 'Claude Max'
  else if (hasPlanToken(values, 'pro')) plan = 'Claude Pro'
  else if (hasPlanToken(values, 'team')) plan = 'Claude Team'
  else if (hasPlanToken(values, 'enterprise')) plan = 'Claude Enterprise'

  const multiplier = firstMultiplier(values)
  return multiplier ? `${plan} ${multiplier}` : plan
}

function parseCodexUsage(response: HttpResult, source: AuthSource<CodexAuth>): AiToolLimit {
  const data = parseJsonBody(response.bodyText)
  const nowMs = Date.now()
  const windows: AiLimitWindow[] = []
  const rateLimit = readObject(data.rate_limit)
  const primaryWindow = readObject(rateLimit?.primary_window)
  const secondaryWindow = readObject(rateLimit?.secondary_window)
  const primaryHeader = readPercent(response.headers['x-codex-primary-used-percent'])
  const secondaryHeader = readPercent(response.headers['x-codex-secondary-used-percent'])

  const primaryUsed = primaryHeader ?? readPercent(primaryWindow?.used_percent)
  const secondaryUsed = secondaryHeader ?? readPercent(secondaryWindow?.used_percent)
  const primary = progressWindow(
    'codex:session',
    'Oturum',
    primaryUsed,
    resetAtMs(nowMs, primaryWindow),
    limitWindowSeconds(primaryWindow, 5 * 60 * 60 * 1000)
  )
  const secondary = progressWindow(
    'codex:weekly',
    'Haftalık',
    secondaryUsed,
    resetAtMs(nowMs, secondaryWindow),
    limitWindowSeconds(secondaryWindow, 7 * 24 * 60 * 60 * 1000)
  )
  if (primary) windows.push(primary)
  if (secondary) windows.push(secondary)

  const additional = Array.isArray(data.additional_rate_limits) ? data.additional_rate_limits : []
  for (let index = 0; index < additional.length; index += 1) {
    const entry = readObject(additional[index])
    const rl = readObject(entry?.rate_limit)
    if (!rl) continue
    const rawName = typeof entry?.limit_name === 'string' ? entry.limit_name : `Model ${index + 1}`
    const label = rawName.replace(/^GPT-[\d.]+-Codex-/, '') || rawName
    const entryPrimary = readObject(rl.primary_window)
    const entrySecondary = readObject(rl.secondary_window)
    const modelPrimary = progressWindow(
      `codex:${rawName}:primary`,
      label,
      readPercent(entryPrimary?.used_percent),
      resetAtMs(nowMs, entryPrimary),
      limitWindowSeconds(entryPrimary, 5 * 60 * 60 * 1000)
    )
    const modelSecondary = progressWindow(
      `codex:${rawName}:secondary`,
      `${label} haftalık`,
      readPercent(entrySecondary?.used_percent),
      resetAtMs(nowMs, entrySecondary),
      limitWindowSeconds(entrySecondary, 7 * 24 * 60 * 60 * 1000)
    )
    if (modelPrimary) windows.push(modelPrimary)
    if (modelSecondary) windows.push(modelSecondary)
  }

  const reviewWindow = readObject(readObject(data.code_review_rate_limit)?.primary_window)
  const review = progressWindow(
    'codex:reviews',
    'Kod inceleme',
    readPercent(reviewWindow?.used_percent),
    resetAtMs(nowMs, reviewWindow),
    limitWindowSeconds(reviewWindow, 7 * 24 * 60 * 60 * 1000)
  )
  if (review) windows.push(review)

  const metrics: AiLimitMetric[] = []
  const resetCredits = readNumber(readObject(data.rate_limit_reset_credits)?.available_count)
  if (resetCredits !== null && resetCredits >= 0) {
    metrics.push({ label: 'Limit sıfırlama', value: `${Math.floor(resetCredits)} hak` })
  }

  const credits = readObject(data.credits)
  const creditBalance = readNumber(credits?.balance ?? response.headers['x-codex-credits-balance'])
  if (creditBalance !== null) {
    const wholeCredits = Math.max(0, Math.floor(creditBalance))
    metrics.push({ label: 'Kredi', value: `$${(wholeCredits * 0.04).toFixed(2)} / ${wholeCredits}` })
  }

  if (windows.length === 0) {
    return emptyTool(
      'codex',
      'unavailable',
      'Codex usage API limit penceresi döndürmedi.',
      sourceFields(source)
    )
  }

  return {
    tool: 'codex',
    label: 'Codex',
    status: 'ready',
    detail: 'ChatGPT Codex canlı kota',
    windows,
    metrics,
    updatedAt: Date.now(),
    planType: formatCodexPlan(data.plan_type),
    ...sourceFields(source)
  }
}

function claudeNeedsRefresh(auth: ClaudeAuthFile, nowMs: number): boolean {
  const expiresAt = readNumber(auth.claudeAiOauth?.expiresAt)
  if (expiresAt === null) return false
  return expiresAt <= nowMs + ACCESS_TOKEN_REFRESH_WINDOW_MS
}

async function refreshClaudeToken(source: AuthSource<ClaudeAuthFile>): Promise<string | null> {
  const oauth = source.auth.claudeAiOauth
  const refreshToken = oauth?.refreshToken
  if (!oauth || !refreshToken) return null

  const response = await httpRequest(
    CLAUDE_REFRESH_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLAUDE_CLIENT_ID,
        scope: CLAUDE_SCOPES
      })
    },
    REFRESH_TIMEOUT_MS
  )
  if (response.status < 200 || response.status >= 300) {
    throw new Error('Claude oturumu yenilenemedi. Claude ile tekrar giriş yap.')
  }

  const data = parseJsonBody(response.bodyText)
  const accessToken = typeof data.access_token === 'string' ? data.access_token : null
  if (!accessToken) throw new Error('Claude yenileme yanıtı geçersiz.')

  oauth.accessToken = accessToken
  if (typeof data.refresh_token === 'string') oauth.refreshToken = data.refresh_token
  const expiresIn = readNumber(data.expires_in)
  if (expiresIn !== null) oauth.expiresAt = Date.now() + expiresIn * 1000
  writeJsonAtomic(source.path, source.auth)
  return accessToken
}

async function fetchClaudeUsage(accessToken: string): Promise<HttpResult> {
  return httpRequest(CLAUDE_USAGE_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'anthropic-beta': 'oauth-2025-04-20',
      'User-Agent': 'claude-code/2.1.69'
    }
  })
}

function parseClaudeUsage(response: HttpResult, source: AuthSource<ClaudeAuthFile>): AiToolLimit {
  const data = parseJsonBody(response.bodyText)
  const windows = [
    progressWindow(
      'claude:five_hour',
      'Oturum',
      readPercent(readObject(data.five_hour)?.utilization),
      isoToMs(readObject(data.five_hour)?.resets_at),
      5 * 60 * 60 * 1000
    ),
    progressWindow(
      'claude:seven_day',
      'Haftalık',
      readPercent(readObject(data.seven_day)?.utilization),
      isoToMs(readObject(data.seven_day)?.resets_at),
      7 * 24 * 60 * 60 * 1000
    ),
    progressWindow(
      'claude:sonnet',
      'Sonnet',
      readPercent(readObject(data.seven_day_sonnet)?.utilization),
      isoToMs(readObject(data.seven_day_sonnet)?.resets_at),
      7 * 24 * 60 * 60 * 1000
    ),
    progressWindow(
      'claude:opus',
      'Opus',
      readPercent(readObject(data.seven_day_opus)?.utilization),
      isoToMs(readObject(data.seven_day_opus)?.resets_at),
      7 * 24 * 60 * 60 * 1000
    ),
    progressWindow(
      'claude:design',
      'Claude Design',
      readPercent(readObject(data.seven_day_omelette)?.utilization),
      isoToMs(readObject(data.seven_day_omelette)?.resets_at),
      7 * 24 * 60 * 60 * 1000
    )
  ].filter(Boolean) as AiLimitWindow[]

  const metrics: AiLimitMetric[] = []
  const extraUsage = readObject(data.extra_usage)
  if (extraUsage?.is_enabled) {
    const used = readNumber(extraUsage.used_credits)
    const limit = readNumber(extraUsage.monthly_limit)
    if (used !== null && limit !== null && limit > 0) {
      metrics.push({ label: 'Ek kullanım', value: `$${(used / 100).toFixed(2)} / $${(limit / 100).toFixed(2)}` })
    } else if (used !== null && used > 0) {
      metrics.push({ label: 'Ek kullanım', value: `$${(used / 100).toFixed(2)}` })
    }
  }

  const oauth = source.auth.claudeAiOauth
  const planType = formatClaudePlan(data, oauth)

  if (windows.length === 0) {
    return emptyTool(
      'claude',
      'unavailable',
      'Claude usage API limit penceresi döndürmedi.',
      sourceFields(source)
    )
  }

  return {
    tool: 'claude',
    label: 'Claude',
    status: 'ready',
    detail: 'Claude Code canlı kota',
    windows,
    metrics,
    updatedAt: Date.now(),
    planType,
    ...sourceFields(source)
  }
}

async function readCodexLimits(): Promise<AiToolLimit> {
  const source = findAuthSource<CodexAuth>(codexAuthCandidates(), hasCodexOAuth)
  if (!source) {
    const apiKeySource = findAuthSource<CodexAuth>(
      codexAuthCandidates(),
      (auth) => typeof auth.OPENAI_API_KEY === 'string' && auth.OPENAI_API_KEY.length > 0
    )
    if (apiKeySource) {
      return emptyTool(
        'codex',
        'unavailable',
        'API key auth ile ChatGPT/Codex kota okunamaz; OAuth oturumu gerekli.',
        sourceFields(apiKeySource)
      )
    }
    return emptyTool('codex', 'unavailable', 'Codex OAuth oturumu bulunamadı.')
  }

  const sourceMeta = sourceFields(source)
  const accessToken = source.auth.tokens?.access_token
  if (!accessToken) return emptyTool('codex', 'unavailable', 'Codex access token bulunamadı.', sourceMeta)

  try {
    let token = accessToken
    if (codexNeedsRefresh(source.auth, Date.now())) {
      token = (await refreshCodexToken(source)) ?? token
    }

    let response = await fetchCodexUsage(token, source.auth.tokens?.account_id)
    if (authStatus(response.status)) {
      const refreshed = await refreshCodexToken(source)
      if (refreshed) response = await fetchCodexUsage(refreshed, source.auth.tokens?.account_id)
    }
    if (authStatus(response.status)) {
      return emptyTool('codex', 'error', 'Codex oturumu süresi dolmuş. Codex ile tekrar giriş yap.', sourceMeta)
    }
    if (response.status < 200 || response.status >= 300) {
      return emptyTool('codex', 'error', `Codex usage isteği HTTP ${response.status} döndü.`, sourceMeta)
    }
    return parseCodexUsage(response, source)
  } catch (err) {
    return emptyTool('codex', 'error', err instanceof Error ? err.message : String(err), sourceMeta)
  }
}

async function readClaudeLimits(): Promise<AiToolLimit> {
  const source = findAuthSource<ClaudeAuthFile>(claudeAuthCandidates(), hasClaudeOAuth)
  if (!source) return emptyTool('claude', 'unavailable', 'Claude OAuth oturumu bulunamadı.')

  const sourceMeta = sourceFields(source)
  const accessToken = source.auth.claudeAiOauth?.accessToken
  if (!accessToken) return emptyTool('claude', 'unavailable', 'Claude access token bulunamadı.', sourceMeta)

  try {
    let token = accessToken
    if (claudeNeedsRefresh(source.auth, Date.now())) {
      token = (await refreshClaudeToken(source)) ?? token
    }

    let response = await fetchClaudeUsage(token)
    if (authStatus(response.status)) {
      const refreshed = await refreshClaudeToken(source)
      if (refreshed) response = await fetchClaudeUsage(refreshed)
    }
    if (authStatus(response.status)) {
      return emptyTool('claude', 'error', 'Claude oturumu süresi dolmuş. Claude ile tekrar giriş yap.', sourceMeta)
    }
    if (response.status === 429) {
      return emptyTool('claude', 'unavailable', 'Claude usage API geçici olarak rate limit uyguladı.', sourceMeta)
    }
    if (response.status < 200 || response.status >= 300) {
      return emptyTool('claude', 'error', `Claude usage isteği HTTP ${response.status} döndü.`, sourceMeta)
    }
    return parseClaudeUsage(response, source)
  } catch (err) {
    return emptyTool('claude', 'error', err instanceof Error ? err.message : String(err), sourceMeta)
  }
}

async function cachedTool(
  key: string,
  ttlMs: number,
  force: boolean,
  loader: () => Promise<AiToolLimit>
): Promise<AiToolLimit> {
  const now = Date.now()
  const existing = cache.get(key)
  const canForce = !existing || now - existing.fetchedAt >= FORCE_REFRESH_FLOOR_MS
  if (existing && (!force || !canForce) && now - existing.fetchedAt < ttlMs) {
    return existing.tool
  }
  const tool = await loader()
  cache.set(key, { tool, fetchedAt: Date.now() })
  return tool
}

function cleanRequest(value: unknown): AiLimitsRequest {
  const input = readObject(value) ?? {}
  return {
    force: input.force === true
  }
}

export function registerAiLimitHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.AI_LIMITS_GET, async (event: IpcMainInvokeEvent, request: unknown) => {
    assertTrustedIpcSender(event)
    const payload = cleanRequest(request)
    const [codex, claude] = await Promise.all([
      cachedTool('codex:global', CODEX_CACHE_MS, !!payload.force, () => readCodexLimits()),
      cachedTool('claude:global', CLAUDE_CACHE_MS, !!payload.force, () => readClaudeLimits())
    ])
    return {
      tools: [codex, claude],
      lastUpdated: Date.now()
    } satisfies AiLimitsOverview
  })
}
