// SPDX-License-Identifier: GPL-3.0-or-later
import Papa from 'papaparse'
import type { Row } from '@shared/types'

export interface DataRow {
  /** Stable key derived from the row's values; used to remember printed badges. */
  key: string
  values: Row
}

export interface CsvData {
  name: string
  headers: string[]
  rows: DataRow[]
}

export function parseCsv(text: string, name: string): CsvData {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim()
  })
  const headers = (res.meta.fields ?? []).filter((h) => h !== '')
  if (headers.length === 0) throw new Error('The CSV file has no header row.')
  const rows = res.data.map((r) => {
    const values: Row = {}
    for (const h of headers) values[h] = (r[h] ?? '').toString().trim()
    return values
  })
  return { name, headers, rows: keyRows(rows) }
}

export function keyRows(rows: Row[]): DataRow[] {
  const seen = new Map<string, number>()
  return rows.map((values) => {
    const h = hashRow(values)
    const n = seen.get(h) ?? 0
    seen.set(h, n + 1)
    return { key: n ? `${h}-${n}` : h, values }
  })
}

/** 53-bit FNV-1a style hash of a row's values. */
export function hashRow(values: Row): string {
  const s = JSON.stringify(Object.keys(values).sort().map((k) => [k, values[k]]))
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * Suggests a mapping for template columns missing from the CSV, matching names that
 * differ only in case, spacing or punctuation.
 */
export function suggestMapping(templateCols: string[], headers: string[]): Record<string, string> {
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const out: Record<string, string> = {}
  for (const col of templateCols) {
    if (headers.includes(col)) continue
    const match = headers.find((h) => norm(h) === norm(col))
    if (match) out[col] = match
  }
  return out
}
