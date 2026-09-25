// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from 'react'
import { SIZE_PRESETS } from '@shared/template'
import { uniqueAssetName } from '@/io/templateFile'
import { FONT_FILTERS, IMAGE_FILTERS } from '@/store/actions'
import { useStore } from '@/store/store'
import { NumberInput, Row, Section, Select, TextInput } from '@/ui/controls'

export default function TemplatePanel() {
  const t = useStore((s) => s.template)
  const update = useStore((s) => s.update)
  const presetIndex = SIZE_PRESETS.findIndex((p) => Math.abs(p.w - t.size.w) < 0.05 && Math.abs(p.h - t.size.h) < 0.05)

  return (
    <>
      <Section title="Template">
        <Row label="Name">
          <TextInput value={t.name} onChange={(v) => update((d) => (d.name = v))} />
        </Row>
        <Row label="Stock size">
          <Select
            value={String(presetIndex)}
            onChange={(v) => {
              const p = SIZE_PRESETS[Number(v)]
              if (p) update((d) => (d.size = { w: p.w, h: p.h }))
            }}
            options={[
              ...SIZE_PRESETS.map((p, i) => ({ value: String(i), label: p.label })),
              { value: '-1', label: 'Custom' }
            ]}
          />
        </Row>
        <div className="grid-2">
          <Row label="Width">
            <NumberInput value={t.size.w} min={10} max={1000} suffix="mm" onChange={(v) => update((d) => (d.size.w = v))} />
          </Row>
          <Row label="Height">
            <NumberInput value={t.size.h} min={10} max={1000} suffix="mm" onChange={(v) => update((d) => (d.size.h = v))} />
          </Row>
        </div>
        <StockPicker side="front" />
      </Section>

      <Section title="Back side">
        <Row label="Print back" hint="Fold mode: both sides go on one double-length piece that you fold in half">
          <input
            type="checkbox"
            checked={t.back.enabled}
            onChange={(e) => {
              const on = e.target.checked
              update((d) => (d.back.enabled = on))
              if (!on && useStore.getState().side === 'back') useStore.getState().setSide('front')
            }}
          />
        </Row>
        {t.back.enabled && (
          <>
            <Row label="Fold">
              <Select
                value={t.back.foldEdge}
                onChange={(v) => update((d) => (d.back.foldEdge = v))}
                options={[
                  { value: 'bottom', label: 'Top/bottom (back turned 180°)' },
                  { value: 'right', label: 'Left/right' }
                ]}
              />
            </Row>
            <Row label="Layout">
              <Select
                value={t.back.source}
                onChange={(v) =>
                  update((d) => {
                    d.back.source = v
                    // Start a custom back from a copy of the front so it isn't blank.
                    if (v === 'custom' && d.back.layout.fields.length === 0) {
                      d.back.layout.fields = structuredClone(d.front.fields).map((f) => ({
                        ...f,
                        id: Math.random().toString(36).slice(2, 10)
                      }))
                    }
                  })
                }
                options={[
                  { value: 'mirror', label: 'Same as front' },
                  { value: 'custom', label: 'Custom layout' }
                ]}
              />
            </Row>
            <StockPicker side="back" />
            <p className="muted small">
              Each piece of stock is {t.back.foldEdge === 'bottom' ? `${t.size.w} × ${t.size.h * 2}` : `${t.size.w * 2} × ${t.size.h}`} mm.
            </p>
          </>
        )}
      </Section>

      <FontsSection />
      <SampleDataSection />
    </>
  )
}

