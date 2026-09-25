// SPDX-License-Identifier: GPL-3.0-or-later
import { create } from 'zustand'
import { templateColumns } from '@shared/interpolate'
import { newTemplate } from '@shared/template'
import type { Field, SideLayout, Template } from '@shared/types'
import type { Side } from '@/badge/Badge'
import { keyRows, parseCsv, suggestMapping, type CsvData } from '@/io/csv'
import { mimeFor, packTemplate, unpackTemplate } from '@/io/templateFile'
import type { Row } from '@shared/types'

const HISTORY_LIMIT = 100

export type View = 'design' | 'data'

interface State {
  view: View
  template: Template
  assets: Record<string, Uint8Array>
  assetUrls: Record<string, string>
  filePath: string | null
  dirty: boolean
  past: Template[]
  future: Template[]

  side: Side
  selectedId: string | null

  csv: CsvData | null
  mapping: Record<string, string>
  printed: Record<string, number>
  focusedKey: string | null
  selectedKeys: Set<string>

  setView(v: View): void
  setSide(s: Side): void
  select(id: string | null): void

  /** Records the current template in the undo history. Call before a drag starts. */
  checkpoint(): void
  /** Applies a change. `transient` skips the undo history (used while dragging). */
  update(fn: (t: Template) => void, opts?: { transient?: boolean }): void
  updateField(id: string, fn: (f: Field) => void, opts?: { transient?: boolean }): void
  undo(): void
  redo(): void

  addAsset(name: string, bytes: Uint8Array): void

  newDocument(): void
  loadTemplateBytes(bytes: Uint8Array, path: string | null): void
  templateBytes(): Uint8Array
  markSaved(path: string): void

  loadCsv(text: string, name: string): void
  setMapping(col: string, header: string): void
  setFocused(key: string | null): void
  toggleSelected(key: string): void
  setSelected(keys: string[]): void
  editRow(key: string, values: Row): void
  addRow(values: Row): string
  markPrinted(keys: string[]): void
  clearPrinted(keys: string[]): void
}

const PRINTED_KEY = 'printed-badges'

function loadPrinted(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PRINTED_KEY) || '{}')
  } catch {
    return {}
  }
}

function savePrinted(p: Record<string, number>): void {
  try {
    localStorage.setItem(PRINTED_KEY, JSON.stringify(p))
  } catch {
    // Storage full or unavailable; printed marks just won't survive a restart.
  }
}

function makeUrls(assets: Record<string, Uint8Array>, old: Record<string, string>): Record<string, string> {
  for (const url of Object.values(old)) URL.revokeObjectURL(url)
  const urls: Record<string, string> = {}
  for (const [name, bytes] of Object.entries(assets)) {
    urls[name] = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeFor(name) }))
  }
  return urls
}

/** The layout currently being edited, resolving to the front layout when the back mirrors it. */
export function editableLayout(t: Template, side: Side): SideLayout {
  if (side === 'back' && t.back.source === 'custom') return t.back.layout
  return t.front
}

export function findField(t: Template, id: string | null): Field | undefined {
  if (!id) return undefined
  return t.front.fields.find((f) => f.id === id) ?? t.back.layout.fields.find((f) => f.id === id)
}

export const useStore = create<State>((set, get) => ({
  view: 'design',
  template: newTemplate(),
  assets: {},
  assetUrls: {},
  filePath: null,
  dirty: false,
  past: [],
  future: [],
  side: 'front',
  selectedId: null,
  csv: null,
  mapping: {},
  printed: loadPrinted(),
  focusedKey: null,
  selectedKeys: new Set(),

  setView: (view) => set({ view }),
  setSide: (side) => set({ side, selectedId: null }),
  select: (selectedId) => set({ selectedId }),

  checkpoint: () =>
    set((s) => ({ past: [...s.past, s.template].slice(-HISTORY_LIMIT), future: [] })),

  update: (fn, opts) =>
    set((s) => {
      const next = structuredClone(s.template)
      fn(next)
      if (opts?.transient) return { template: next, dirty: true }
      return {
        template: next,
        dirty: true,
        past: [...s.past, s.template].slice(-HISTORY_LIMIT),
        future: []
      }
    }),

  updateField: (id, fn, opts) =>
    get().update((t) => {
      const f = findField(t, id)
      if (f) fn(f)
    }, opts),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev) return {}
      return { template: prev, past: s.past.slice(0, -1), future: [s.template, ...s.future], dirty: true }
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return {}
      return { template: next, future: s.future.slice(1), past: [...s.past, s.template], dirty: true }
    }),

  addAsset: (name, bytes) =>
    set((s) => {
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeFor(name) }))
      return { assets: { ...s.assets, [name]: bytes }, assetUrls: { ...s.assetUrls, [name]: url } }
    }),

  newDocument: () =>
    set((s) => ({
      template: newTemplate(),
      assets: {},
      assetUrls: makeUrls({}, s.assetUrls),
      filePath: null,
      dirty: false,
      past: [],
      future: [],
      selectedId: null,
      side: 'front'
    })),

  loadTemplateBytes: (bytes, path) => {
    const pkg = unpackTemplate(bytes)
    set((s) => ({
      template: pkg.template,
      assets: pkg.assets,
      assetUrls: makeUrls(pkg.assets, s.assetUrls),
      filePath: path,
      dirty: false,
      past: [],
      future: [],
      selectedId: null,
      side: 'front',
      mapping: s.csv ? suggestMapping(templateColumns(pkg.template), s.csv.headers) : {}
    }))
  },

  templateBytes: () => packTemplate(get().template, get().assets),
  markSaved: (path) => set({ filePath: path, dirty: false }),

  loadCsv: (text, name) => {
    const csv = parseCsv(text, name)
    set({
      csv,
      mapping: suggestMapping(templateColumns(get().template), csv.headers),
      focusedKey: csv.rows[0]?.key ?? null,
      selectedKeys: new Set()
    })
  },

  setMapping: (col, header) =>
    set((s) => {
      const mapping = { ...s.mapping }
      if (header) mapping[col] = header
      else delete mapping[col]
      return { mapping }
    }),

  setFocused: (focusedKey) => set({ focusedKey }),

  toggleSelected: (key) =>
    set((s) => {
      const next = new Set(s.selectedKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return { selectedKeys: next }
    }),

  setSelected: (keys) => set({ selectedKeys: new Set(keys) }),

  editRow: (key, values) =>
    set((s) => {
      if (!s.csv) return {}
      const rows = s.csv.rows.map((r) => (r.key === key ? { key, values } : r))
      return { csv: { ...s.csv, rows } }
    }),

  addRow: (values) => {
    const s = get()
    const headers = s.csv?.headers ?? Object.keys(values)
    const existing = s.csv?.rows ?? []
    const [row] = keyRows([values])
    const key = `${row.key}-manual-${Date.now().toString(36)}`
    set({
      csv: { name: s.csv?.name ?? 'Manual entries', headers, rows: [...existing, { key, values }] },
      focusedKey: key
    })
    return key
  },

  markPrinted: (keys) =>
    set((s) => {
      const printed = { ...s.printed }
      const now = Date.now()
      for (const k of keys) printed[k] = now
      savePrinted(printed)
      return { printed }
    }),

  clearPrinted: (keys) =>
    set((s) => {
      const printed = { ...s.printed }
      for (const k of keys) delete printed[k]
      savePrinted(printed)
      return { printed }
    })
}))
