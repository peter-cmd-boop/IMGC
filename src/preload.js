const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('tangerine', {
  // Path extraction from dropped File object in Electron
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
      return file.path || '';
    } catch (e) {
      return file.path || '';
    }
  },

  // Perform offline conversion
  convertFile: (filePath, formatOrTool, options) => {
    return ipcRenderer.invoke('convert-file', { filePath, formatOrTool, options });
  },

  // Open converted file or folder in Windows Explorer
  showItemInFolder: (filePath) => {
    return ipcRenderer.invoke('show-item-in-folder', filePath);
  },

  // Radial Window control
  closeRadial: () => {
    ipcRenderer.send('radial-close');
  },

  setRadialIgnoreMouse: (ignore) => {
    ipcRenderer.send('radial-ignore-mouse', ignore);
  },

  // Communication & Events
  onRadialActivate: (callback) => {
    ipcRenderer.on('radial-activate', (event, data) => callback(data));
  },

  onConversionComplete: (callback) => {
    ipcRenderer.on('conversion-complete', (event, data) => callback(data));
  },

  onConversionProgress: (callback) => {
    ipcRenderer.on('conversion-progress', (event, data) => callback(data));
  },

  // Settings & History
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings)
});
