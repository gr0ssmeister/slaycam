import type { MediaAsset, SlayCamConfig } from './types'
import type { UpdateState } from './update'

declare global {
  interface ImportMetaEnv {
    readonly DEV: boolean
    readonly BASE_URL: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }

  interface Window {
    slaycam: {
      loadConfig(): Promise<SlayCamConfig | null>
      saveConfig(config: SlayCamConfig): Promise<boolean>
      importMedia(): Promise<MediaAsset[]>
      removeMedia(storedName: string): Promise<boolean>
      openExternal(url: string): Promise<boolean>
      getUpdateState(): Promise<UpdateState>
      checkForUpdates(): Promise<UpdateState>
      downloadUpdate(): Promise<UpdateState>
      installUpdate(): Promise<boolean>
      getPlatform(): string
      minimizeWindow(): Promise<boolean>
      toggleMaximizeWindow(): Promise<boolean>
      isWindowMaximized(): Promise<boolean>
      closeWindow(): Promise<boolean>
      onWindowMaximized(handler: (maximized: boolean) => void): () => void
      onUpdateState(handler: (state: UpdateState) => void): () => void
    }
  }
}

export {}
