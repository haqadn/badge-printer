// SPDX-License-Identifier: GPL-3.0-or-later
import { newField } from '@shared/template'
import type { FieldType } from '@shared/types'
import { editableLayout, useStore } from '@/store/store'
import { Section } from '@/ui/controls'
import Canvas, { deleteField, duplicateField } from './Canvas'
import Inspector from './Inspector'
import TemplatePanel from './TemplatePanel'

export default function Designer() {
  return (
    <div className="designer">
      <aside className="sidebar left">
        <LayerList />
        <TemplatePanel />
      </aside>
      <Canvas />
      <aside className="sidebar right">
        <Inspector />
      </aside>
    </div>
  )
}

function LayerList() {
  const template = useStore((s) => s.template)
  const side = useStore((s) => s.side)
  const selectedId = useStore((s) => s.selectedId)
  const mirrored = side === 'back' && template.back.source === 'mirror'
  const fields = editableLayout(template, side).fields

  const add = (type: FieldType): void => {
    const s = useStore.getState()
    const f = newField(type, s.template)
    s.update((t) => editableLayout(t, s.side).fields.push(f))
    s.select(f.id)
  }

  const move = (id: string, dir: -1 | 1): void => {
    const s = useStore.getState()
    s.update((t) => {
      const list = editableLayout(t, s.side).fields
      const i = list.findIndex((f) => f.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return
      ;[list[i], list[j]] = [list[j], list[i]]
    })
  }

  return (
    <Section
      title={`Layers — ${side === 'front' ? 'front' : 'back'}`}
      actions={
        <span className="button-row">
          <button disabled={mirrored} onClick={() => add('text')} title="Add a text placeholder">
            + Text
          </button>
          <button disabled={mirrored} onClick={() => add('qr')} title="Add a QR code">
            + QR
          </button>
        </span>
      }
    >
      {fields.length === 0 && <p className="muted small">No fields yet.</p>}
      <ul className="layers">
        {[...fields].reverse().map((f) => (
          <li
            key={f.id}
            className={f.id === selectedId ? 'selected' : undefined}
            onClick={() => useStore.getState().select(f.id)}
          >
            <span className="layer-type">{f.type === 'qr' ? '▦' : 'T'}</span>
            <span className="layer-name">{f.name}</span>
            {f.showIf && <span className="layer-flag" title="Shown only for some rows">if</span>}
            <span className="layer-actions" onClick={(e) => e.stopPropagation()}>
              <button className="link" title="Bring forward" onClick={() => move(f.id, 1)} disabled={mirrored}>
                ↑
              </button>
              <button className="link" title="Send backward" onClick={() => move(f.id, -1)} disabled={mirrored}>
                ↓
              </button>
              <button
                className="link"
                title={f.locked ? 'Unlock' : 'Lock position'}
                disabled={mirrored}
                onClick={() => useStore.getState().updateField(f.id, (x) => (x.locked = !x.locked))}
              >
                {f.locked ? '🔒' : '🔓'}
              </button>
              <button className="link" title="Duplicate (Ctrl+D)" disabled={mirrored} onClick={() => duplicateField(f.id)}>
                ⧉
              </button>
              <button className="link" title="Delete" disabled={mirrored} onClick={() => deleteField(f.id)}>
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
