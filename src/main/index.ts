// SPDX-License-Identifier: GPL-3.0-or-later
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { FileFilter, OpenedFile, PrintJobRequest } from '../shared/ipc'
import { JobRunner } from './jobs'
import { loadRenderer, webPreferences } from './window'

let mainWindow: BrowserWindow | null = null
let pendingOpen: string | null = process.argv.find((a) => a.endsWith('.badge')) ?? null

async function readOpened(path: string): Promise<OpenedFile> {
  return { path, name: basename(path), bytes: new Uint8Array(await readFile(path)) }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Badge Printer',
    webPreferences
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
    jobs.dispose()
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault())
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpen) {
      const p = pendingOpen
      pendingOpen = null
      void readOpened(p).then((f) => mainWindow?.webContents.send('file:opened', f))
    }
  })
  void loadRenderer(mainWindow)
}

const jobs = new JobRunner(() => mainWindow)

function registerIpc(): void {
  ipcMain.handle('file:open', async (_e, filters: FileFilter[]) => {
    const res = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters })
    if (res.canceled || !res.filePaths[0]) return null
    return readOpened(res.filePaths[0])
  })

  ipcMain.handle(
    'file:save',
    async (_e, bytes: Uint8Array, opts: { path?: string; defaultName: string; filters: FileFilter[] }) => {
      let path = opts.path
      if (!path) {
        const res = await dialog.showSaveDialog(mainWindow!, { defaultPath: opts.defaultName, filters: opts.filters })
        if (res.canceled || !res.filePath) return null
        path = res.filePath
      }
      await writeFile(path, bytes)
      return path
    }
  )

  ipcMain.handle('dialog:confirm', async (_e, message: string) => {
    const res = await dialog.showMessageBox(mainWindow!, {
      type: 'question',
      buttons: ['Discard', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message
    })
    return res.response === 0
  })

  ipcMain.on('window:title', (_e, title: string) => mainWindow?.setTitle(title))

  ipcMain.handle('print:printers', async () => {
    const list = await mainWindow!.webContents.getPrintersAsync()
    return list.map((p) => {
      const opts = (p.options ?? {}) as Record<string, string>
      const isDefault = opts['is-default'] === 'true' || opts['isDefault'] === 'true' || opts['printer-is-default'] === 'true'
      return { name: p.name, displayName: p.displayName || p.name, isDefault }
    })
  })

  ipcMain.handle('job:start', (_e, req: PrintJobRequest) => jobs.start(req))
  ipcMain.handle('job:cancel', (_e, id: string) => jobs.cancel(id))
  ipcMain.on('print:ready', (_e, batchId: string, error?: string) => jobs.onBatchReady(batchId, error))
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    const file = argv.find((a) => a.endsWith('.badge'))
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      if (file) void readOpened(file).then((f) => mainWindow?.webContents.send('file:opened', f))
    }
  })

  // macOS: double-clicked files arrive through this event.
  app.on('open-file', (e, path) => {
    e.preventDefault()
    if (mainWindow) void readOpened(path).then((f) => mainWindow?.webContents.send('file:opened', f))
    else pendingOpen = path
  })

  void app.whenReady().then(() => {
    registerIpc()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
