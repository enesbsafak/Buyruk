import { useEffect, useReducer, useRef } from 'react'
import {
  createCustomAgentModel,
  type AgentModelConfig,
  type AgentTerminalType,
  type ApprovalPolicy,
  type ApplyMode,
  type OrchestratorConfig
} from '../orchestrator'
import { Icon } from './Icon'

interface OrchestratorModalProps {
  open: boolean
  config: OrchestratorConfig
  onSave: (config: OrchestratorConfig) => void
  onReset: () => void
  onClose: () => void
}

type OrchestratorAction =
  | { type: 'set'; key: keyof OrchestratorConfig; value: OrchestratorConfig[keyof OrchestratorConfig] }
  | { type: 'update-model'; id: string; patch: Partial<AgentModelConfig> }
  | { type: 'add-model'; model: AgentModelConfig }
  | { type: 'remove-model'; id: string }
  | { type: 'toggle-list-id'; key: 'discussantModelIds' | 'approverModelIds'; id: string }

const APPROVAL_LABELS: Record<ApprovalPolicy, string> = {
  one: 'Bir onay yeterli',
  majority: 'Çoğunluk onayı',
  all: 'Tüm onaycılar'
}

const APPLY_LABELS: Record<ApplyMode, string> = {
  'draft-only': 'Sadece öneri',
  'user-confirmed': 'Kullanıcı onayıyla yaz',
  'auto-after-approval': 'Model onayından sonra yaz'
}

const TERMINAL_TYPE_LABELS: Record<AgentTerminalType, string> = {
  claude: 'Claude',
  codex: 'Codex',
  custom: 'Özel komut'
}

