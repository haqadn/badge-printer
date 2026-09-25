// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { parseCsv, suggestMapping } from '@/io/csv'

describe('parseCsv', () => {
  it('reads headers and trims values', () => {
    const csv = parseCsv('﻿Name, ID ,Type\n Ada ,1,Speaker\n\nBob,2,"Attendee, VIP"\n', 'a.csv')
    expect(csv.headers).toEqual(['Name', 'ID', 'Type'])
    expect(csv.rows.map((r) => r.values)).toEqual([
      { Name: 'Ada', ID: '1', Type: 'Speaker' },
      { Name: 'Bob', ID: '2', Type: 'Attendee, VIP' }
    ])
  })

  it('gives identical rows distinct but stable keys', () => {
    const a = parseCsv('Name\nAda\nAda\n', 'a.csv')
    const b = parseCsv('Name\nAda\nAda\n', 'b.csv')
    expect(a.rows[0].key).not.toBe(a.rows[1].key)
    expect(a.rows.map((r) => r.key)).toEqual(b.rows.map((r) => r.key))
  })

  it('keeps a row key when columns are reordered', () => {
    const a = parseCsv('Name,ID\nAda,1\n', 'a.csv')
    const b = parseCsv('ID,Name\n1,Ada\n', 'b.csv')
    expect(a.rows[0].key).toBe(b.rows[0].key)
  })

  it('fails without a header row', () => {
    expect(() => parseCsv('', 'x.csv')).toThrow(/header/)
  })
})

describe('suggestMapping', () => {
  it('matches names that differ in case and punctuation', () => {
    expect(suggestMapping(['First Name', 'ID', 'Email'], ['first_name', 'ID', 'Company'])).toEqual({
      'First Name': 'first_name'
    })
  })
})
