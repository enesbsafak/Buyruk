import type { Settings, TerminalType } from './types'

export type AgentModelKind = 'built-in' | 'custom'
export type AgentTerminalType = Extract<TerminalType, 'claude' | 'codex' | 'opencode'> | 'custom'
export type ApprovalPolicy = 'one' | 'majority' | 'all'
export type ApplyMode = 'draft-only' | 'user-confirmed' | 'auto-after-approval'

export interface AgentModelConfig {
  id: string
  name: string
  kind: AgentModelKind
  terminalType: AgentTerminalType
  command: string
  enabled: boolean
}

export interface OrchestratorConfig {
  enabled: boolean
  models: AgentModelConfig[]
  orchestratorModelId: string
  writerModelId: string
  discussantModelIds: string[]
  approverModelIds: string[]
  approvalPolicy: ApprovalPolicy
  applyMode: ApplyMode
  discussionRounds: number
  fileLocking: boolean
  runChecks: boolean
}

const BUILT_IN_MODEL_IDS = ['claude', 'codex', 'opencode']
const APPROVAL_POLICIES: ApprovalPolicy[] = ['one', 'majority', 'all']
const APPLY_MODES: ApplyMode[] = ['draft-only', 'user-confirmed', 'auto-after-approval']

export function createDefaultOrchestratorConfig(settings: Settings): OrchestratorConfig {
  const models: AgentModelConfig[] = [
    {
      id: 'claude',
      name: 'Claude',
      kind: 'built-in',
      terminalType: 'claude',
      command: settings.claudeCommand,
      enabled: true
    },
    {
      id: 'codex',
      name: 'Codex',
      kind: 'built-in',
      terminalType: 'codex',
      command: settings.codexCommand,
      enabled: true
    },
    {
      id: 'opencode',
      name: 'OpenCode',
      kind: 'built-in',
      terminalType: 'opencode',
      command: settings.opencodeCommand,
      enabled: true
    }
  ]

  return {
    enabled: false,
    models,
    orchestratorModelId: 'claude',
    writerModelId: 'codex',
    discussantModelIds: ['claude'],
    approverModelIds: ['claude'],
    approvalPolicy: 'all',
    applyMode: 'user-confirmed',
    discussionRounds: 1,
    fileLocking: true,
    runChecks: true
  }
}

function clampRounds(value: unknown): number {
  const num = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isFinite(num)) return 1
  return Math.max(1, Math.min(5, Math.round(num)))
}

function uniqueIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string')))
}

function normalizeModel(model: Partial<AgentModelConfig>, fallback: AgentModelConfig): AgentModelConfig {
  const id = typeof model.id === 'string' && model.id.trim() ? model.id.trim() : fallback.id
  const kind: AgentModelKind = model.kind === 'custom' ? 'custom' : fallback.kind
  const fallbackTerminalType = kind === 'custom' ? 'custom' : fallback.terminalType
  const terminalType: AgentTerminalType =
    model.terminalType === 'claude' ||
    model.terminalType === 'codex' ||
    model.terminalType === 'opencode' ||
    model.terminalType === 'custom'
      ? model.terminalType
      : fallbackTerminalType

  return {
    id,
    name: typeof model.name === 'string' && model.name.trim() ? model.name.trim() : fallback.name,
    kind,
    terminalType,
    command:
      typeof model.command === 'string' && model.command.trim()
        ? model.command.trim()
        : fallback.command,
    enabled: typeof model.enabled === 'boolean' ? model.enabled : fallback.enabled
  }
}

export function normalizeOrchestratorConfig(
  input: Partial<OrchestratorConfig> | null | undefined,
  fallback: OrchestratorConfig
): OrchestratorConfig {
  const byId = new Map<string, AgentModelConfig>()

  for (const model of fallback.models) {
    byId.set(model.id, model)
  }

  const inputModels = Array.isArray(input?.models) ? input.models : []
  for (const rawModel of inputModels) {
    if (!rawModel || typeof rawModel !== 'object') continue
    const partial = rawModel as Partial<AgentModelConfig>
    const fallbackModel: AgentModelConfig =
      typeof partial.id === 'string' && byId.has(partial.id)
        ? byId.get(partial.id)!
        : {
            id: partial.id ?? 'custom',
            name: 'Özel Model',
            kind: 'custom',
            terminalType: 'custom',
            command: 'cmd.exe',
            enabled: true
          }
    const model = normalizeModel(partial, fallbackModel)
    byId.set(model.id, model)
  }

  const models = Array.from(byId.values()).sort((a, b) => {
    const aBuiltIn = BUILT_IN_MODEL_IDS.indexOf(a.id)
    const bBuiltIn = BUILT_IN_MODEL_IDS.indexOf(b.id)
    if (aBuiltIn !== -1 || bBuiltIn !== -1) {
      return (aBuiltIn === -1 ? 99 : aBuiltIn) - (bBuiltIn === -1 ? 99 : bBuiltIn)
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  const enabledIds: string[] = []
  const modelIds: string[] = []
  for (const model of models) {
    modelIds.push(model.id)
    if (model.enabled) enabledIds.push(model.id)
  }
  const selectableIds = enabledIds.length ? enabledIds : modelIds
  const fallbackOrchestrator = selectableIds.includes(fallback.orchestratorModelId)
    ? fallback.orchestratorModelId
    : selectableIds[0]
  const fallbackWriter = selectableIds.includes(fallback.writerModelId)
    ? fallback.writerModelId
    : selectableIds[0]

  const pickId = (value: unknown, fallbackId: string) =>
    typeof value === 'string' && selectableIds.includes(value) ? value : fallbackId

  const approvalPolicy = APPROVAL_POLICIES.includes(input?.approvalPolicy as ApprovalPolicy)
    ? (input!.approvalPolicy as ApprovalPolicy)
    : fallback.approvalPolicy
  const applyMode = APPLY_MODES.includes(input?.applyMode as ApplyMode)
    ? (input!.applyMode as ApplyMode)
    : fallback.applyMode

  return {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : fallback.enabled,
    models,
    orchestratorModelId: pickId(input?.orchestratorModelId, fallbackOrchestrator),
    writerModelId: pickId(input?.writerModelId, fallbackWriter),
    discussantModelIds: uniqueIds(input?.discussantModelIds).filter((id) => selectableIds.includes(id)),
    approverModelIds: uniqueIds(input?.approverModelIds).filter((id) => selectableIds.includes(id)),
    approvalPolicy,
    applyMode,
    discussionRounds: clampRounds(input?.discussionRounds ?? fallback.discussionRounds),
    fileLocking: typeof input?.fileLocking === 'boolean' ? input.fileLocking : fallback.fileLocking,
    runChecks: typeof input?.runChecks === 'boolean' ? input.runChecks : fallback.runChecks
  }
}

function modelNameById(config: OrchestratorConfig, id: string): string {
  return config.models.find((model) => model.id === id)?.name ?? id
}

export function describeOrchestratorConfig(config: OrchestratorConfig): string {
  if (!config.enabled) return 'AI orkestrasyon kapalı'

  const writer = modelNameById(config, config.writerModelId)
  const approvers = config.approverModelIds.map((id) => modelNameById(config, id))
  const approverText = approvers.length ? approvers.join(', ') : 'onaycı yok'

  return `${modelNameById(config, config.orchestratorModelId)} yönetir · ${approverText} onaylar · ${writer} yazar`
}

export function createCustomAgentModel(): AgentModelConfig {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name: 'Özel Model',
    kind: 'custom',
    terminalType: 'custom',
    command: 'cmd.exe',
    enabled: true
  }
}
