import { app, type IpcMain } from 'electron'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { IPC } from './ipcChannels'

type AiLimitTool = 'codex' | 'claude'
type AiLimitStatus = 'loading' | 'ready' | 'unavailable' | 'error'

interface AiLimitWindow {
  id: string
  label: string
  usedPercent: number
  remainingPercent: number
  windowDurationMins: number | null
  resetsAt: number | null
}

interface AiToolLimit {
  tool: AiLimitTool
  label: string
  status: AiLimitStatus
  detail: string
  windows: AiLimitWindow[]
  updatedAt: number | null
  planType?: string | null
}

interface AiLimitsOverview {
  tools: AiToolLimit[]
  lastUpdated: number
}

interface AiLimitsRequest {
  codexCommand?: string
}

interface RateLimitWindow {
  usedPercent?: number
  windowDurationMins?: number | null
  resetsAt?: number | null
}

interface RateLimitSnapshot {
  limitId?: string | null
  limitName?: string | null
  primary?: RateLimitWindow | null
  secondary?: RateLimitWindow | null
  planType?: string | null
  rateLimitReachedType?: string | null
}

interface CodexRateLimitsResponse {
  rateLimits?: RateLimitSnapshot | null
  rateLimitsByLimitId?: Record<string, RateLimitSnapshot | undefined> | null
}

const LIMIT_DIR = 'ai-limits'
const CLAUDE_SNAPSHOT = 'claude-statusline.json'
const CLAUDE_STATUSLINE = 'claude-statusline.ps1'
const CLAUDE_SETTINGS = 'claude-statusline-settings.json'

function limitDir(): string {
  return path.join(app.getPath('userData'), LIMIT_DIR)
}

function writeIfChanged(filePath: string, content: string): void {
  if (existsSync(filePath)) {
    try {
      if (readFileSync(filePath, 'utf8') === content) return
    } catch {
      // rewrite unreadable helper files
    }
  }
  writeFileSync(filePath, content, 'utf8')
}

function psSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function ensureClaudeLimitBridge(): { settingsPath: string; snapshotPath: string } {
  const dir = limitDir()
  mkdirSync(dir, { recursive: true })

  const snapshotPath = path.join(dir, CLAUDE_SNAPSHOT)
  const scriptPath = path.join(dir, CLAUDE_STATUSLINE)
  const settingsPath = path.join(dir, CLAUDE_SETTINGS)

  const script = [
    '$ErrorActionPreference = "SilentlyContinue"',
    '$raw = [Console]::In.ReadToEnd()',
    `$out = ${psSingleQuoted(snapshotPath)}`,
    '$parent = Split-Path -Parent $out',
    'if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }',
    'Set-Content -LiteralPath $out -Value $raw -Encoding UTF8',
    'try {',
    '  $data = $raw | ConvertFrom-Json',
    '  $model = $data.model.display_name',
    '  if (-not $model) { $model = "Claude" }',
    '  $parts = @()',
    '  $five = $data.rate_limits.five_hour.used_percentage',
    '  if ($null -ne $five) { $parts += ("5h: {0:N0}%" -f [double]$five) }',
    '  $week = $data.rate_limits.seven_day.used_percentage',
    '  if ($null -ne $week) { $parts += ("7d: {0:N0}%" -f [double]$week) }',
    '  if ($parts.Count -gt 0) {',
    '    Write-Output ("[{0}] {1}" -f $model, ($parts -join " "))',
    '  } else {',
    '    Write-Output ("[{0}]" -f $model)',
    '  }',
    '} catch {',
    '  Write-Output "Claude"',
    '}',
    ''
  ].join('\r\n')

  const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`
  const settings = JSON.stringify(
    {
      statusLine: {
        type: 'command',
        command,
        refreshInterval: 5
      }
    },
    null,
    2
  )

  writeIfChanged(scriptPath, script)
  writeIfChanged(settingsPath, `${settings}\n`)

  return { settingsPath, snapshotPath }
}

export function withClaudeLimitBridge(command: string): string {
  if (command.toLowerCase().includes('--settings')) return command
  const { settingsPath } = ensureClaudeLimitBridge()
  return `${command} --settings "${settingsPath}"`
}

function emptyTool(
  tool: AiLimitTool,
  status: AiLimitStatus,
  detail: string
): AiToolLimit {
  return {
    tool,
    label: tool === 'codex' ? 'Codex' : 'Claude',
    status,
    detail,
    windows: [],
    updatedAt: null
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function windowLabel(prefix: string, windowDurationMins: number | null): string {
  if (!windowDurationMins) return prefix
  if (windowDurationMins % 1440 === 0) return `${prefix} / ${windowDurationMins / 1440}g`
  if (windowDurationMins % 60 === 0) return `${prefix} / ${windowDurationMins / 60}s`
  return `${prefix} / ${windowDurationMins}dk`
}

function toLimitWindow(
  id: string,
  label: string,
  source: RateLimitWindow | null | undefined
): AiLimitWindow | null {
  if (!source || typeof source.usedPercent !== 'number') return null
  const usedPercent = clampPercent(source.usedPercent)
  return {
    id,
    label,
    usedPercent,
    remainingPercent: clampPercent(100 - usedPercent),
    windowDurationMins: source.windowDurationMins ?? null,
    resetsAt: source.resetsAt ?? null
  }
}

function windowsFromCodexSnapshot(snapshot: RateLimitSnapshot): AiLimitWindow[] {
  const name = snapshot.limitName || snapshot.limitId || 'codex'
  const windows: AiLimitWindow[] = []
  const primary = toLimitWindow(
    `${name}:primary`,
    windowLabel(name, snapshot.primary?.windowDurationMins ?? null),
    snapshot.primary
  )
  if (primary) windows.push(primary)

  const secondary = toLimitWindow(
    `${name}:secondary`,
    windowLabel(`${name} ek`, snapshot.secondary?.windowDurationMins ?? null),
    snapshot.secondary
  )
  if (secondary) windows.push(secondary)
  return windows
}

function readJsonLineRpc(
  commandLine: string,
  request: unknown,
  timeoutMs = 8000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(commandLine, {
      shell: true,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    const rl = readline.createInterface({ input: child.stdout })
    const requestId = (request as { id?: unknown }).id
    let stderr = ''
    let settled = false

    const finish = (err: Error | null, value?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      rl.close()
      try {
        child.kill()
      } catch {
        // already exited
      }
      if (err) reject(err)
      else resolve(value)
    }

    const timer = setTimeout(() => {
      finish(new Error('Codex limit sorgusu zaman aşımına uğradı.'))
    }, timeoutMs)

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    child.on('error', (err) => finish(err))
    child.on('exit', (code) => {
      if (!settled && code !== 0) {
        finish(new Error((stderr || `Codex app-server ${code} koduyla kapandı.`).trim()))
      }
    })

    rl.on('line', (line) => {
      let message: { id?: unknown; result?: unknown; error?: { message?: string } }
      try {
        message = JSON.parse(line)
      } catch {
        return
      }
      if (message.id !== requestId) return
      if (message.error) {
        finish(new Error(message.error.message || 'Codex limit sorgusu başarısız.'))
      } else {
        finish(null, message.result)
      }
    })

    const initId = randomUUID()
    const initialize = {
      method: 'initialize',
      id: initId,
      params: {
        clientInfo: {
          name: 'buyruk',
          title: 'Buyruk',
          version: app.getVersion()
        },
        capabilities: null
      }
    }

    child.stdin.write(`${JSON.stringify(initialize)}\n`)
    child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`)
    child.stdin.write(`${JSON.stringify(request)}\n`)
  })
}

