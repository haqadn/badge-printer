// SPDX-License-Identifier: GPL-3.0-or-later
import { memo, useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react'
import { interpolate, matches } from '@shared/interpolate'
import { backLayout, pieceSize } from '@shared/template'
import type { Field, QrField, Row, SideLayout, Template, TextField } from '@shared/types'
import { fontsVersion, onFontsChanged } from '@/io/fonts'
import { fitText } from './fit'
import { qrPath } from './qr'

export type Side = 'front' | 'back'

interface BadgeProps {
  template: Template
  side: Side
  row: Row
  mapping?: Record<string, string>
  /** Object URL of the stock image, drawn as a guide behind the fields. Never printed. */
  stockUrl?: string | null
  /** Called with the ids of fields whose text overflowed. */
  onOverflow?: (fieldIds: string[]) => void
  /** Draws a faint outline for every field box (designer / preview aid). */
  outlines?: boolean
  className?: string
  style?: CSSProperties
}

export function layoutFor(t: Template, side: Side): SideLayout {
  return side === 'front' ? t.front : backLayout(t)
}

const justify = { left: 'flex-start', center: 'center', right: 'flex-end' } as const
const align = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const

function boxStyle(f: Field): CSSProperties {
  return {
    position: 'absolute',
    left: `${f.box.x}mm`,
    top: `${f.box.y}mm`,
    width: `${f.box.w}mm`,
    height: `${f.box.h}mm`,
    display: 'flex',
    justifyContent: justify[f.hAlign],
    alignItems: align[f.vAlign],
    overflow: 'hidden'
  }
}

export const Badge = memo(function Badge({
  template,
  side,
  row,
  mapping,
  stockUrl,
  onOverflow,
  outlines,
  className,
  style
}: BadgeProps) {
  const layout = layoutFor(template, side)
  const overflowed = useRef(new Set<string>())
  const report = (id: string, over: boolean): void => {
    const set = overflowed.current
    const had = set.has(id)
    if (over === had) return
    if (over) set.add(id)
    else set.delete(id)
    onOverflow?.([...set])
  }

  const visible = layout.fields.filter((f) => matches(f.showIf, row, mapping))
  useLayoutEffect(() => {
    // Forget fields that are no longer drawn.
    const ids = new Set(visible.map((f) => f.id))
    let changed = false
    for (const id of overflowed.current) {
      if (!ids.has(id)) {
        overflowed.current.delete(id)
        changed = true
      }
    }
    if (changed) onOverflow?.([...overflowed.current])
  })

  return (
    <div
      className={`badge ${className ?? ''}`}
      style={{
        position: 'relative',
        width: `${template.size.w}mm`,
        height: `${template.size.h}mm`,
        overflow: 'hidden',
        backgroundColor: stockUrl ? undefined : 'white',
        backgroundImage: stockUrl ? `url("${stockUrl}")` : undefined,
        backgroundSize: '100% 100%',
        ...style
      }}
    >
      {visible.map((f) =>
        f.type === 'text' ? (
          <TextFieldView key={f.id} field={f} row={row} mapping={mapping} outline={outlines} onOverflow={report} />
        ) : (
          <QrFieldView key={f.id} field={f} row={row} mapping={mapping} outline={outlines} />
        )
      )}
    </div>
  )
})

function applyTransform(text: string, t: TextField['transform']): string {
  switch (t) {
    case 'uppercase':
      return text.toUpperCase()
    case 'lowercase':
      return text.toLowerCase()
    default:
      return text
  }
}

function TextFieldView({
  field: f,
  row,
  mapping,
  outline,
  onOverflow
}: {
  field: TextField
  row: Row
  mapping?: Record<string, string>
  outline?: boolean
  onOverflow: (id: string, over: boolean) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const fv = useSyncExternalStore(onFontsChanged, fontsVersion)
  const text = applyTransform(interpolate(f.content, row, mapping), f.transform)

  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    const res = fitText(box, inner, f)
    onOverflow(f.id, res.overflow && text.trim() !== '')
  }, [text, f, fv])

  return (
    <div ref={boxRef} className={outline ? 'field-outline' : undefined} style={boxStyle(f)}>
      <div
        ref={innerRef}
        style={{
          width: '100%',
          textAlign: f.hAlign,
          fontFamily: f.fontFamily,
          fontWeight: f.fontWeight,
          fontStyle: f.italic ? 'italic' : 'normal',
          color: f.color,
          lineHeight: f.lineHeight,
          letterSpacing: f.letterSpacing ? `${f.letterSpacing}em` : undefined,
          textTransform: f.transform === 'capitalize' ? 'capitalize' : undefined,
          whiteSpace: 'pre-wrap',
          wordBreak: 'normal'
          // font size, line clamp and wrapping are set by fitText()
        }}
      >
        {text}
      </div>
    </div>
  )
}

function QrFieldView({
  field: f,
  row,
  mapping,
  outline
}: {
  field: QrField
  row: Row
  mapping?: Record<string, string>
  outline?: boolean
}) {
  const text = interpolate(f.content, row, mapping)
  const qr = qrPath(text, f.errorCorrection, f.margin)
  const side = Math.min(f.box.w, f.box.h)
  return (
    <div className={outline ? 'field-outline' : undefined} style={boxStyle(f)}>
      {qr && (
        <svg
          width={`${side}mm`}
          height={`${side}mm`}
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          shapeRendering="crispEdges"
          style={{ display: 'block', flex: 'none' }}
        >
          {f.background !== 'transparent' && <rect width={qr.size} height={qr.size} fill={f.background} />}
          <path d={qr.d} fill={f.color} />
        </svg>
      )}
    </div>
  )
}

/**
 * One printable piece of stock. With fold mode on, it holds the front and the back
 * side by side (or stacked, with the back turned 180° so it reads upright once folded).
 */
export function Piece({
  template,
  row,
  mapping,
  offset
}: {
  template: Template
  row: Row
  mapping?: Record<string, string>
  offset?: { x: number; y: number }
}) {
  const piece = pieceSize(template)
  const { w, h } = template.size
  const fold = template.back.enabled
  const translate = offset && (offset.x || offset.y) ? `translate(${offset.x}mm, ${offset.y}mm)` : undefined
  return (
    <div className="piece" style={{ width: `${piece.w}mm`, height: `${piece.h}mm`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: translate }}>
        <Badge template={template} side="front" row={row} mapping={mapping} style={{ position: 'absolute', left: 0, top: 0 }} />
        {fold && (
          <Badge
            template={template}
            side="back"
            row={row}
            mapping={mapping}
            style={{
              position: 'absolute',
              left: template.back.foldEdge === 'right' ? `${w}mm` : 0,
              top: template.back.foldEdge === 'bottom' ? `${h}mm` : 0,
              transform: template.back.foldEdge === 'bottom' ? 'rotate(180deg)' : undefined
            }}
          />
        )}
      </div>
    </div>
  )
}