function StockPicker({ side }: { side: 'front' | 'back' }) {
  const stock = useStore((s) => (side === 'front' ? s.template.front.stock : s.template.back.layout.stock))
  const url = useStore((s) => (stock ? s.assetUrls[stock] : null))

  const choose = async (): Promise<void> => {
    const file = await window.badge.openFile(IMAGE_FILTERS)
    if (!file) return
    const s = useStore.getState()
    const name = uniqueAssetName(`${side}-${file.name}`, s.assets)
    s.addAsset(name, file.bytes)
    s.update((d) => {
      if (side === 'front') d.front.stock = name
      else d.back.layout.stock = name
    })
  }

  return (
    <Row button label={side === 'front' ? 'Stock design' : 'Back design'} hint="Shown as a guide in the designer and preview. Never printed.">
      <span className="stock-picker">
        {url && <img src={url} alt="" />}
        <button onClick={() => void choose()}>{stock ? 'Replace…' : 'Choose image…'}</button>
        {stock && (
          <button
            className="link"
            title="Remove image"
            onClick={() =>
              useStore.getState().update((d) => {
                if (side === 'front') d.front.stock = null
                else d.back.layout.stock = null
              })
            }
          >
            ✕
          </button>
        )}
      </span>
    </Row>
  )
}

function FontsSection() {
  const fonts = useStore((s) => s.template.fonts)
  const update = useStore((s) => s.update)

  const add = async (): Promise<void> => {
    const file = await window.badge.openFile(FONT_FILTERS)
    if (!file) return
    const s = useStore.getState()
    const name = uniqueAssetName(file.name, s.assets)
    const family = file.name.replace(/\.[^.]+$/, '').replace(/[-_](regular|bold|italic|medium|light|black|semibold|thin)+$/i, '')
    const weight = /bold/i.test(file.name) ? 700 : /light/i.test(file.name) ? 300 : 400
    s.addAsset(name, file.bytes)
    s.update((d) => d.fonts.push({ family, weight, italic: /italic/i.test(file.name), asset: name }))
  }

  return (
    <Section title="Embedded fonts" actions={<button onClick={() => void add()}>Add…</button>}>
      {fonts.length === 0 && (
        <p className="muted small">Fonts added here are saved inside the template, so it prints the same on any computer.</p>
      )}
      {fonts.map((f, i) => (
        <div className="font-row" key={f.asset}>
          <input
            type="text"
            value={f.family}
            title="Family name to use in the Font box"
            onChange={(e) => update((d) => (d.fonts[i].family = e.target.value))}
          />
          <select value={f.weight} onChange={(e) => update((d) => (d.fonts[i].weight = Number(e.target.value)))}>
            {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <label className="inline">
            <input type="checkbox" checked={f.italic} onChange={(e) => update((d) => (d.fonts[i].italic = e.target.checked))} />
            <i>I</i>
          </label>
          <button className="link" onClick={() => update((d) => d.fonts.splice(i, 1))} title="Remove font">
            ✕
          </button>
        </div>
      ))}
    </Section>
  )
}

function SampleDataSection() {
  const sample = useStore((s) => s.template.sampleRow)
  const hasCsv = useStore((s) => !!s.csv)
  const update = useStore((s) => s.update)
  const [newCol, setNewCol] = useState('')

  return (
    <Section title="Sample data">
      <p className="muted small">
        {hasCsv
          ? 'The designer previews the row focused in Data & print.'
          : 'Used to preview the badge until you load a CSV.'}
      </p>
      {Object.entries(sample).map(([k, v]) => (
        <div className="sample-row" key={k}>
          <span className="sample-key" title={k}>
            {k}
          </span>
          <input type="text" value={v} onChange={(e) => update((d) => (d.sampleRow[k] = e.target.value))} />
          <button className="link" onClick={() => update((d) => delete d.sampleRow[k])} title="Remove column">
            ✕
          </button>
        </div>
      ))}
      <form
        className="sample-row"
        onSubmit={(e) => {
          e.preventDefault()
          const col = newCol.trim()
          if (!col) return
          update((d) => (d.sampleRow[col] = d.sampleRow[col] ?? ''))
          setNewCol('')
        }}
      >
        <input type="text" placeholder="New column name" value={newCol} onChange={(e) => setNewCol(e.target.value)} />
        <button type="submit">Add</button>
      </form>
    </Section>
  )
}
