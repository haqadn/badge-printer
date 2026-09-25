// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState } from 'react'
import type { PrinterInfo, PrintSettings } from '@shared/ipc'
import { pieceSize } from '@shared/template'
import { useStore } from '@/store/store'
import { NumberInput, Row, Segmented } from '@/ui/controls'
import { cancelPrint, dismissJob, loadSettings, saveSettings, startPrint, useJob } from './printing'

export default function PrintDialog({ keys, label, onClose }: { keys: string[]; label: string; onClose: () => void }) {
  const [settings, setSettings] = useState<PrintSettings>(loadSettings)
  const [printers, setPrinters] = useState<PrinterInfo[] | null>(null)
  const [mark, setMark] = useState(settings.target === 'printer')
  const template = useStore((s) => s.template)
  const piece = pieceSize(template)

  useEffect(() => {
    void window.badge.listPrinters().then((list) => {
      setPrinters(list)
      setSettings((s) =>
        s.printer && list.some((p) => p.name === s.printer)
          ? s
          : { ...s, printer: list.find((p) => p.isDefault)?.name ?? list[0]?.name ?? '' }
      )
    })
  }, [])

  const patch = (p: Partial<PrintSettings>): void => setSettings((s) => ({ ...s, ...p }))

  /** Settings with the chosen printer's display name, so it can be shown elsewhere. */
  const labelled = (): PrintSettings => ({
    ...settings,
    printerLabel: printers?.find((p) => p.name === settings.printer)?.displayName ?? settings.printerLabel
  })

  const go = async (): Promise<void> => {
    if (await startPrint(keys, labelled(), mark)) onClose()
  }

  const single = keys.length === 1

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Print" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Print {label}</h2>
        <p className="muted">
          {keys.length} {keys.length === 1 ? 'badge' : 'badges'} on {piece.w} × {piece.h} mm stock
          {template.back.enabled ? ' (front and back, fold mode)' : ''}.
        </p>

        <Row button label="Send to">
          <Segmented
            value={settings.target}
            onChange={(target) => {
              patch({ target })
              setMark(target === 'printer')
            }}
            options={[
              { value: 'printer', label: 'Printer' },
              { value: 'pdf', label: 'PDF file' }
            ]}
          />
        </Row>

        {settings.target === 'printer' && (
          <Row label="Printer">
            {printers === null ? (
              <span className="muted">Looking for printers…</span>
            ) : printers.length === 0 ? (
              <span className="warn-text">No printers found.</span>
            ) : (
              <select value={settings.printer} onChange={(e) => patch({ printer: e.target.value })}>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName}
                    {p.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            )}
          </Row>
        )}

        <details className="advanced" open={settings.offset.x !== 0 || settings.offset.y !== 0 || undefined}>
          <summary>Batching and alignment</summary>
          <div className="grid-2">
            <Row label="Batch size" hint="Badges sent per print job. Smaller batches use less printer and computer memory.">
              <NumberInput value={settings.batchSize} min={1} max={500} step={1} onChange={(v) => patch({ batchSize: Math.round(v) })} />
            </Row>
            <Row label="Pause" hint="Wait between batches so the printer can catch up">
              <NumberInput value={settings.pauseSeconds} min={0} max={600} step={1} suffix="s" onChange={(v) => patch({ pauseSeconds: v })} />
            </Row>
            <Row label="Shift right" hint="Moves everything to line up with pre-printed stock. Negative moves left.">
              <NumberInput value={settings.offset.x} min={-50} max={50} step={0.1} suffix="mm" onChange={(x) => patch({ offset: { ...settings.offset, x } })} />
            </Row>
            <Row label="Shift down" hint="Negative moves up.">
              <NumberInput value={settings.offset.y} min={-50} max={50} step={0.1} suffix="mm" onChange={(y) => patch({ offset: { ...settings.offset, y } })} />
            </Row>
          </div>
          <p className="muted small">
            Set the printer’s paper size to {piece.w} × {piece.h} mm with no margins (or borderless) in the system
            printer settings. Alignment shifts are remembered.
          </p>
        </details>

        <label className="inline">
          <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} /> Mark as printed
        </label>

        {single && settings.target === 'printer' && (
          <p className="muted small">
            From now on, <b>Print this badge</b>, <kbd>Enter</kbd> and double-click print straight to this printer.
            Use <b>Change…</b> under the preview to come back here.
          </p>
        )}

        <footer className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={() => {
              saveSettings(labelled())
              onClose()
            }}
            title="Keep these settings without printing"
          >
            Save settings
          </button>
          <button
            className="primary"
            disabled={keys.length === 0 || (settings.target === 'printer' && !settings.printer)}
            onClick={() => void go()}
          >
            {settings.target === 'pdf' ? 'Save PDF…' : 'Print'}
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Progress strip shown while (and after) a job runs. */
export function JobStatusBar() {
  const p = useJob((s) => s.progress)
  if (!p) return null
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
  const text = {
    running: `Printing ${p.done} of ${p.total}${p.batches > 1 ? ` — batch ${p.batch} of ${p.batches}` : ''}`,
    done: p.pdfPath ? `Saved ${p.total} badges to ${p.pdfPath}` : `Sent ${p.done} badges to the printer`,
    cancelled: `Cancelled after ${p.done} of ${p.total}`,
    failed: `Failed after ${p.done} of ${p.total}: ${p.error ?? 'unknown error'}`
  }[p.status]
  return (
    <div className={`job-bar ${p.status}`}>
      <div className="job-progress" style={{ width: `${pct}%` }} />
      <span className="job-text">{text}</span>
      {p.status === 'running' ? (
        <button onClick={cancelPrint}>Cancel</button>
      ) : (
        <button onClick={dismissJob} className="link">
          Dismiss
        </button>
      )}
    </div>
  )
}
