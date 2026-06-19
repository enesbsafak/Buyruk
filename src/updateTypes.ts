export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdateStatus {
  state: UpdateState
  message: string
  version?: string
  percent?: number
  bytesPerSecond?: number
  error?: string
}

export const INITIAL_UPDATE_STATUS: AppUpdateStatus = {
  state: 'idle',
  message: 'Güncelleme denetlenmedi'
}
