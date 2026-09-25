// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { backLayout, newField, newTemplate, normalizeTemplate, pieceSize } from '@shared/template'
import { packTemplate, uniqueAssetName, unpackTemplate } from '@/io/templateFile'

describe('pieceSize', () => {
  it('is the badge size without a back side', () => {
    expect(pieceSize(newTemplate())).toEqual({ w: 101.6, h: 152.4 })
  })
  it('doubles the height for a top/bottom fold', () => {
    const t = newTemplate()
    t.back.enabled = true
    expect(pieceSize(t)).toEqual({ w: 101.6, h: 304.8 })
  })
  it('doubles the width for a left/right fold', () => {
    const t = newTemplate()
    t.back.enabled = true
    t.back.foldEdge = 'right'
    expect(pieceSize(t)).toEqual({ w: 203.2, h: 152.4 })
  })
})

describe('backLayout', () => {
  it('mirrors front fields but keeps its own stock image', () => {
    const t = newTemplate()
    t.front.stock = 'front.png'
    t.back.layout.stock = 'back.png'
    const b = backLayout(t)
    expect(b.fields).toBe(t.front.fields)
    expect(b.stock).toBe('back.png')
  })
})

describe('normalizeTemplate', () => {
  it('rejects unknown versions', () => {
    expect(() => normalizeTemplate({ version: 99 })).toThrow(/version/)
  })
  it('fills in missing properties', () => {
    const t = normalizeTemplate({
      version: 1,
      front: { fields: [{ type: 'text', content: '{{X}}' }, { type: 'bogus' }] }
    })
    expect(t.front.fields).toHaveLength(1)
    const f = t.front.fields[0]
    expect(f.type).toBe('text')
    expect(f.content).toBe('{{X}}')
    expect(f.id).toBeTruthy()
    expect(t.back.enabled).toBe(false)
    expect(t.size.w).toBeGreaterThan(0)
  })
})

describe('template package', () => {
  it('round-trips the template and the assets it uses', () => {
    const t = newTemplate()
    t.front.stock = 'stock.png'
    t.front.fields.push(newField('qr', t))
    const assets = { 'stock.png': new Uint8Array([1, 2, 3]), 'unused.png': new Uint8Array([9]) }
    const pkg = unpackTemplate(packTemplate(t, assets))
    expect(pkg.template).toEqual(t)
    expect(Object.keys(pkg.assets)).toEqual(['stock.png'])
    expect([...pkg.assets['stock.png']]).toEqual([1, 2, 3])
  })

  it('reports a clear error for non-template files', () => {
    expect(() => unpackTemplate(new Uint8Array([1, 2, 3]))).toThrow(/not a badge template/)
  })

  it('picks unique asset names', () => {
    expect(uniqueAssetName('a b.png', {})).toBe('a_b.png')
    expect(uniqueAssetName('x.png', { 'x.png': 1, 'x-2.png': 1 })).toBe('x-3.png')
  })
})
