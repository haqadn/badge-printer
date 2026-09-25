// SPDX-License-Identifier: GPL-3.0-or-later
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { normalizeTemplate } from '@shared/template'
import type { Template, TemplatePackage } from '@shared/types'

/**
 * A `.badge` file is a zip holding `template.json` plus an `assets/` folder with the
 * stock design images and embedded fonts, so a template is one portable file.
 */
export function packTemplate(template: Template, assets: Record<string, Uint8Array>): Uint8Array {
  const used = usedAssets(template)
  const files: Record<string, Uint8Array> = {
    'template.json': strToU8(JSON.stringify(template, null, 2))
  }
  for (const name of used) {
    if (assets[name]) files[`assets/${name}`] = assets[name]
  }
  return zipSync(files, { level: 6 })
}

export function unpackTemplate(bytes: Uint8Array): TemplatePackage {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error('This file is not a badge template.')
  }
  const json = files['template.json']
  if (!json) throw new Error('The template file is missing template.json.')
  const template = normalizeTemplate(JSON.parse(strFromU8(json)))
  const assets: Record<string, Uint8Array> = {}
  for (const [path, data] of Object.entries(files)) {
    if (path.startsWith('assets/') && path.length > 7) assets[path.slice(7)] = data
  }
  return { template, assets }
}

export function usedAssets(t: Template): string[] {
  const names = [t.front.stock, t.back.layout.stock, ...t.fonts.map((f) => f.asset)]
  return [...new Set(names.filter((n): n is string => !!n))]
}

/** Picks an asset name that does not collide with existing ones. */
export function uniqueAssetName(name: string, existing: Record<string, unknown>): string {
  const clean = name.replace(/[^\w.-]+/g, '_') || 'file'
  if (!existing[clean]) return clean
  const dot = clean.lastIndexOf('.')
  const stem = dot > 0 ? clean.slice(0, dot) : clean
  const ext = dot > 0 ? clean.slice(dot) : ''
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}${ext}`
    if (!existing[candidate]) return candidate
  }
}

export function mimeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}