function cloneConfig(config: OrchestratorConfig): OrchestratorConfig {
  return {
    ...config,
    models: config.models.map((model) => ({ ...model })),
    discussantModelIds: [...config.discussantModelIds],
    approverModelIds: [...config.approverModelIds]
  }
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

function reducer(draft: OrchestratorConfig, action: OrchestratorAction): OrchestratorConfig {
  switch (action.type) {
    case 'set':
      return { ...draft, [action.key]: action.value }

    case 'update-model':
      return {
        ...draft,
        models: draft.models.map((model) =>
          model.id === action.id ? { ...model, ...action.patch } : model
        )
      }

    case 'add-model':
      return {
        ...draft,
        models: [...draft.models, action.model],
        discussantModelIds: [...draft.discussantModelIds, action.model.id]
      }

    case 'remove-model': {
      const models = draft.models.filter((model) => model.id !== action.id)
      const firstId = models[0]?.id ?? ''
      return {
        ...draft,
        models,
        orchestratorModelId:
          draft.orchestratorModelId === action.id ? firstId : draft.orchestratorModelId,
        writerModelId: draft.writerModelId === action.id ? firstId : draft.writerModelId,
        discussantModelIds: draft.discussantModelIds.filter((id) => id !== action.id),
        approverModelIds: draft.approverModelIds.filter((id) => id !== action.id)
      }
    }

    case 'toggle-list-id':
      return { ...draft, [action.key]: toggleId(draft[action.key], action.id) }
  }
}

function RoleChecklist({
  title,
  ids,
  models,
  onToggle
}: {
  title: string
  ids: string[]
  models: AgentModelConfig[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="orch-checklist">
      <div className="orch-field-label">{title}</div>
      <div className="orch-check-grid">
        {models.map((model) => (
          <label key={model.id} className="orch-check">
            <input
              type="checkbox"
              checked={ids.includes(model.id)}
              onChange={() => onToggle(model.id)}
            />
            <span>{model.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function OrchestratorModal({
  open,
  config,
  onSave,
  onReset,
  onClose
}: OrchestratorModalProps) {
  if (!open) return null

  return (
    <OrchestratorModalContent
      key={JSON.stringify(config)}
      config={config}
      onSave={onSave}
      onReset={onReset}
      onClose={onClose}
    />
  )
}

function OrchestratorModalContent({
  config,
  onSave,
  onReset,
  onClose
}: Omit<OrchestratorModalProps, 'open'>) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, dispatch] = useReducer(reducer, config, cloneConfig)
  const enabledModels = draft.models.filter((model) => model.enabled)
  const selectableModels = enabledModels.length ? enabledModels : draft.models

  const set = <K extends keyof OrchestratorConfig>(key: K, value: OrchestratorConfig[K]) =>
    dispatch({ type: 'set', key, value })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (!dialog.open) dialog.showModal()
    const handleCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      className="modal orchestrator-modal"
      aria-label="AI Orkestrasyon"
    >
        <div className="orch-head">
          <div>
            <h2 className="modal-title">AI Orkestrasyon</h2>
            <div className="orch-subtitle">Rol, onay ve yazma akışı</div>
          </div>
          <label className={`orch-switch ${draft.enabled ? 'is-on' : ''}`}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
            />
            <span>{draft.enabled ? 'Açık' : 'Kapalı'}</span>
          </label>
        </div>

        <div className="orch-layout">
          <section className="orch-section">
            <div className="orch-section-title">
              <Icon name="orchestrator" size={15} />
              Roller
            </div>

            <label className="field">
              <span className="field-label">Orchestrator</span>
              <select
                className="field-input"
                value={draft.orchestratorModelId}
                onChange={(e) => set('orchestratorModelId', e.target.value)}
              >
                {selectableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Yazıcı model</span>
              <select
                className="field-input"
                value={draft.writerModelId}
                onChange={(e) => set('writerModelId', e.target.value)}
              >
                {selectableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </label>

            <RoleChecklist
              title="Tartışmaya katılanlar"
              ids={draft.discussantModelIds}
              models={selectableModels}
              onToggle={(id) => dispatch({ type: 'toggle-list-id', key: 'discussantModelIds', id })}
            />

            <RoleChecklist
              title="Onaycılar"
              ids={draft.approverModelIds}
              models={selectableModels}
              onToggle={(id) => dispatch({ type: 'toggle-list-id', key: 'approverModelIds', id })}
            />
          </section>

          <section className="orch-section">
            <div className="orch-section-title">
              <Icon name="git-diff" size={15} />
              Akış
            </div>

            <label className="field">
              <span className="field-label">Tartışma turu</span>
              <input
                type="number"
                min={1}
                max={5}
                className="field-input"
                value={draft.discussionRounds}
                onChange={(e) =>
                  set('discussionRounds', Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)))
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Onay kuralı</span>
              <select
                className="field-input"
                value={draft.approvalPolicy}
                onChange={(e) => set('approvalPolicy', e.target.value as ApprovalPolicy)}
              >
                {Object.entries(APPROVAL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Yazma modu</span>
              <select
                className="field-input"
                value={draft.applyMode}
                onChange={(e) => set('applyMode', e.target.value as ApplyMode)}
              >
                {Object.entries(APPLY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="orch-check orch-toggle-line">
              <input
                type="checkbox"
                checked={draft.fileLocking}
                onChange={(e) => set('fileLocking', e.target.checked)}
              />
              <span>Dosya kilidi</span>
            </label>

            <label className="orch-check orch-toggle-line">
              <input
                type="checkbox"
                checked={draft.runChecks}
                onChange={(e) => set('runChecks', e.target.checked)}
              />
              <span>Test/typecheck kontrolü</span>
            </label>

            <div className="orch-preview" aria-label="Seçili akış">
              <span>{draft.discussionRounds} tur</span>
              <span>{APPROVAL_LABELS[draft.approvalPolicy]}</span>
              <span>{APPLY_LABELS[draft.applyMode]}</span>
            </div>
          </section>
        </div>

        <section className="orch-section orch-models">
          <div className="orch-section-title">
            <Icon name="terminal" size={15} />
            Modeller
          </div>

          <div className="orch-model-list">
            {draft.models.map((model) => (
              <div key={model.id} className={`orch-model-row ${model.enabled ? '' : 'is-disabled'}`}>
                <label className="orch-check model-enable">
                  <input
                    type="checkbox"
                    aria-label={`${model.name} aktif`}
                    checked={model.enabled}
                    onChange={(e) =>
                      dispatch({
                        type: 'update-model',
                        id: model.id,
                        patch: { enabled: e.target.checked }
                      })
                    }
                  />
                  <span>Aktif</span>
                </label>
                <input
                  className="field-input model-name"
                  aria-label={`${model.name} adı`}
                  value={model.name}
                  onChange={(e) =>
                    dispatch({
                      type: 'update-model',
                      id: model.id,
                      patch: { name: e.target.value }
                    })
                  }
                />
                <select
                  className="field-input model-kind"
                  aria-label={`${model.name} terminal türü`}
                  value={model.terminalType}
                  disabled={model.kind === 'built-in'}
                  onChange={(e) =>
                    dispatch({
                      type: 'update-model',
                      id: model.id,
                      patch: { terminalType: e.target.value as AgentTerminalType }
                    })
                  }
                >
                  {Object.entries(TERMINAL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  className="field-input model-command"
                  aria-label={`${model.name} komutu`}
                  value={model.command}
                  onChange={(e) =>
                    dispatch({
                      type: 'update-model',
                      id: model.id,
                      patch: { command: e.target.value }
                    })
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  title="Modeli kaldır"
                  aria-label={`${model.name} modelini kaldır`}
                  disabled={model.kind === 'built-in'}
                  onClick={() => dispatch({ type: 'remove-model', id: model.id })}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-ghost orch-add"
            onClick={() => dispatch({ type: 'add-model', model: createCustomAgentModel() })}
          >
            <Icon name="plus" size={14} />
            Model ekle
          </button>
        </section>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Varsayılana Dön
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            İptal
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)}>
            Kaydet
          </button>
        </div>
      </dialog>
  )
}
