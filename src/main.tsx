import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

if (!window.slaycam) {
  window.slaycam = {
    loadConfig: async () => JSON.parse(localStorage.getItem('slaycam.preview') || 'null'),
    saveConfig: async (config) => { localStorage.setItem('slaycam.preview', JSON.stringify(config)); return true },
    importMedia: async () => [],
    removeMedia: async () => true,
    openOutput: async () => true,
    closeOutput: async () => true,
    sendOutputFrame: () => undefined,
    openExternal: async (url) => { window.open(url, '_blank', 'noopener'); return true },
    getPlatform: () => navigator.platform,
    onOutputFrame: () => () => undefined,
    onOutputState: () => () => undefined,
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
