// SPDX-License-Identifier: GPL-3.0-or-later
import { BrowserWindow, dialog, type WebContentsPrintOptions } from 'electron'
import { writeFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { chunk } from '../shared/batch'
import type { JobProgress, PrintJobRequest, RenderBatch } from '../shared/ipc'
import { pieceSize } from '../shared/template'
import { loadRenderer, webPreferences } from './window'

const RENDER_TIMEOUT_MS = 60_000

interface Running {
  id: string
  cancelled: boolean
  wake: (() => void) | null
}

/**
 * Runs print jobs in batches through a hidden window. Only one batch is ever laid out
 * and spooled at a time, so neither the app nor the printer has to hold the whole run
 * in memory. The window is destroyed after each job to release everything it used.
 */
export class JobRunner {
  private current: Running | null = null
  private printWin: BrowserWindow | null = null
  private waiters = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()

  constructor(private getMain: () => BrowserWindow | null) {}

  async start(req: PrintJobRequest): Promise<string | null> {
    if (this.current) throw new Error('A print job is already running.')
    if (req.rows.length === 0) throw new Error('There are no badges to print.')

    let pdfPath: string | undefined
    if (req.settings.target === 'pdf') {
      const main = this.getMain()
      const opts = {
        defaultPath: `${req.template.name || 'badges'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      }
      const res = main ? await dialog.showSaveDialog(main, opts) : await dialog.showSaveDialog(opts)
      if (res.canceled || !res.filePath) return null
      pdfPath = res.filePath
    } else if (!req.settings.printer) {
      throw new Error('Choose a printer first.')
    }

    const job: Running = { id: Math.random().toString(36).slice(2), cancelled: false, wake: null }
    this.current = job
    void this.run(job, req, pdfPath)
    return job.id
  }

  cancel(id: string): void {
    if (this.current?.id !== id) return
    this.current.cancelled = true
    this.current.wake?.()
  }

  onBatchReady(batchId: string, error?: string): void {
    const w = this.waiters.get(batchId)
    if (!w) return
    this.waiters.delete(batchId)
    if (error) w.reject(new Error(error))
    else w.resolve()
  }

  dispose(): void {
    if (this.current) this.current.cancelled = true
    this.destroyWindow()
  }

  private emit(p: JobProgress): void {
    this.getMain()?.webContents.send('job:progress', p)
  }

  private async run(job: Running, req: PrintJobRequest, pdfPath?: string): Promise<void> {
    const { settings } = req
    const batches = chunk(req.rows, settings.batchSize)
    const total = req.rows.length
    const piece = pieceSize(req.template)
    const base = { jobId: job.id, total, batches: batches.length, pdfPath }
    let done = 0
    const merged = pdfPath ? await PDFDocument.create() : null

    try {
      const win = await this.ensureWindow()
      for (let i = 0; i < batches.length; i++) {
        if (job.cancelled) break
        this.emit({ ...base, status: 'running', done, batch: i + 1 })
        await this.render(win, {
          batchId: `${job.id}-${i}`,
          template: req.template,
          fonts: req.fonts,
          rows: batches[i],
          mapping: req.mapping,
          offset: settings.offset
        })
        if (job.cancelled) break

        if (merged) {
          const pdf = await win.webContents.printToPDF({
            preferCSSPageSize: true,
            printBackground: true,
            margins: { top: 0, bottom: 0, left: 0, right: 0 }
          })
          const part = await PDFDocument.load(pdf)
          for (const page of await merged.copyPages(part, part.getPageIndices())) merged.addPage(page)
        } else {
          await printAsync(win, {
            silent: true,
            deviceName: settings.printer,
            printBackground: true,
            margins: { marginType: 'none' },
            // Electron expects microns.
            pageSize: { width: Math.round(piece.w * 1000), height: Math.round(piece.h * 1000) },
            landscape: false,
            copies: 1
          })
        }

        done += batches[i].length
        this.emit({ ...base, status: 'running', done, batch: i + 1 })
        if (i < batches.length - 1 && settings.pauseSeconds > 0) await this.pause(job, settings.pauseSeconds * 1000)
      }

      if (merged && pdfPath && done > 0 && !job.cancelled) await writeFile(pdfPath, await merged.save())
      this.emit({ ...base, status: job.cancelled ? 'cancelled' : 'done', done, batch: batches.length })
    } catch (e) {
      this.emit({ ...base, status: 'failed', done, batch: 0, error: e instanceof Error ? e.message : String(e) })
    } finally {
      this.current = null
      this.destroyWindow()
    }
  }

  private pause(job: Running, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(done, ms)
      function done(): void {
        clearTimeout(t)
        job.wake = null
        resolve()
      }
      job.wake = done
    })
  }

  private async ensureWindow(): Promise<BrowserWindow> {
    if (this.printWin && !this.printWin.isDestroyed()) return this.printWin
    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 1000,
      webPreferences: { ...webPreferences, backgroundThrottling: false }
    })
    this.printWin = win
    await loadRenderer(win, 'print')
    return win
  }

  private destroyWindow(): void {
    for (const w of this.waiters.values()) w.reject(new Error('Print window closed'))
    this.waiters.clear()
    if (this.printWin && !this.printWin.isDestroyed()) this.printWin.destroy()
    this.printWin = null
  }

  private render(win: BrowserWindow, batch: RenderBatch): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(batch.batchId)
        reject(new Error('Timed out while laying out badges.'))
      }, RENDER_TIMEOUT_MS)
      this.waiters.set(batch.batchId, {
        resolve: () => {
          clearTimeout(timer)
          resolve()
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        }
      })
      win.webContents.send('print:render', batch)
    })
  }
}

function printAsync(win: BrowserWindow, opts: WebContentsPrintOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    win.webContents.print(opts, (ok, reason) => {
      if (ok) resolve()
      else reject(new Error(reason === 'cancelled' ? 'Printing was cancelled.' : `Printer error: ${reason}`))
    })
  })
}