async function readCodexLimits(codexCommand: string | undefined): Promise<AiToolLimit> {
  const command = (codexCommand || 'codex').trim() || 'codex'
  try {
    const result = (await readJsonLineRpc(`${command} app-server`, {
      method: 'account/rateLimits/read',
      id: randomUUID()
    })) as CodexRateLimitsResponse

    const snapshots = result.rateLimitsByLimitId
      ? Object.values(result.rateLimitsByLimitId).filter(Boolean)
      : result.rateLimits
        ? [result.rateLimits]
        : []

    const windows = snapshots.flatMap((snapshot) =>
      windowsFromCodexSnapshot(snapshot as RateLimitSnapshot)
    )

    if (windows.length === 0) {
      return emptyTool(
        'codex',
        'unavailable',
        'Codex ChatGPT limit bilgisi dönmedi; API key modunda kullanım bazlı olabilir.'
      )
    }

    return {
      tool: 'codex',
      label: 'Codex',
      status: 'ready',
      detail: 'ChatGPT Codex limitleri',
      windows,
      updatedAt: Date.now(),
      planType: snapshots.find((item) => item?.planType)?.planType ?? null
    }
  } catch (err) {
    return emptyTool(
      'codex',
      'error',
      err instanceof Error ? err.message : String(err)
    )
  }
}

function toClaudeWindow(
  id: string,
  label: string,
  source: { used_percentage?: number; resets_at?: number } | undefined
): AiLimitWindow | null {
  if (!source || typeof source.used_percentage !== 'number') return null
  const usedPercent = clampPercent(source.used_percentage)
  return {
    id,
    label,
    usedPercent,
    remainingPercent: clampPercent(100 - usedPercent),
    windowDurationMins: id === 'five_hour' ? 300 : id === 'seven_day' ? 10080 : null,
    resetsAt: source.resets_at ?? null
  }
}

function readClaudeLimits(): AiToolLimit {
  const { snapshotPath } = ensureClaudeLimitBridge()
  if (!existsSync(snapshotPath)) {
    return emptyTool(
      'claude',
      'unavailable',
      'Claude oturumundan limit verisi bekleniyor.'
    )
  }

  try {
    const stat = statSync(snapshotPath)
    const raw = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
      model?: { display_name?: string }
      rate_limits?: {
        five_hour?: { used_percentage?: number; resets_at?: number }
        seven_day?: { used_percentage?: number; resets_at?: number }
      }
    }
    const windows = [
      toClaudeWindow('five_hour', '5 saat', raw.rate_limits?.five_hour),
      toClaudeWindow('seven_day', '7 gün', raw.rate_limits?.seven_day)
    ].filter(Boolean) as AiLimitWindow[]

    if (windows.length === 0) {
      return emptyTool(
        'claude',
        'unavailable',
        'Claude rate_limits alanı henüz gelmedi; ilk Claude cevabından sonra görünür.'
      )
    }

    return {
      tool: 'claude',
      label: 'Claude',
      status: 'ready',
      detail: raw.model?.display_name || 'Claude.ai limitleri',
      windows,
      updatedAt: stat.mtimeMs
    }
  } catch (err) {
    return emptyTool(
      'claude',
      'error',
      err instanceof Error ? err.message : String(err)
    )
  }
}

export function registerAiLimitHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.AI_LIMITS_GET, async (_e, payload: AiLimitsRequest = {}) => {
    const [codex, claude] = await Promise.all([
      readCodexLimits(payload.codexCommand),
      Promise.resolve(readClaudeLimits())
    ])
    return {
      tools: [codex, claude],
      lastUpdated: Date.now()
    } satisfies AiLimitsOverview
  })
}
