// SPDX-License-Identifier: GPL-3.0-or-later
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { templateColumns } from '@shared/interpolate'
import type { DataRow } from '@/io/csv'
import { openCsvAction } from '@/store/actions'
import { useStore } from '@/store/store'
import PrintDialog, { JobStatusBar } from '@/print/PrintDialog'
import { quickPrint } from '@/print/printing'
import PreviewPanel from './PreviewPanel'

const ROW_HEIGHT = 32
const OVERSCAN = 10

export default function DataView() {
  const csv = useStore((s) => s.csv)
  const [dialog, setDialog] = useState<{ keys: string[]; label: string } | null>(null)

  if (!csv) {
    return (
      <div className="empty-state">
        <h2>Load your attendee list</h2>
        <p className="muted">
          Pick a CSV file with a header row. Placeholders like <code>{'{{Name}}'}</code> in the template are filled from
          the column with the same name.
        </p>
        <div className="button-row">
          <button className="primary" onClick={() => void openCsvAction()}>
            Load CSV…
          </button>
          <button onClick={() => useStore.getState().addRow(blankRow())}>Enter a badge by hand</button>
        </div>
      </div>
    )
  }

  return (
    <div className="data-view">
      <div className="data-main">
        <MappingBanner />
        <RowTable onPrint={(keys, label) => setDialog({ keys, label })} />
        <JobStatusBar />
      </div>
      <aside className="sidebar right wide">
        <PreviewPanel onPrint={(keys, label) => setDialog({ keys, label })} />
      </aside>
      {dialog && <PrintDialog keys={dialog.keys} label={dialog.label} onClose={() => setDialog(null)} />}
    </div>
  )
}

/** Column widths shared by every row, sized from the header and a sample of values. */
function columnTemplate(csv: { headers: string[]; rows: DataRow[] }): string {
  const sample = csv.rows.slice(0, 300)
  const widths = csv.headers.map((h) => {
    const longest = Math.max(h.length, ...sample.map((r) => (r.values[h] ?? '').length))
    return `${Math.min(320, Math.max(70, longest * 7.5 + 20))}px`
  })
  return `36px 28px ${widths.join(' ')} 1fr`
}

export function blankRow(): Record<string, string> {
  const s = useStore.getState()
  const cols = s.csv?.headers ?? [...new Set([...Object.keys(s.template.sampleRow), ...templateColumns(s.template)])]
  return Object.fromEntries(cols.map((c) => [c, '']))
}

