// SPDX-License-Identifier: GPL-3.0-or-later
import { useRef } from 'react'
import { templateColumns } from '@shared/interpolate'
import type { Condition, ConditionOp, Field, QrField, TextField } from '@shared/types'
import { NumberInput, Row, Section, Segmented, Select, TextInput } from '@/ui/controls'
import { findField, useStore } from '@/store/store'

const FONT_SUGGESTIONS = [
  'Helvetica, Arial, sans-serif',
  'Inter, sans-serif',
  'Roboto, sans-serif',
  'Open Sans, sans-serif',
  'Montserrat, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Courier New, monospace'
]

const OPS: { value: ConditionOp; label: string }[] = [
  { value: 'equals', label: 'is' },
  { value: 'notEquals', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'does not contain' },
  { value: 'notEmpty', label: 'is not empty' },
  { value: 'empty', label: 'is empty' }
]

export function useKnownColumns(): string[] {
  const headers = useStore((s) => s.csv?.headers)
  const template = useStore((s) => s.template)
  return [...new Set([...(headers ?? []), ...Object.keys(template.sampleRow), ...templateColumns(template)])]
}

export default function Inspector() {
  const selectedId = useStore((s) => s.selectedId)
  const field = useStore((s) => findField(s.template, s.selectedId))
  const updateField = useStore((s) => s.updateField)

  if (!field || !selectedId) {
    return (
      <div className="inspector empty">
        <p className="muted">Select a field on the badge to edit it, or add one from the Layers panel.</p>
        <p className="muted small">
          Tips: drag to move, drag the handles to set the area text can grow into. Hold <kbd>Alt</kbd> to turn
          off snapping. Arrow keys nudge by 0.5 mm (<kbd>Shift</kbd> for 5 mm).
        </p>
      </div>
    )
  }

  const set = (fn: (f: Field) => void): void => updateField(selectedId, fn)

  return (
    <div className="inspector">
      <Section title={field.type === 'qr' ? 'QR code' : 'Text'}>
        <Row label="Name">
          <TextInput value={field.name} onChange={(v) => set((f) => (f.name = v))} />
        </Row>
        <ContentEditor field={field} onChange={(v) => set((f) => (f.content = v))} />
      </Section>

      <Section title="Area">
        <div className="grid-2">
          <Row label="X">
            <NumberInput value={field.box.x} suffix="mm" onChange={(v) => set((f) => (f.box.x = v))} />
          </Row>
          <Row label="Y">
            <NumberInput value={field.box.y} suffix="mm" onChange={(v) => set((f) => (f.box.y = v))} />
          </Row>
          <Row label="Width">
            <NumberInput value={field.box.w} min={2} suffix="mm" onChange={(v) => set((f) => (f.box.w = v))} />
          </Row>
          <Row label="Height">
            <NumberInput value={field.box.h} min={2} suffix="mm" onChange={(v) => set((f) => (f.box.h = v))} />
          </Row>
        </div>
        <Row button label="Horizontal">
          <Segmented
            value={field.hAlign}
            onChange={(v) => set((f) => (f.hAlign = v))}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' }
            ]}
          />
        </Row>
        <Row button label="Vertical">
          <Segmented
            value={field.vAlign}
            onChange={(v) => set((f) => (f.vAlign = v))}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'middle', label: 'Middle' },
              { value: 'bottom', label: 'Bottom' }
            ]}
          />
        </Row>
      </Section>

      {field.type === 'text' ? <TextProps field={field} set={set} /> : <QrProps field={field} set={set} />}

      <ConditionEditor value={field.showIf} onChange={(c) => set((f) => (f.showIf = c))} />
    </div>
  )
}

