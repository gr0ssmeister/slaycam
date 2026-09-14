export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error' | 'unsupported'

export interface UpdateState {
  phase: UpdatePhase
  currentVersion: string
  version?: string
  releaseName?: string
  notes?: string
  automatic?: boolean
  percent?: number
  transferred?: number
  total?: number
  message?: string
  demo?: boolean
}

export const INITIAL_UPDATE_STATE: UpdateState = {
  phase: 'idle',
  currentVersion: '',
}
