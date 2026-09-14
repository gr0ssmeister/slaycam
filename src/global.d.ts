import type { MediaAsset, SlayCamConfig } from './types'

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
      getPlatform(): string
      onOutputFrame(handler: (frame: string) => void): () => void
      onOutputState(handler: (isOpen: boolean) => void): () => void
    }
  }
}

export {}
