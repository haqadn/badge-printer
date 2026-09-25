// SPDX-License-Identifier: GPL-3.0-or-later

export function chunk<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size))
  const out: T[][] = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out
}

/**
 * Binary search for the largest value in [min, max] (in `step` increments) for which
 * `fits` returns true. Returns `min` if nothing fits, so the caller can decide how
 * to handle overflow.
 */
export function largestFitting(min: number, max: number, step: number, fits: (v: number) => boolean): number {
  if (max <= min) return min
  let lo = 0
  let hi = Math.floor((max - min) / step)
  if (fits(min + hi * step)) return min + hi * step
  let best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (fits(min + mid * step)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return min + best * step
}
