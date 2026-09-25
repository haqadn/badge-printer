// SPDX-License-Identifier: GPL-3.0-or-later
import type { FontPayload } from '@shared/ipc'

const loaded = new Map<string, FontFace>()
const listeners = new Set<() => void>()
let version = 0

export function fontsVersion(): number {
  return version
}

export function onFontsChanged(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function bump(): void {
  version++
  for (const cb of listeners) cb()
}

function fontKey(f: FontPayload): string {
  return `${f.family}|${f.weight}|${f.italic}|${f.bytes.byteLength}`
}

/** Registers embedded template fonts with the document. Resolves once all are usable. */
export async function registerFonts(fonts: FontPayload[]): Promise<string[]> {
  const errors: string[] = []
  let added = false
  for (const f of fonts) {
    const key = fontKey(f)
    if (loaded.has(key)) continue
    try {
      const face = new FontFace(f.family, f.bytes.slice().buffer as ArrayBuffer, {
        weight: String(f.weight),
        style: f.italic ? 'italic' : 'normal'
      })
      await face.load()
      document.fonts.add(face)
      loaded.set(key, face)
      added = true
    } catch {
      errors.push(`Could not load font “${f.family}”.`)
    }
  }
  await document.fonts.ready
  if (added) bump()
  return errors
}
