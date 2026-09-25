// SPDX-License-Identifier: GPL-3.0-or-later
import type { Field, FieldType, QrField, SideLayout, Template, TextField } from './types'

export const MM_PER_INCH = 25.4
export const PT_PER_MM = 72 / MM_PER_INCH

export const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '4 × 6 in', w: 101.6, h: 152.4 },
  { label: '4 × 3 in', w: 101.6, h: 76.2 },
  { label: '3 × 4 in', w: 76.2, h: 101.6 },
  { label: 'A6 (105 × 148 mm)', w: 105, h: 148 },
  { label: 'CR80 card (85.6 × 54 mm)', w: 85.6, h: 53.98 },
  { label: 'CR80 portrait', w: 53.98, h: 85.6 }
]

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function emptySide(): SideLayout {
  return { stock: null, fields: [] }
}

export function newTemplate(): Template {
  const t: Template = {
    version: 1,
    name: 'Untitled badge',
    size: { w: 101.6, h: 152.4 },
    front: emptySide(),
    back: { enabled: false, foldEdge: 'bottom', source: 'mirror', layout: emptySide() },
    fonts: [],
    sampleRow: { Name: 'Jane Doe', ID: '1024', Type: 'Attendee' }
  }
  t.front.fields.push(
    newField('text', t, { name: 'Name', content: '{{Name}}', box: { x: 6, y: 88, w: 89.6, h: 30 } }),
    newField('text', t, {
      name: 'ID',
      content: '{{ID}}',
      box: { x: 6, y: 122, w: 89.6, h: 12 },
      maxFontSize: 20,
      maxLines: 1
    })
  )
  return t
}

export function newField(type: 'text', t: Template, patch?: Partial<TextField>): TextField
export function newField(type: 'qr', t: Template, patch?: Partial<QrField>): QrField
export function newField(type: FieldType, t: Template, patch?: Partial<Field>): Field
export function newField(type: FieldType, t: Template, patch: Partial<Field> = {}): Field {
  const base = {
    id: newId(),
    hAlign: 'center' as const,
    vAlign: 'middle' as const,
    showIf: null,
    locked: false
  }
  if (type === 'qr') {
    const size = Math.min(30, t.size.w / 2, t.size.h / 2)
    return {
      ...base,
      type: 'qr',
      name: 'QR code',
      content: '{{ID}}',
      box: { x: (t.size.w - size) / 2, y: (t.size.h - size) / 2, w: size, h: size },
      errorCorrection: 'M',
      color: '#000000',
      background: 'transparent',
      margin: 0,
      ...(patch as Partial<QrField>)
    }
  }
  return {
    ...base,
    type: 'text',
    name: 'Text',
    content: '{{Name}}',
    box: { x: t.size.w * 0.1, y: t.size.h * 0.4, w: t.size.w * 0.8, h: 15 },
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontWeight: 700,
    italic: false,
    color: '#000000',
    maxFontSize: 36,
    minFontSize: 8,
    lineHeight: 1.15,
    letterSpacing: 0,
    maxLines: 0,
    transform: 'none',
    overflow: 'shrink',
    ...(patch as Partial<TextField>)
  }
}

/** The layout printed on the back, resolving `mirror`. */
export function backLayout(t: Template): SideLayout {
  return t.back.source === 'mirror' ? { ...t.front, stock: t.back.layout.stock ?? t.front.stock } : t.back.layout
}

/** Physical size of one printed piece of stock (doubled in fold mode). */
export function pieceSize(t: Template): { w: number; h: number } {
  if (!t.back.enabled) return { ...t.size }
  return t.back.foldEdge === 'bottom' ? { w: t.size.w, h: t.size.h * 2 } : { w: t.size.w * 2, h: t.size.h }
}

/**
 * Fills in anything missing from a template read from disk, so files written by older
 * versions (or edited by hand) still open.
 */
export function normalizeTemplate(raw: unknown): Template {
  if (!raw || typeof raw !== 'object') throw new Error('Template file is not a JSON object')
  const r = raw as Partial<Template>
  if (r.version !== 1) throw new Error(`Unsupported template version: ${String(r.version)}`)
  const base = newTemplate()
  const t: Template = {
    version: 1,
    name: typeof r.name === 'string' ? r.name : base.name,
    size: {
      w: positive(r.size?.w, base.size.w),
      h: positive(r.size?.h, base.size.h)
    },
    front: normalizeSide(r.front, base),
    back: {
      enabled: !!r.back?.enabled,
      foldEdge: r.back?.foldEdge === 'right' ? 'right' : 'bottom',
      source: r.back?.source === 'custom' ? 'custom' : 'mirror',
      layout: normalizeSide(r.back?.layout, base)
    },
    fonts: Array.isArray(r.fonts) ? r.fonts.filter((f) => f && f.family && f.asset) : [],
    sampleRow: r.sampleRow && typeof r.sampleRow === 'object' ? { ...r.sampleRow } : {}
  }
  return t
}

function positive(v: unknown, fallback: number): number {
  return typeof v === 'number' && v > 0 && Number.isFinite(v) ? v : fallback
}

function normalizeSide(s: Partial<SideLayout> | undefined, t: Template): SideLayout {
  const fields = Array.isArray(s?.fields) ? s.fields : []
  return {
    stock: typeof s?.stock === 'string' ? s.stock : null,
    fields: fields
      .filter((f) => f && (f.type === 'text' || f.type === 'qr'))
      .map((f) => newField(f.type, t, { ...f, id: f.id || newId() }))
  }
}
