// SPDX-License-Identifier: GPL-3.0-or-later
import { app, type BrowserWindow, type WebPreferences } from 'electron'
import { join } from 'node:path'

export const webPreferences: WebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false
}

export function loadRenderer(win: BrowserWindow, hash = ''): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) return win.loadURL(devUrl + (hash ? `#${hash}` : ''))
  return win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
}
