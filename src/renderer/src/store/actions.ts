// SPDX-License-Identifier: GPL-3.0-or-later
import type { FontPayload } from '@shared/ipc'
import type { Row, Template } from '@shared/types'
import { useStore } from './store'

export const TEMPLATE_FILTERS = [{ name: 'Badge template', extensions: ['badge'] }]
export const CSV_FILTERS = [{ name: 'CSV', extensions: ['csv', 'tsv', 'txt'] }]
export const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }]
export const FONT_FILTERS = [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]

export function reportError(e: unknown): void {
  alert(e instanceof Error ? e.message : String(e))
}

async function confirmIfDirty(): Promise<boolean> {
  if (!useStore.getState().dirty) return true
  return window.badge.confirmDiscard('The current template has unsaved changes. Discard them?')
}

export async function newTemplateAction(): Promise<void> {
  if (await confirmIfDirty()) useStore.getState().newDocument()
}

export async function openTemplateAction(): Promise<void> {
  if (!(await confirmIfDirty())) return
  const file = await window.badge.openFile(TEMPLATE_FILTERS)
  if (!file) return
  try {
    useStore.getState().loadTemplateBytes(file.bytes, file.path)
  } catch (e) {
    reportError(e)
  }
}

export async function saveTemplateAction(saveAs = false): Promise<void> {
  const s = useStore.getState()
  const path = await window.badge.saveFile(s.templateBytes(), {
    path: saveAs ? undefined : (s.filePath ?? undefined),
    defaultName: `${s.template.name || 'badge'}.badge`,
    filters: TEMPLATE_FILTERS
  })
  if (path) s.markSaved(path)
}

export async function openCsvAction(): Promise<void> {
  const file = await window.badge.openFile(CSV_FILTERS)
  if (!file) return
  try {
    useStore.getState().loadCsv(new TextDecoder().decode(file.bytes), file.name)
  } catch (e) {
    reportError(e)
  }
}

export function fontPayloads(t: Template, assets: Record<string, Uint8Array>): FontPayload[] {
  return t.fonts
    .filter((f) => assets[f.asset])
    .map((f) => ({ family: f.family, weight: f.weight, italic: f.italic, bytes: assets[f.asset] }))
}

/** The row shown in the designer: the focused CSV row, or the template's sample data. */
export function usePreviewRow(): Row {
  return useStore((s) => {
    const r = s.csv?.rows.find((x) => x.key === s.focusedKey)
    return r ? r.values : s.template.sampleRow
  })
}
