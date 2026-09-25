// SPDX-License-Identifier: GPL-3.0-or-later
import type { Condition, Row, Template, Field } from './types'

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g

/** Column names referenced by a `{{Column}}` string, in order of first use. */
export function tokensIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(TOKEN)) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

/**
 * Looks up a column value. `mapping` translates template column names to CSV column
 * names when a CSV's headers differ from the ones the template was designed with.
 */
export function lookup(row: Row, column: string, mapping: Record<string, string> = {}): string {
  const key = mapping[column] || column
  return row[key] ?? ''
}

export function interpolate(text: string, row: Row, mapping?: Record<string, string>): string {
  return text.replace(TOKEN, (_, col: string) => lookup(row, col, mapping))
}

export function matches(cond: Condition | null, row: Row, mapping?: Record<string, string>): boolean {
  if (!cond || !cond.column) return true
  const actual = lookup(row, cond.column, mapping).trim().toLowerCase()
  const expected = cond.value.trim().toLowerCase()
  switch (cond.op) {
    case 'equals':
      return actual === expected
    case 'notEquals':
      return actual !== expected
    case 'contains':
      return actual.includes(expected)
    case 'notContains':
      return !actual.includes(expected)
    case 'empty':
      return actual === ''
    case 'notEmpty':
      return actual !== ''
  }
}

function fieldColumns(f: Field): string[] {
  const cols = tokensIn(f.content)
  if (f.showIf?.column) cols.push(f.showIf.column)
  return cols
}

/** Every column a template needs, across both sides and all conditions. */
export function templateColumns(t: Template): string[] {
  const fields = [...t.front.fields, ...(t.back.enabled && t.back.source === 'custom' ? t.back.layout.fields : [])]
  return [...new Set(fields.flatMap(fieldColumns))]
}
