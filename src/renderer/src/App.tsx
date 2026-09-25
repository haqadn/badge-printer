// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect } from 'react'
import { registerFonts } from './io/fonts'
import Designer from './designer/Designer'
import DataView from './data/DataView'
import { useStore } from './store/store'
import {
  fontPayloads,
  newTemplateAction,
  openCsvAction,
  openTemplateAction,
  reportError,
  saveTemplateAction
} from './store/actions'

export default function App() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const name = useStore((s) => s.template.name)
  const dirty = useStore((s) => s.dirty)
  const csv = useStore((s) => s.csv)
  const fonts = useStore((s) => s.template.fonts)
  const assets = useStore((s) => s.assets)

  useEffect(() => {
    window.badge.setTitle(`${dirty ? '• ' : ''}${name} — Badge Printer`)
  }, [name, dirty])

  useEffect(() => {
    void registerFonts(fontPayloads(useStore.getState().template, assets)).then((errs) => {
      if (errs.length) reportError(errs.join('\n'))
    })
  }, [fonts, assets])

  useEffect(
    () =>
      window.badge.onOpenPath((file) => {
        try {
          useStore.getState().loadTemplateBytes(file.bytes, file.path)
        } catch (e) {
          reportError(e)
        }
      }),
    []
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        void saveTemplateAction(e.shiftKey)
      } else if (k === 'o') {
        e.preventDefault()
        void openTemplateAction()
      } else if (k === 'n') {
        e.preventDefault()
        void newTemplateAction()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-group">
          <button onClick={() => void newTemplateAction()} title="New template (Ctrl+N)">
            New
          </button>
          <button onClick={() => void openTemplateAction()} title="Open template (Ctrl+O)">
            Open…
          </button>
          <button onClick={() => void saveTemplateAction()} title="Save template (Ctrl+S)">
            Save
          </button>
          <button onClick={() => void saveTemplateAction(true)} title="Save as (Ctrl+Shift+S)">
            Save as…
          </button>
        </div>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={view === 'design'} onClick={() => setView('design')}>
            Design
          </button>
          <button role="tab" aria-selected={view === 'data'} onClick={() => setView('data')}>
            Data &amp; print{csv ? ` (${csv.rows.length})` : ''}
          </button>
        </nav>
        <div className="toolbar-group right">
          <span className="muted">{csv ? csv.name : 'No CSV loaded'}</span>
          <button onClick={() => void openCsvAction()}>{csv ? 'Replace CSV…' : 'Load CSV…'}</button>
        </div>
      </header>
      <main className="workspace">{view === 'design' ? <Designer /> : <DataView />}</main>
    </div>
  )
}