function MappingBanner() {
  const headers = useStore((s) => s.csv?.headers ?? [])
  const template = useStore((s) => s.template)
  const mapping = useStore((s) => s.mapping)
  const setMapping = useStore((s) => s.setMapping)
  const unresolved = templateColumns(template).filter((c) => !headers.includes(c))
  if (unresolved.length === 0) return null
  const missing = unresolved.filter((c) => !mapping[c])
  return (
    <div className={`banner ${missing.length ? 'warn' : ''}`}>
      <strong>
        {missing.length
          ? 'The template uses columns this CSV doesn’t have. Pick which column to use instead:'
          : 'Column mapping'}
      </strong>
      <div className="mapping">
        {unresolved.map((c) => (
          <label key={c}>
            <code>{`{{${c}}}`}</code> →
            <select value={mapping[c] ?? ''} onChange={(e) => setMapping(c, e.target.value)}>
              <option value="">(leave empty)</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  )
}

function RowTable({ onPrint }: { onPrint: (keys: string[], label: string) => void }) {
  const csv = useStore((s) => s.csv)!
  const printed = useStore((s) => s.printed)
  const focusedKey = useStore((s) => s.focusedKey)
  const selectedKeys = useStore((s) => s.selectedKeys)
  const [search, setSearch] = useState('')
  const [filterCol, setFilterCol] = useState('')
  const [filterVal, setFilterVal] = useState('')
  const [status, setStatus] = useState<'all' | 'printed' | 'unprinted'>('all')
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(600)
  const scrollRef = useRef<HTMLDivElement>(null)
  const q = useDeferredValue(search.trim().toLowerCase())

  const filterValues = useMemo(() => {
    if (!filterCol) return []
    return [...new Set(csv.rows.map((r) => r.values[filterCol] ?? ''))].sort((a, b) => a.localeCompare(b))
  }, [csv, filterCol])

  const rows = useMemo(
    () =>
      csv.rows.filter((r) => {
        if (status === 'printed' && !printed[r.key]) return false
        if (status === 'unprinted' && printed[r.key]) return false
        if (filterCol && filterVal !== '\u0000' && (r.values[filterCol] ?? '') !== filterVal) return false
        if (q && !Object.values(r.values).some((v) => v.toLowerCase().includes(q))) return false
        return true
      }),
    [csv, printed, status, filterCol, filterVal, q]
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const focusIndex = rows.findIndex((r) => r.key === focusedKey)

  const focusAt = (i: number): void => {
    const r = rows[Math.max(0, Math.min(rows.length - 1, i))]
    if (!r) return
    useStore.getState().setFocused(r.key)
    const el = scrollRef.current
    if (!el) return
    const idx = rows.indexOf(r)
    const top = idx * ROW_HEIGHT
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight - ROW_HEIGHT) el.scrollTop = top + 2 * ROW_HEIGHT - el.clientHeight
  }

  const printOne = (r: DataRow): void => {
    // Once a printer has been set up, printing a single badge is one keystroke.
    quickPrint(r.key, onPrint)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const page = Math.max(1, Math.floor(height / ROW_HEIGHT) - 1)
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page }
    if (e.key in moves) {
      e.preventDefault()
      focusAt((focusIndex < 0 ? -1 : focusIndex) + moves[e.key])
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusAt(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusAt(rows.length - 1)
    } else if (e.key === ' ' && focusedKey) {
      e.preventDefault()
      useStore.getState().toggleSelected(focusedKey)
    } else if (e.key === 'Enter' && focusIndex >= 0) {
      e.preventDefault()
      printOne(rows[focusIndex])
    }
  }

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN)
  const visible = rows.slice(start, end)
  const selectedVisible = rows.filter((r) => selectedKeys.has(r.key))
  const allSelected = rows.length > 0 && selectedVisible.length === rows.length
  const printedCount = csv.rows.filter((r) => printed[r.key]).length
  const cols = useMemo(() => columnTemplate(csv), [csv])

  return (
    <>
      <div className="data-toolbar">
        <input
          type="search"
          placeholder="Search all columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search"
        />
        <select
          value={filterCol}
          onChange={(e) => {
            setFilterCol(e.target.value)
            setFilterVal('\u0000')
          }}
          title="Filter by a column"
        >
          <option value="">Filter by column…</option>
          {csv.headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        {filterCol && (
          <select value={filterVal} onChange={(e) => setFilterVal(e.target.value)}>
            <option value={'\u0000'}>Any value</option>
            {filterValues.map((v) => (
              <option key={v} value={v}>
                {v || '(empty)'}
              </option>
            ))}
          </select>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All badges</option>
          <option value="unprinted">Not printed yet</option>
          <option value="printed">Already printed</option>
        </select>
        <span className="spacer" />
        <span className="muted small">
          {rows.length} shown · {printedCount}/{csv.rows.length} printed
        </span>
      </div>

      <div className="data-toolbar">
        <button
          className="primary"
          disabled={selectedVisible.length === 0}
          onClick={() => onPrint(selectedVisible.map((r) => r.key), `${selectedVisible.length} selected`)}
        >
          Print selected ({selectedVisible.length})
        </button>
        <button disabled={rows.length === 0} onClick={() => onPrint(rows.map((r) => r.key), 'all shown')}>
          Print all shown ({rows.length})
        </button>
        <span className="spacer" />
        <button
          className="link"
          disabled={selectedVisible.length === 0}
          onClick={() => useStore.getState().markPrinted(selectedVisible.map((r) => r.key))}
        >
          Mark selected printed
        </button>
        <button
          className="link"
          disabled={selectedVisible.length === 0}
          onClick={() => useStore.getState().clearPrinted(selectedVisible.map((r) => r.key))}
        >
          Mark selected not printed
        </button>
        <button onClick={() => useStore.getState().addRow(blankRow())} title="Add a badge that isn't in the CSV">
          + Manual entry
        </button>
      </div>

      <div
        className="table"
        tabIndex={0}
        onKeyDown={onKeyDown}
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        aria-label="Rows. Arrow keys move, Space selects, Enter prints."
      >
        <div className="table-head" style={{ gridTemplateColumns: cols }}>
          <span>
            <input
              type="checkbox"
              checked={allSelected}
              title="Select all shown"
              onChange={() => useStore.getState().setSelected(allSelected ? [] : rows.map((r) => r.key))}
            />
          </span>
          <span title="Printed">✓</span>
          {csv.headers.map((h) => (
            <span key={h} title={h}>
              {h}
            </span>
          ))}
        </div>
        <div style={{ height: rows.length * ROW_HEIGHT, position: 'relative' }}>
          {visible.map((r, i) => (
            <div
              key={r.key}
              className={`table-row${r.key === focusedKey ? ' focused' : ''}${selectedKeys.has(r.key) ? ' selected' : ''}${printed[r.key] ? ' printed' : ''}`}
              style={{ top: (start + i) * ROW_HEIGHT, height: ROW_HEIGHT, gridTemplateColumns: cols }}
              onClick={() => useStore.getState().setFocused(r.key)}
              onDoubleClick={() => printOne(r)}
            >
              <span onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedKeys.has(r.key)}
                  onChange={() => useStore.getState().toggleSelected(r.key)}
                />
              </span>
              <span className="printed-mark" title={printed[r.key] ? `Printed ${new Date(printed[r.key]).toLocaleString()}` : ''}>
                {printed[r.key] ? '✓' : ''}
              </span>
              {csv.headers.map((h) => (
                <span key={h} title={r.values[h]}>
                  {r.values[h]}
                </span>
              ))}
            </div>
          ))}
        </div>
        {rows.length === 0 && <p className="muted table-empty">No rows match.</p>}
      </div>
    </>
  )
}
