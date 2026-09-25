// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { matches } from '@shared/interpolate'
import type { Field } from '@shared/types'
import { Badge, layoutFor } from '@/badge/Badge'
import { usePreviewRow } from '@/store/actions'
import { editableLayout, useStore } from '@/store/store'
import { dragBox, snapTargets, type Guides, type Handle } from './snap'

const PX_PER_MM = 96 / 25.4
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export default function Canvas() {
  const template = useStore((s) => s.template)
  const side = useStore((s) => s.side)
  const selectedId = useStore((s) => s.selectedId)
  const assetUrls = useStore((s) => s.assetUrls)
  const mapping = useStore((s) => s.mapping)
  const row = usePreviewRow()
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [fitZoom, setFitZoom] = useState(1)
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] })
  const [overflowIds, setOverflowIds] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const mirrored = side === 'back' && template.back.source === 'mirror'
  const layout = layoutFor(template, side)
  const editable = editableLayout(template, side)
  const stock = side === 'front' ? template.front.stock : template.back.layout.stock
  const z = zoom === 'fit' ? fitZoom : zoom
  const scale = PX_PER_MM * z

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = (): void => {
      const pad = 64
      const zx = (el.clientWidth - pad) / (template.size.w * PX_PER_MM)
      const zy = (el.clientHeight - pad) / (template.size.h * PX_PER_MM)
      setFitZoom(Math.max(0.2, Math.min(zx, zy)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [template.size.w, template.size.h])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select')) return
      const s = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      if (!s.selectedId) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteField(s.selectedId)
        return
      }
      if (e.key === 'Escape') {
        s.select(null)
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateField(s.selectedId)
        return
      }
      const step = e.shiftKey ? 5 : 0.5
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
      if (delta) {
        e.preventDefault()
        s.updateField(s.selectedId, (f) => {
          if (f.locked) return
          f.box.x = Math.round((f.box.x + delta[0]) * 10) / 10
          f.box.y = Math.round((f.box.y + delta[1]) * 10) / 10
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startDrag = (e: ReactPointerEvent, field: Field, handle: Handle): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const s = useStore.getState()
    s.select(field.id)
    if (field.locked) return
    s.checkpoint()
    const startX = e.clientX
    const startY = e.clientY
    const start = { ...field.box }
    const others = editable.fields.filter((f) => f.id !== field.id).map((f) => f.box)
    const targets = snapTargets(template.size, others)
    const threshold = 6 / scale

    const onMove = (ev: PointerEvent): void => {
      const res = dragBox(
        start,
        handle,
        (ev.clientX - startX) / scale,
        (ev.clientY - startY) / scale,
        ev.altKey ? null : targets,
        threshold
      )
      setGuides(res.guides)
      useStore.getState().updateField(field.id, (f) => (f.box = res.box), { transient: true })
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setGuides({ x: [], y: [] })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="canvas-area">
      <div className="canvas-bar">
        <span className="segmented">
          {(['front', 'back'] as const).map((sd) => (
            <button
              key={sd}
              aria-pressed={side === sd}
              disabled={sd === 'back' && !template.back.enabled}
              title={sd === 'back' && !template.back.enabled ? 'Turn on the back side in Template settings' : undefined}
              onClick={() => useStore.getState().setSide(sd)}
            >
              {sd === 'front' ? 'Front' : 'Back'}
            </button>
          ))}
        </span>
        {mirrored && <span className="notice">The back mirrors the front. Switch the back to “Custom layout” to edit it separately.</span>}
        {overflowIds.length > 0 && (
          <span className="notice warn">
            {overflowIds.length === 1 ? '1 field doesn’t' : `${overflowIds.length} fields don’t`} fit for this row
          </span>
        )}
        <span className="spacer" />
        <button onClick={() => setZoom(Math.max(0.2, z / 1.25))} title="Zoom out">
          −
        </button>
        <button onClick={() => setZoom('fit')} title="Fit to window" className="zoom-label">
          {Math.round(z * 100)}%
        </button>
        <button onClick={() => setZoom(Math.min(8, z * 1.25))} title="Zoom in">
          +
        </button>
      </div>
      <div
        className="canvas-scroll"
        ref={scrollRef}
        onPointerDown={() => useStore.getState().select(null)}
        onWheel={(e) => {
          if (!e.ctrlKey) return
          setZoom(Math.min(8, Math.max(0.2, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))))
        }}
      >
        <div className="canvas-stage" style={{ width: template.size.w * scale, height: template.size.h * scale }}>
          <div style={{ transform: `scale(${z})`, transformOrigin: '0 0' }}>
            <Badge
              template={template}
              side={side}
              row={row}
              mapping={mapping}
              stockUrl={stock ? assetUrls[stock] : null}
              onOverflow={setOverflowIds}
              className="canvas-badge"
            />
          </div>
          <div className="overlay">
            {layout.fields.map((f) => {
              const selected = f.id === selectedId
              const hidden = !matches(f.showIf, row, mapping)
              const over = overflowIds.includes(f.id)
              return (
                <div
                  key={f.id}
                  className={`field-box${selected ? ' selected' : ''}${hidden ? ' hidden' : ''}${over ? ' overflow' : ''}${f.locked ? ' locked' : ''}`}
                  style={{ left: f.box.x * scale, top: f.box.y * scale, width: f.box.w * scale, height: f.box.h * scale }}
                  onPointerDown={mirrored ? undefined : (e) => startDrag(e, f, 'move')}
                  title={hidden ? `${f.name} (hidden for this row)` : f.name}
                >
                  {selected && <span className="field-tag">{f.name}</span>}
                  {selected &&
                    !f.locked &&
                    !mirrored &&
                    HANDLES.map((h) => (
                      <span key={h} className={`handle handle-${h}`} onPointerDown={(e) => startDrag(e, f, h)} />
                    ))}
                </div>
              )
            })}
            {guides.x.map((gx, i) => (
              <div key={`x${i}`} className="guide guide-v" style={{ left: gx * scale }} />
            ))}
            {guides.y.map((gy, i) => (
              <div key={`y${i}`} className="guide guide-h" style={{ top: gy * scale }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function deleteField(id: string): void {
  useStore.getState().update((t) => {
    t.front.fields = t.front.fields.filter((f) => f.id !== id)
    t.back.layout.fields = t.back.layout.fields.filter((f) => f.id !== id)
  })
  useStore.getState().select(null)
}

export function duplicateField(id: string): void {
  const s = useStore.getState()
  const layout = editableLayout(s.template, s.side)
  const src = layout.fields.find((f) => f.id === id)
  if (!src) return
  const copy: Field = { ...structuredClone(src), id: Math.random().toString(36).slice(2, 10), name: `${src.name} copy` }
  copy.box.x += 3
  copy.box.y += 3
  s.update((t) => editableLayout(t, s.side).fields.push(copy))
  s.select(copy.id)
}
