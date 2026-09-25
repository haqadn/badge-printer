// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { interpolate, matches, templateColumns, tokensIn } from '@shared/interpolate'
import { newField, newTemplate } from '@shared/template'

describe('interpolate', () => {
  const row = { 'First Name': 'Ada', Last: 'Lovelace', ID: '42' }

  it('fills placeholders from columns', () => {
    expect(interpolate('{{First Name}} {{Last}}', row)).toBe('Ada Lovelace')
  })

  it('tolerates spaces inside braces', () => {
    expect(interpolate('{{ ID }}', row)).toBe('42')
  })

  it('leaves unknown columns empty', () => {
    expect(interpolate('[{{Nope}}]', row)).toBe('[]')
  })

  it('uses the column mapping for renamed headers', () => {
    expect(interpolate('{{Name}}', { full_name: 'Grace' }, { Name: 'full_name' })).toBe('Grace')
  })

  it('lists tokens once, in order', () => {
    expect(tokensIn('{{B}} {{A}} {{B}}')).toEqual(['B', 'A'])
  })
})

describe('matches', () => {
  const row = { Type: 'Microsponsor', Note: '' }
  it('is true without a condition', () => {
    expect(matches(null, row)).toBe(true)
  })
  it('compares case-insensitively', () => {
    expect(matches({ column: 'Type', op: 'equals', value: 'microsponsor' }, row)).toBe(true)
    expect(matches({ column: 'Type', op: 'notEquals', value: 'Speaker' }, row)).toBe(true)
    expect(matches({ column: 'Type', op: 'contains', value: 'SPONSOR' }, row)).toBe(true)
    expect(matches({ column: 'Type', op: 'notContains', value: 'micro' }, row)).toBe(false)
  })
  it('checks emptiness', () => {
    expect(matches({ column: 'Note', op: 'empty', value: '' }, row)).toBe(true)
    expect(matches({ column: 'Note', op: 'notEmpty', value: '' }, row)).toBe(false)
  })
})

describe('templateColumns', () => {
  it('collects columns from content and conditions on both sides', () => {
    const t = newTemplate()
    t.front.fields = [
      newField('text', t, { content: '{{Name}}', showIf: { column: 'Type', op: 'equals', value: 'x' } }),
      newField('qr', t, { content: 'https://x.test/{{ID}}' })
    ]
    t.back.enabled = true
    t.back.source = 'custom'
    t.back.layout.fields = [newField('text', t, { content: '{{Company}}' })]
    expect(templateColumns(t).sort()).toEqual(['Company', 'ID', 'Name', 'Type'])
  })

  it('ignores a custom back layout when the back is off', () => {
    const t = newTemplate()
    t.front.fields = []
    t.back.source = 'custom'
    t.back.layout.fields = [newField('text', t, { content: '{{Company}}' })]
    expect(templateColumns(t)).toEqual([])
  })
})