function ContentEditor({ field, onChange }: { field: Field; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const columns = useKnownColumns()

  const insert = (col: string): void => {
    const el = ref.current
    const token = `{{${col}}}`
    if (!el) return onChange(field.content + token)
    const start = el.selectionStart ?? field.content.length
    const end = el.selectionEnd ?? start
    onChange(field.content.slice(0, start) + token + field.content.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + token.length
    })
  }

  return (
    <div className="content-editor">
      <span className="form-label">{field.type === 'qr' ? 'QR content' : 'Content'}</span>
      <textarea
        ref={ref}
        rows={field.type === 'qr' ? 2 : 3}
        value={field.content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="{{Column name}}"
        spellCheck={false}
      />
      <div className="chips" aria-label="Insert column">
        {columns.map((c) => (
          <button key={c} type="button" className="chip" onClick={() => insert(c)} title={`Insert {{${c}}}`}>
            {c}
          </button>
        ))}
        {columns.length === 0 && <span className="muted small">Load a CSV to see its columns here.</span>}
      </div>
    </div>
  )
}

function TextProps({ field, set }: { field: TextField; set: (fn: (f: Field) => void) => void }) {
  const fonts = useStore((s) => s.template.fonts)
  const setText = (fn: (f: TextField) => void): void => set((f) => fn(f as TextField))
  const families = [...new Set([...fonts.map((f) => f.family), ...FONT_SUGGESTIONS])]
  return (
    <Section title="Typography">
      <Row label="Font">
        <input
          type="text"
          list="font-families"
          value={field.fontFamily}
          onChange={(e) => setText((f) => (f.fontFamily = e.target.value))}
        />
        <datalist id="font-families">
          {families.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </Row>
      <div className="grid-2">
        <Row label="Weight">
          <Select
            value={String(field.fontWeight)}
            onChange={(v) => setText((f) => (f.fontWeight = Number(v)))}
            options={[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }))}
          />
        </Row>
        <Row label="Color">
          <input type="color" value={field.color} onChange={(e) => setText((f) => (f.color = e.target.value))} />
        </Row>
        <Row label="Max size" hint="The largest font size used when the text is short">
          <NumberInput
            value={field.maxFontSize}
            min={1}
            max={400}
            step={0.5}
            suffix="pt"
            onChange={(v) => setText((f) => ((f.maxFontSize = v), (f.minFontSize = Math.min(f.minFontSize, v))))}
          />
        </Row>
        <Row label="Min size" hint="The text shrinks down to this size before the overflow rule applies">
          <NumberInput
            value={field.minFontSize}
            min={1}
            max={400}
            step={0.5}
            suffix="pt"
            onChange={(v) => setText((f) => ((f.minFontSize = v), (f.maxFontSize = Math.max(f.maxFontSize, v))))}
          />
        </Row>
        <Row label="Max lines" hint="0 = as many lines as fit">
          <NumberInput value={field.maxLines} min={0} max={50} step={1} onChange={(v) => setText((f) => (f.maxLines = Math.round(v)))} />
        </Row>
        <Row label="Line height">
          <NumberInput value={field.lineHeight} min={0.6} max={3} step={0.05} onChange={(v) => setText((f) => (f.lineHeight = v))} />
        </Row>
        <Row label="Spacing" hint="Letter spacing, in em">
          <NumberInput value={field.letterSpacing} min={-0.2} max={1} step={0.01} suffix="em" onChange={(v) => setText((f) => (f.letterSpacing = v))} />
        </Row>
        <Row label="Italic">
          <input type="checkbox" checked={field.italic} onChange={(e) => setText((f) => (f.italic = e.target.checked))} />
        </Row>
      </div>
      <Row label="Case">
        <Select
          value={field.transform}
          onChange={(v) => setText((f) => (f.transform = v))}
          options={[
            { value: 'none', label: 'As in CSV' },
            { value: 'uppercase', label: 'UPPERCASE' },
            { value: 'lowercase', label: 'lowercase' },
            { value: 'capitalize', label: 'Capitalize Each Word' }
          ]}
        />
      </Row>
      <Row label="If too long" hint="What happens when the text doesn’t fit even at the minimum size">
        <Select
          value={field.overflow}
          onChange={(v) => setText((f) => (f.overflow = v))}
          options={[
            { value: 'shrink', label: 'Keep shrinking' },
            { value: 'ellipsis', label: 'Cut off with …' },
            { value: 'clip', label: 'Clip at the edge' }
          ]}
        />
      </Row>
    </Section>
  )
}

function QrProps({ field, set }: { field: QrField; set: (fn: (f: Field) => void) => void }) {
  const setQr = (fn: (f: QrField) => void): void => set((f) => fn(f as QrField))
  return (
    <Section title="QR code">
      <Row label="Error correction" hint="Higher levels survive more damage but make a denser code">
        <Select
          value={field.errorCorrection}
          onChange={(v) => setQr((f) => (f.errorCorrection = v))}
          options={[
            { value: 'L', label: 'Low (7%)' },
            { value: 'M', label: 'Medium (15%)' },
            { value: 'Q', label: 'Quartile (25%)' },
            { value: 'H', label: 'High (30%)' }
          ]}
        />
      </Row>
      <div className="grid-2">
        <Row label="Color">
          <input type="color" value={field.color} onChange={(e) => setQr((f) => (f.color = e.target.value))} />
        </Row>
        <Row label="White background">
          <input
            type="checkbox"
            checked={field.background !== 'transparent'}
            onChange={(e) => setQr((f) => (f.background = e.target.checked ? '#ffffff' : 'transparent'))}
          />
        </Row>
        <Row label="Quiet zone" hint="Blank border around the code, in modules. Scanners need about 2–4.">
          <NumberInput value={field.margin} min={0} max={8} step={1} onChange={(v) => setQr((f) => (f.margin = Math.round(v)))} />
        </Row>
      </div>
      <p className="muted small">The code is drawn as a square the size of the shorter side of the area.</p>
    </Section>
  )
}

function ConditionEditor({ value, onChange }: { value: Condition | null; onChange: (c: Condition | null) => void }) {
  const columns = useKnownColumns()
  return (
    <Section title="Show only when">
      <Row label="Condition">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked ? { column: columns[0] ?? '', op: 'equals', value: '' } : null)}
        />
      </Row>
      {value && (
        <>
          <Row label="Column">
            <input
              type="text"
              list="known-columns"
              value={value.column}
              onChange={(e) => onChange({ ...value, column: e.target.value })}
            />
            <datalist id="known-columns">
              {columns.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Row>
          <Row label="Rule">
            <Select value={value.op} options={OPS} onChange={(op) => onChange({ ...value, op })} />
          </Row>
          {value.op !== 'empty' && value.op !== 'notEmpty' && (
            <Row label="Value">
              <TextInput value={value.value} onChange={(v) => onChange({ ...value, value: v })} />
            </Row>
          )}
          <p className="muted small">Matching ignores upper/lower case.</p>
        </>
      )}
    </Section>
  )
}
