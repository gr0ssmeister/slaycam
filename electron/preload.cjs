const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('slaycam', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  importMedia: () => ipcRenderer.invoke('media:import'),
  removeMedia: (id) => ipcRenderer.invoke('media:remove', id),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  getUpdateState: () => ipcRenderer.invoke('updater:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getPlatform: () => process.platform,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowMaximized: (handler) => {
    const listener = (_event, maximized) => handler(Boolean(maximized))
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  },
  onUpdateState: (handler) => {
    const listener = (_event, state) => handler(state)
    ipcRenderer.on('updater:state', listener)
    return () => ipcRenderer.removeListener('updater:state', listener)
  },
})
