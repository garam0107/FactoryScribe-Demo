const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('directory:select'),
  saveFile: (payload) => ipcRenderer.invoke('file:save', payload),
})
