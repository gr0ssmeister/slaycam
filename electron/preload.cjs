const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('slaycam', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  importMedia: (kind) => ipcRenderer.invoke('media:import', kind),
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
  getVirtualCameraState: () => ipcRenderer.invoke('virtual-camera:get-state'),
  installVirtualCamera: () => ipcRenderer.invoke('virtual-camera:install'),
  uninstallVirtualCamera: () => ipcRenderer.invoke('virtual-camera:uninstall'),
  startVirtualCamera: (width, height, fps) => ipcRenderer.invoke('virtual-camera:start', width, height, fps),
  stopVirtualCamera: () => ipcRenderer.invoke('virtual-camera:stop'),
  sendVirtualCameraFrame: (buffer) => {
    try {
      ipcRenderer.postMessage('virtual-camera:frame', buffer)
    } catch (error) {
      ipcRenderer.send('renderer:error', `virtual-camera-frame: ${error?.stack || error}`)
    }
  },
  rendererMounted: () => ipcRenderer.send('renderer:mounted'),
  rendererPainted: () => ipcRenderer.send('renderer:painted'),
  reportPerformance: (details) => ipcRenderer.send('renderer:performance', String(details || '').slice(0, 400)),
  reportRendererError: (details) => ipcRenderer.send('renderer:error', String(details || '').slice(0, 12000)),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  showStartupLog: () => ipcRenderer.invoke('app:show-log'),
  resetConfig: () => ipcRenderer.invoke('config:reset'),
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
  onVirtualCameraState: (handler) => {
    const listener = (_event, state) => handler(state)
    ipcRenderer.on('virtual-camera:state', listener)
    return () => ipcRenderer.removeListener('virtual-camera:state', listener)
  },
})
