import type { MediaAsset, SlayCamConfig } from './types'
import type { UpdateState } from './update'

declare global {
  interface Window {
    slaycam: {
      loadConfig(): Promise<SlayCamConfig | null>
      saveConfig(config: SlayCamConfig): Promise<boolean>
      importMedia(): Promise<MediaAsset[]>
      removeMedia(storedName: string): Promise<boolean>
      openOutput(): Promise<boolean>
      closeOutput(): Promise<boolean>
      sendOutputFrame(dataUrl: string): void
      openExternal(url: string): Promise<boolean>
      getUpdateState(): Promise<UpdateState>
      checkForUpdates(): Promise<UpdateState>
      downloadUpdate(): Promise<UpdateState>
      installUpdate(): Promise<boolean>
      getPlatform(): string
      onOutputFrame(handler: (frame: string) => void): () => void
      onOutputState(handler: (isOpen: boolean) => void): () => void
      onUpdateState(handler: (state: UpdateState) => void): () => void
    }
  }
}

export {}
