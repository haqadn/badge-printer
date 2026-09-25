// SPDX-License-Identifier: GPL-3.0-or-later
import QRCode from 'qrcode'
import type { QrErrorCorrection } from '@shared/types'

export interface QrPath {
  /** Size of the code in modules, including the quiet zone. */
  size: number
  d: string
}

const cache = new Map<string, QrPath | null>()

/** Builds an SVG path for a QR code synchronously, so badges render in one pass. */
export function qrPath(text: string, ecc: QrErrorCorrection, margin: number): QrPath | null {
  const key = `${ecc}|${margin}|${text}`
  if (cache.has(key)) return cache.get(key)!
  let result: QrPath | null = null
  if (text) {
    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: ecc })
      const n = qr.modules.size
      const data = qr.modules.data
      let d = ''
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (data[y * n + x]) d += `M${x + margin} ${y + margin}h1v1h-1z`
        }
      }
      result = { size: n + margin * 2, d }
    } catch {
      result = null
    }
  }
  if (cache.size > 2000) cache.clear()
  cache.set(key, result)
  return result
}
