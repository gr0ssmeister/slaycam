import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import type { UpdateState } from './update'
import './styles.css'

if (import.meta.env.DEV && !window.slaycam) {
  const updateListeners = new Set<(state: UpdateState) => void>()
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
    onWindowMaximized: () => () => undefined,
    onUpdateState: (handler) => {
      updateListeners.add(handler)
      return () => updateListeners.delete(handler)
    },
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
