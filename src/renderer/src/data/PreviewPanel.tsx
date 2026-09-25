// SPDX-License-Identifier: GPL-3.0-or-later
import { useLayoutEffect, useRef, useState } from 'react'
import { Badge } from '@/badge/Badge'
import { useStore } from '@/store/store'
import { loadSettings, startPrint } from '@/print/printing'

const PX_PER_MM = 96 / 25.4

export default function PreviewPanel({ onPrint }: { onPrint: (keys: string[], label: string) => void }) {
  const template = useStore((s) => s.template)
  const mapping = useStore((s) => s.mapping)
  const assetUrls = useStore((s) => s.assetUrls)
  const headers = useStore((s) => s.csv?.headers ?? [])
  const row = useStore((s) => s.csv?.rows.find((r) => r.key === s.focusedKey) ?? null)
  const printedAt = useStore((s) => (row ? s.printed[row.key] : undefined))
  const [frontOver, setFrontOver] = useState<string[]>([])
  const [backOver, setBackOver] = useState<string[]>([])
  const [width, setWidth] = useState(360)
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!row) {
    return (
      <div className="preview-panel" ref={ref}>
        <p className="muted">Click a row, or use the arrow keys in the list, to preview its badge.</p>
      </div>
    )
  }

  const sides = template.back.enabled ? (['front', 'back'] as const) : (['front'] as const)
  const inner = width - 24 // panel padding
  const perSide = sides.length === 2 ? (inner - 12) / 2 : inner
  const zoom = Math.min(perSide / (template.size.w * PX_PER_MM), 520 / (template.size.h * PX_PER_MM))
  const overflowNames = [...new Set([...frontOver, ...backOver])].map(
    (id) => [...template.front.fields, ...template.back.layout.fields].find((f) => f.id === id)?.name ?? id
  )

  const print = (): void => {
    const settings = loadSettings()
    if (settings.target === 'printer' && settings.printer) void startPrint([row.key], settings, true)
    else onPrint([row.key], 'this badge')
  }

  return (
    <div className="preview-panel" ref={ref}>
      <div className="preview-sides">
        {sides.map((side) => (
          <figure key={side}>
            <div style={{ width: template.size.w * PX_PER_MM * zoom, height: template.size.h * PX_PER_MM * zoom }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
                <Badge
                  template={template}
                  side={side}
                  row={row.values}
                  mapping={mapping}
                  stockUrl={(() => {
                    const stock = side === 'front' ? template.front.stock : template.back.layout.stock
                    return stock ? assetUrls[stock] : null
                  })()}
                  onOverflow={side === 'front' ? setFrontOver : setBackOver}
                  className="preview-badge"
                />
              </div>
            </div>
            {sides.length > 1 && <figcaption>{side === 'front' ? 'Front' : 'Back'}</figcaption>}
          </figure>
        ))}
      </div>

      {overflowNames.length > 0 && (
        <p className="banner warn small">Doesn’t fit at the minimum size: {overflowNames.join(', ')}</p>
      )}

      <div className="button-row">
        <button className="primary" onClick={print} title="Enter or double-click a row">
          Print this badge
        </button>
        {printedAt ? (
          <button className="link" onClick={() => useStore.getState().clearPrinted([row.key])}>
            Printed {new Date(printedAt).toLocaleTimeString()} — undo
          </button>
        ) : (
          <button className="link" onClick={() => useStore.getState().markPrinted([row.key])}>
            Mark printed
          </button>
        )}
      </div>

      <details className="row-editor" open>
        <summary>Row values</summary>
        <p className="muted small">Edits apply to this session only; the CSV file isn’t changed.</p>
        {headers.map((h) => (
          <label key={h} className="form-row">
            <span className="form-label" title={h}>
              {h}
            </span>
            <input
              type="text"
              value={row.values[h] ?? ''}
              onChange={(e) => useStore.getState().editRow(row.key, { ...row.values, [h]: e.target.value })}
            />
          </label>
        ))}
      </details>
    </div>
  )
}
