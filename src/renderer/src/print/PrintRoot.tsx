// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState } from 'react'
import type { RenderBatch } from '@shared/ipc'
import { pieceSize } from '@shared/template'
import { Piece } from '@/badge/Badge'
import { registerFonts } from '@/io/fonts'

/**
 * Lives in the hidden print window. Lays out one batch at a time and tells the main
 * process when every badge is fitted and ready to be spooled.
 */
export default function PrintRoot() {
  const [batch, setBatch] = useState<RenderBatch | null>(null)

  useEffect(
    () =>
      window.badge.onRenderBatch((b) => {
        void registerFonts(b.fonts).then((errors) => {
          if (errors.length) window.badge.batchReady(b.batchId, errors.join(' '))
          else setBatch(b)
        })
      }),
    []
  )

  useEffect(() => {
    if (!batch) return
    // Child layout effects (text fitting) have run by now; give the browser one more
    // turn to settle images and layout before reporting ready.
    const t = setTimeout(() => window.badge.batchReady(batch.batchId), 50)
    return () => clearTimeout(t)
  }, [batch])

  if (!batch) return null
  const size = pieceSize(batch.template)
  return (
    <>
      <style>{`@page { size: ${size.w}mm ${size.h}mm; margin: 0; }`}</style>
      {batch.rows.map((row, i) => (
        <div className="print-page" key={`${batch.batchId}-${i}`}>
          <Piece template={batch.template} row={row} mapping={batch.mapping} offset={batch.offset} />
        </div>
      ))}
    </>
  )
}
