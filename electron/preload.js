/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shotbank", {
  getState: () => ipcRenderer.invoke("shotbank:get-state"),
  startMovie: (input) => ipcRenderer.invoke("shotbank:start-movie", input),
  resumeMovie: (movieId) => ipcRenderer.invoke("shotbank:resume-movie", movieId),
  deleteMovie: (movieId) => ipcRenderer.invoke("shotbank:delete-movie", movieId),
  endSession: () => ipcRenderer.invoke("shotbank:end-session"),
  captureNow: () => ipcRenderer.invoke("shotbank:capture-now"),
  updateShot: (input) => ipcRenderer.invoke("shotbank:update-shot", input),
  updateMovie: (input) => ipcRenderer.invoke("shotbank:update-movie", input),
  setShortcut: (accelerator) => ipcRenderer.invoke("shotbank:set-shortcut", accelerator),
  chooseLibraryRoot: () => ipcRenderer.invoke("shotbank:choose-library-root"),
  openPath: (targetPath) => ipcRenderer.invoke("shotbank:open-path", targetPath),
  onShotCaptured: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("shotbank:shot-captured", handler);
    return () => ipcRenderer.removeListener("shotbank:shot-captured", handler);
  },
});
