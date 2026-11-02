'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('examy', Object.freeze({
  getSystemPrinters: () => invoke('get-system-printers'),
  openPrinterProperties: name => invoke('open-printer-properties', name),
  printSheetDirect: options => invoke('print-sheet-direct', options),
  printToPdf: options => invoke('print-to-pdf-native', options),
  setZoomFactor: factor => invoke('set-zoom-factor', factor),
  getRememberedLogin: () => invoke('auth:get-remembered'),
  saveRememberedLogin: credentials => invoke('auth:save-remembered', credentials),
  clearRememberedLogin: () => invoke('auth:clear-remembered'),
  onOpenExam: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('load-exam-from-file', listener);
    return () => ipcRenderer.removeListener('load-exam-from-file', listener);
  }
}));
