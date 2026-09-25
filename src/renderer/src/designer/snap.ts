// SPDX-License-Identifier: GPL-3.0-or-later
import type { Box } from '@shared/types'

export interface Guides {
  x: number[]
  y: number[]
}

export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const MIN_SIZE = 2

/** Snap lines for a badge: its edges and centre, plus every other field's edges and centre. */
export function snapTargets(size: { w: number; h: number }, others: Box[]): Guides {
  const x = [0, size.w / 2, size.w]
  const y = [0, size.h / 2, size.h]
  for (const b of others) {
    x.push(b.x, b.x + b.w / 2, b.x + b.w)
    y.push(b.y, b.y + b.h / 2, b.y + b.h)
  }
  return { x, y }
}

function nearest(values: number[], targets: number[], threshold: number): { delta: number; line: number } | null {
  let best: { delta: number; line: number } | null = null
  for (const v of values) {
    for (const t of targets) {
      const d = t - v
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, line: t }
    }
  }
  return best
}

const round = (v: number): number => Math.round(v * 10) / 10

/**
 * Applies a pointer delta (in mm) to a box for the given handle, snapping moving
 * edges to the targets when within `threshold` mm. Returns the new box and the
 * guide lines that were snapped to.
 */
export function dragBox(
  start: Box,
  handle: Handle,
  dx: number,
  dy: number,
  targets: Guides | null,
  threshold: number
): { box: Box; guides: Guides } {
  const guides: Guides = { x: [], y: [] }
  let { x, y, w, h } = start

  if (handle === 'move') {
    x += dx
    y += dy
    if (targets) {
      const sx = nearest([x, x + w / 2, x + w], targets.x, threshold)
      if (sx) {
        x += sx.delta
        guides.x.push(sx.line)
      }
      const sy = nearest([y, y + h / 2, y + h], targets.y, threshold)
      if (sy) {
        y += sy.delta
        guides.y.push(sy.line)
      }
    }
    return { box: { x: round(x), y: round(y), w, h }, guides }
  }

  let left = x
  let right = x + w
  let top = y
  let bottom = y + h
  const snap = (v: number, axis: 'x' | 'y'): number => {
    if (!targets) return v
    const s = nearest([v], targets[axis], threshold)
    if (!s) return v
    guides[axis].push(s.line)
    return v + s.delta
  }
  if (handle.includes('w')) left = Math.min(snap(left + dx, 'x'), right - MIN_SIZE)
  if (handle.includes('e')) right = Math.max(snap(right + dx, 'x'), left + MIN_SIZE)
  if (handle.includes('n')) top = Math.min(snap(top + dy, 'y'), bottom - MIN_SIZE)
  if (handle.includes('s')) bottom = Math.max(snap(bottom + dy, 'y'), top + MIN_SIZE)
  return {
    box: { x: round(left), y: round(top), w: round(right - left), h: round(bottom - top) },
    guides
  }
}
