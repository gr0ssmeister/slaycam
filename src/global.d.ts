import type { MediaAsset, MediaImportKind, SlayCamConfig, VirtualCameraState } from './types'
import type { UpdateState } from './update'

declare global {
  class ImageDecoder {
    constructor(init: { data: BufferSource, type: string })
    readonly completed: Promise<void>
    readonly tracks: {
      readonly ready: Promise<void>
      readonly selectedTrack: { readonly animated: boolean, readonly frameCount: number } | null
    }
    decode(options?: { frameIndex?: number }): Promise<{ image: VideoFrame }>
    close(): void
  }

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
      importMedia(kind?: MediaImportKind): Promise<MediaAsset[]>
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
      getVirtualCameraState(): Promise<VirtualCameraState>
      installVirtualCamera(): Promise<VirtualCameraState>
      uninstallVirtualCamera(): Promise<VirtualCameraState>
      startVirtualCamera(width: number, height: number, fps: number): Promise<VirtualCameraState>
      stopVirtualCamera(): Promise<VirtualCameraState>
      sendVirtualCameraFrame(buffer: ArrayBuffer): void
      rendererMounted(): void
      rendererPainted(): void
      reportRendererError(details: string): void
      reportPerformance(details: string): void
      restartApp(): Promise<boolean>
      showStartupLog(): Promise<boolean>
      resetConfig(): Promise<boolean>
      onWindowMaximized(handler: (maximized: boolean) => void): () => void
      onUpdateState(handler: (state: UpdateState) => void): () => void
      onVirtualCameraState(handler: (state: VirtualCameraState) => void): () => void
    }
  }
}

export {}
