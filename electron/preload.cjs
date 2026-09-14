const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('slaycam', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  importMedia: () => ipcRenderer.invoke('media:import'),
  removeMedia: (id) => ipcRenderer.invoke('media:remove', id),
  openOutput: () => ipcRenderer.invoke('output:open'),
  closeOutput: () => ipcRenderer.invoke('output:close'),
  sendOutputFrame: (dataUrl) => ipcRenderer.send('output:frame', dataUrl),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  getPlatform: () => process.platform,
  onOutputFrame: (handler) => {
    const listener = (_event, frame) => handler(frame)
    ipcRenderer.on('output:frame', listener)
    return () => ipcRenderer.removeListener('output:frame', listener)
  },
  onOutputState: (handler) => {
    const listener = (_event, isOpen) => handler(isOpen)
    ipcRenderer.on('output:state', listener)
    return () => ipcRenderer.removeListener('output:state', listener)
  },
})
