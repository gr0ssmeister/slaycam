import React from 'react'
import ReactDOM from 'react-dom/client'
import type { ErrorInfo, ReactNode } from 'react'
import App from './App'
import type { UpdateState } from './update'
import type { VirtualCameraState } from './types'
import './styles.css'

document.addEventListener('dragstart', (event) => event.preventDefault())

class AppErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    window.slaycam.reportRendererError(`${error.stack || error.message}\n${info.componentStack || ''}`)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <StartupFailure />
  }
}

function StartupFailure({ bridgeMissing = false }: { bridgeMissing?: boolean }) {
  return (
    <main className="fatal-screen">
      <section className="fatal-panel">
        <img src={`${import.meta.env.BASE_URL}brand-icon.png`} alt="" />
        <h1>SlayCam не загрузился</h1>
        <p>{bridgeMissing ? 'Служебная часть приложения не подключилась.' : 'Интерфейс остановился при запуске. Настройки можно восстановить без удаления медиатеки.'}</p>
        {bridgeMissing ? <p className="fatal-hint">Закрой окно и открой SlayCam заново. Если это повторится, переустанови приложение.</p> : <div className="fatal-actions">
          <button type="button" className="button primary" onClick={() => void window.slaycam.restartApp()}>Перезапустить</button>
          <button type="button" className="button secondary" onClick={() => { if (window.confirm('Сбросить настройки SlayCam? Медиафайлы останутся на месте.')) void window.slaycam.resetConfig() }}>Сбросить настройки</button>
          <button type="button" className="button ghost" onClick={() => void window.slaycam.showStartupLog()}>Показать журнал</button>
        </div>}
      </section>
    </main>
  )
}

if (import.meta.env.DEV && !window.slaycam) {
  const updateListeners = new Set<(state: UpdateState) => void>()
  const virtualCameraListeners = new Set<(state: VirtualCameraState) => void>()
  const previewVirtualCamera: VirtualCameraState = { phase: 'unsupported', installed: false, streaming: false, message: 'Доступно в Windows-версии' }
  let updateTimer: number | undefined
  let previewUpdateState: UpdateState = {
    phase: 'available',
    currentVersion: '0.1.0',
    version: '0.1.1',
    releaseName: 'SlayCam 0.1.1',
    notes: 'GIF больше не зацикливаются от одного жеста, а движения ловятся точнее.',
    demo: true,
  }
  const emitUpdateState = (next: UpdateState) => {
    previewUpdateState = next
    updateListeners.forEach((listener) => listener(next))
    return next
  }
  const previewCheck = async () => {
    emitUpdateState({ ...previewUpdateState, phase: 'checking', demo: true })
    window.setTimeout(() => emitUpdateState({
      ...previewUpdateState,
      phase: 'available',
      currentVersion: '0.1.0',
      version: '0.1.1',
      notes: 'GIF больше не зацикливаются от одного жеста, а движения ловятся точнее.',
      demo: true,
    }), 900)
    return previewUpdateState
  }
  const previewDownload = async () => {
    if (updateTimer) window.clearInterval(updateTimer)
    const steps = [6, 14, 25, 39, 52, 68, 81, 92, 100]
    let step = 0
    emitUpdateState({ ...previewUpdateState, phase: 'downloading', percent: 0, automatic: false, demo: true })
    updateTimer = window.setInterval(() => {
      const percent = steps[step++]
      if (percent < 100) {
        emitUpdateState({ ...previewUpdateState, phase: 'downloading', percent, demo: true })
        return
      }
      window.clearInterval(updateTimer)
      updateTimer = undefined
      emitUpdateState({ ...previewUpdateState, phase: 'downloaded', percent: 100, demo: true })
    }, 650)
    return previewUpdateState
  }
  const previewInstall = async () => {
    if (previewUpdateState.phase !== 'downloaded') return false
    emitUpdateState({ phase: 'not-available', currentVersion: previewUpdateState.version ?? '0.1.1', demo: true })
    return true
  }

  window.slaycam = {
    loadConfig: async () => JSON.parse(localStorage.getItem('slaycam.preview') || 'null'),
    saveConfig: async (config) => { localStorage.setItem('slaycam.preview', JSON.stringify(config)); return true },
    importMedia: async () => [],
    removeMedia: async () => true,
    openExternal: async (url) => { window.open(url, '_blank', 'noopener'); return true },
    getUpdateState: async () => previewUpdateState,
    checkForUpdates: previewCheck,
    downloadUpdate: previewDownload,
    installUpdate: previewInstall,
    getPlatform: () => navigator.platform,
    minimizeWindow: async () => true,
    toggleMaximizeWindow: async () => false,
    isWindowMaximized: async () => false,
    closeWindow: async () => true,
    getVirtualCameraState: async () => previewVirtualCamera,
    installVirtualCamera: async () => previewVirtualCamera,
    uninstallVirtualCamera: async () => previewVirtualCamera,
    startVirtualCamera: async () => previewVirtualCamera,
    stopVirtualCamera: async () => previewVirtualCamera,
    sendVirtualCameraFrame: () => undefined,
    rendererMounted: () => undefined,
    rendererPainted: () => undefined,
    reportRendererError: (details) => console.error(details),
    reportPerformance: (details) => console.info(details),
    restartApp: async () => true,
    showStartupLog: async () => true,
    resetConfig: async () => { localStorage.removeItem('slaycam.preview'); window.location.reload(); return true },
    onWindowMaximized: () => () => undefined,
    onUpdateState: (handler) => {
      updateListeners.add(handler)
      return () => updateListeners.delete(handler)
    },
    onVirtualCameraState: (handler) => {
      virtualCameraListeners.add(handler)
      return () => virtualCameraListeners.delete(handler)
    },
  }
}

const bridgeReady = typeof window.slaycam !== 'undefined'
ReactDOM.createRoot(document.getElementById('root')!).render(
  bridgeReady ? (
    <React.StrictMode>
      <AppErrorBoundary><App /></AppErrorBoundary>
    </React.StrictMode>
  ) : <StartupFailure bridgeMissing />,
)

if (bridgeReady) {
  window.addEventListener('error', (event) => window.slaycam.reportRendererError(event.error?.stack || event.message))
  window.addEventListener('unhandledrejection', (event) => window.slaycam.reportRendererError(event.reason?.stack || String(event.reason)))
  // Two separate signals: the timer proves the bundle ran, the frame proves the window paints.
  window.setTimeout(() => window.slaycam.rendererMounted(), 0)
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.slaycam.rendererPainted()))
}
