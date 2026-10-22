const { contextBridge, ipcRenderer, webUtils } = require("electron");
const listen = (channel) => (callback) => {
  const fn = (_e, data) => callback(data);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};
contextBridge.exposeInMainWorld("tangerine", {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  queueFiles: (paths, target) =>
    ipcRenderer.invoke("queue-files", paths, target),
  cancelJobs: () => ipcRenderer.invoke("cancel-jobs"),
  selectFiles: () => ipcRenderer.invoke("select-files"),
  showItemInFolder: (file) => ipcRenderer.invoke("show-item-in-folder", file),
  closeRadial: () => ipcRenderer.invoke("radial-close"),
  openDashboard: () => ipcRenderer.invoke("open-dashboard"),
  openRadial: () => ipcRenderer.invoke("open-radial"),
  onRadialActivate: listen("radial-activate"),
  onJobUpdate: listen("job-update"),
  onConversionComplete: listen("conversion-complete"),
  onHistoryChanged: listen("history-changed"),
  onSettingsChanged: listen("settings-changed"),
  getHistory: () => ipcRenderer.invoke("get-history"),
  clearHistory: () => ipcRenderer.invoke("clear-history"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
});
