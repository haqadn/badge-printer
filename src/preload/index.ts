// SPDX-License-Identifier: GPL-3.0-or-later
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { BadgeApi } from '../shared/ipc'

function listen<T>(channel: string, cb: (v: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, v: T): void => cb(v)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: BadgeApi = {
  openFile: (filters) => ipcRenderer.invoke('file:open', filters),
  saveFile: (bytes, opts) => ipcRenderer.invoke('file:save', bytes, opts),
  confirmDiscard: (message) => ipcRenderer.invoke('dialog:confirm', message),
  setTitle: (title) => ipcRenderer.send('window:title', title),
  listPrinters: () => ipcRenderer.invoke('print:printers'),
  startJob: (req) => ipcRenderer.invoke('job:start', req),
  cancelJob: (id) => ipcRenderer.invoke('job:cancel', id),
  onJobProgress: (cb) => listen('job:progress', cb),
  onOpenPath: (cb) => listen('file:opened', cb),
  onRenderBatch: (cb) => listen('print:render', cb),
  batchReady: (batchId, error) => ipcRenderer.send('print:ready', batchId, error)
}

contextBridge.exposeInMainWorld('badge', api)
