// SPDX-License-Identifier: GPL-3.0-or-later
import type { BadgeApi } from '../shared/ipc'

declare global {
  interface Window {
    badge: BadgeApi
  }
}
