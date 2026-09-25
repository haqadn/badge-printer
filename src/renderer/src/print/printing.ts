// SPDX-License-Identifier: GPL-3.0-or-later
import { create } from 'zustand'
import type { JobProgress, PrintSettings } from '@shared/ipc'
import { fontPayloads, reportError } from '@/store/actions'
import { useStore } from '@/store/store'

const SETTINGS_KEY = 'print-settings'

export const DEFAULT_SETTINGS: PrintSettings = {
  target: 'printer',
  printer: '',
  batchSize: 10,
  pauseSeconds: 0,
  offset: { x: 0, y: 0 }
}

export function loadSettings(): PrintSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return { ...DEFAULT_SETTINGS, ...raw, offset: { ...DEFAULT_SETTINGS.offset, ...raw.offset } }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: PrintSettings): void {
  usePrintSettings.setState({ settings: s })
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // Not fatal: settings just won't be remembered.
  }
}

/** The saved print settings, kept in a store so the UI updates when they change. */
export const usePrintSettings = create<{ settings: PrintSettings }>(() => ({ settings: loadSettings() }))

/** True once a printer is saved, so single badges can print without the dialog. */
export function canQuickPrint(s: PrintSettings): boolean {
  return s.target === 'printer' && !!s.printer
}

/**
 * Prints one badge straight to the saved printer, or opens the print dialog when no
 * printer has been chosen yet.
 */
export function quickPrint(key: string, openDialog: (keys: string[], label: string) => void): void {
  const settings = usePrintSettings.getState().settings
  if (canQuickPrint(settings)) void startPrint([key], settings, true)
  else openDialog([key], 'this badge')
}

interface JobState {
  progress: JobProgress | null
  keys: string[]
  markAsPrinted: boolean
  /** How many of `keys` have already been marked printed. */
  marked: number
}

export const useJob = create<JobState>(() => ({ progress: null, keys: [], markAsPrinted: true, marked: 0 }))

let subscribed = false
function ensureSubscribed(): void {
  if (subscribed) return
  subscribed = true
  window.badge.onJobProgress((p) => {
    const job = useJob.getState()
    if (job.progress && job.progress.jobId !== p.jobId) return
    // Mark badges as printed as each batch is handed to the printer.
    if (job.markAsPrinted && p.done > job.marked) {
      useStore.getState().markPrinted(job.keys.slice(job.marked, p.done))
    }
    useJob.setState({ progress: p, marked: Math.max(job.marked, p.done) })
  })
}

export function jobRunning(): boolean {
  return useJob.getState().progress?.status === 'running'
}

/** Starts a print job for the given CSV row keys, in the given order. */
export async function startPrint(keys: string[], settings: PrintSettings, markAsPrinted: boolean): Promise<boolean> {
  ensureSubscribed()
  if (jobRunning()) {
    reportError('A print job is already running.')
    return false
  }
  const s = useStore.getState()
  const byKey = new Map(s.csv?.rows.map((r) => [r.key, r.values]) ?? [])
  const rows = keys.map((k) => byKey.get(k)).filter((r) => !!r)
  if (rows.length === 0) return false
  saveSettings(settings)
  try {
    useJob.setState({ progress: null, keys, markAsPrinted, marked: 0 })
    const jobId = await window.badge.startJob({
      template: s.template,
      fonts: fontPayloads(s.template, s.assets),
      rows,
      mapping: s.mapping,
      settings
    })
    if (!jobId) return false
    useJob.setState((j) =>
      j.progress?.jobId === jobId
        ? {}
        : {
            progress: {
              jobId,
              status: 'running',
              done: 0,
              total: rows.length,
              batch: 0,
              batches: Math.ceil(rows.length / settings.batchSize)
            }
          }
    )
    return true
  } catch (e) {
    reportError(e)
    return false
  }
}

export function cancelPrint(): void {
  const p = useJob.getState().progress
  if (p) void window.badge.cancelJob(p.jobId)
}

export function dismissJob(): void {
  if (!jobRunning()) useJob.setState({ progress: null })
}
