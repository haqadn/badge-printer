// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { chunk, largestFitting } from '@shared/batch'

describe('chunk', () => {
  it('splits into batches with a smaller last batch', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('treats sizes below 1 as 1', () => {
    expect(chunk([1, 2], 0)).toEqual([[1], [2]])
  })
  it('returns nothing for no items', () => {
    expect(chunk([], 10)).toEqual([])
  })
})

describe('largestFitting', () => {
  it('finds the largest fitting value on the step grid', () => {
    expect(largestFitting(8, 40, 0.5, (v) => v <= 23.3)).toBe(23)
  })
  it('returns max when everything fits', () => {
    expect(largestFitting(8, 40, 0.5, () => true)).toBe(40)
  })
  it('returns min when nothing fits', () => {
    expect(largestFitting(8, 40, 0.5, () => false)).toBe(8)
  })
  it('uses few measurements', () => {
    let calls = 0
    largestFitting(1, 400, 0.5, (v) => (calls++, v <= 100))
    expect(calls).toBeLessThan(15)
  })
})
