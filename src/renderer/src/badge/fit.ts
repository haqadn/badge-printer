// SPDX-License-Identifier: GPL-3.0-or-later
import { largestFitting } from '@shared/batch'
import type { TextField } from '@shared/types'

const PX_PER_PT = 96 / 72
/** Smallest size "keep shrinking" will go to. */
export const HARD_MIN_PT = 3

export interface FitResult {
  fontSize: number
  /** True when the text did not fit even at the smallest allowed size. */
  overflow: boolean
}

/**
 * Finds the largest font size at which `inner` fits inside `box` without breaking
 * the field's line limit. Mutates `inner.style.fontSize` while measuring.
 */
export function fitText(box: HTMLElement, inner: HTMLElement, f: TextField): FitResult {
  const maxW = box.clientWidth + 0.5
  const maxH = box.clientHeight + 0.5
  clearClamp(inner)

  const fits = (pt: number): boolean => {
    inner.style.fontSize = `${pt}pt`
    if (inner.scrollWidth > maxW || inner.scrollHeight > maxH) return false
    if (f.maxLines > 0) {
      const lines = Math.round(inner.scrollHeight / (pt * PX_PER_PT * f.lineHeight))
      if (lines > f.maxLines) return false
    }
    return true
  }

  const max = Math.max(f.maxFontSize, 1)
  const min = Math.min(Math.max(f.minFontSize, 1), max)
  let size = largestFitting(min, max, 0.5, fits)
  let overflow = !fits(size)

  if (overflow && f.overflow === 'shrink') {
    size = largestFitting(HARD_MIN_PT, min, 0.25, fits)
    overflow = !fits(size)
  }

  inner.style.fontSize = `${size}pt`
  if (overflow && f.overflow === 'ellipsis') {
    const byHeight = Math.max(1, Math.floor(box.clientHeight / (size * PX_PER_PT * f.lineHeight)))
    const lines = f.maxLines > 0 ? Math.min(f.maxLines, byHeight) : byHeight
    inner.style.display = '-webkit-box'
    inner.style.setProperty('-webkit-box-orient', 'vertical')
    inner.style.webkitLineClamp = String(lines)
    inner.style.overflow = 'hidden'
    inner.style.overflowWrap = 'anywhere'
  }
  return { fontSize: size, overflow }
}

function clearClamp(inner: HTMLElement): void {
  inner.style.display = ''
  inner.style.removeProperty('-webkit-box-orient')
  inner.style.webkitLineClamp = ''
  inner.style.overflow = ''
  inner.style.overflowWrap = 'normal'
}
