// SPDX-License-Identifier: GPL-3.0-or-later
import type { Row, Template } from './types'

export interface OpenedFile {
  path: string
  name: string
  bytes: Uint8Array
}

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface PrinterInfo {
  name: string
  displayName: string
  isDefault: boolean
}

export interface FontPayload {
  family: string
  weight: number
  italic: boolean
  bytes: Uint8Array
}

export interface PrintSettings {
  /** `printer` sends to a printer silently; `pdf` writes a PDF file. */
  target: 'printer' | 'pdf'
  printer: string
  /** Badges per print job. Small batches keep printer and app memory low. */
  batchSize: number
  /** Pause between batches, giving the printer time to drain its buffer. */
  pauseSeconds: number
  /** Calibration nudge applied to everything, for aligning with pre-printed stock. */
  offset: { x: number; y: number }
}

export interface PrintJobRequest {
  template: Template
  fonts: FontPayload[]
  rows: Row[]
  mapping: Record<string, string>
  settings: PrintSettings
}

export type JobStatus = 'running' | 'done' | 'cancelled' | 'failed'

export interface JobProgress {
  jobId: string
  status: JobStatus
  /** Badges handed to the printer (or PDF) so far. */
  done: number
  total: number
  batch: number
  batches: number
  error?: string
  pdfPath?: string
}

/** What the hidden print window receives for one batch. */
export interface RenderBatch {
  batchId: string
  template: Template
  fonts: FontPayload[]
  rows: Row[]
  mapping: Record<string, string>
  offset: { x: number; y: number }
}

export interface BadgeApi {
  openFile(filters: FileFilter[]): Promise<OpenedFile | null>
  saveFile(bytes: Uint8Array, opts: { path?: string; defaultName: string; filters: FileFilter[] }): Promise<string | null>
  confirmDiscard(message: string): Promise<boolean>
  setTitle(title: string): void
  listPrinters(): Promise<PrinterInfo[]>
  startJob(req: PrintJobRequest): Promise<string | null>
  cancelJob(jobId: string): Promise<void>
  onJobProgress(cb: (p: JobProgress) => void): () => void
  /** Files opened via the OS (double-click on a .badge file). */
  onOpenPath(cb: (file: OpenedFile) => void): () => void
  // Print window side
  onRenderBatch(cb: (b: RenderBatch) => void): () => void
  batchReady(batchId: string, error?: string): void
}
