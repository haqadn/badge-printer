// SPDX-License-Identifier: GPL-3.0-or-later
// Regenerates the README screenshots in docs/screenshots from the example template.
//   npm run build && npm run screenshots        (on Linux without a display: xvfb-run -a npm run screenshots)
import { _electron as electron } from 'playwright-core'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const example = `${root}examples/community-conf/`
const out = `${root}docs/screenshots/`
const electronPath = createRequire(import.meta.url)('electron')
// A throwaway profile, so saved print settings and printed marks don't leak in.
const profile = mkdtempSync(join(tmpdir(), 'badge-shots-'))

const app = await electron.launch({
  executablePath: electronPath,
  args: [`--user-data-dir=${profile}`, '--force-device-scale-factor=2', '--no-sandbox', '--lang=en-US', root],
  env: { ...process.env, ELECTRON_RENDERER_URL: '' }
})
const page = await app.firstWindow()
page.on('pageerror', (e) => console.error('[pageerror]', e.message))
page.on('dialog', (d) => d.dismiss())
await page.waitForSelector('.canvas-badge')

await app.evaluate(({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows()[0]
  win.setContentSize(1440, 900)
  // Show plausible printers instead of whatever the build machine has.
  win.webContents.getPrintersAsync = async () => [
    { name: 'card-printer', displayName: 'Badge Card Printer (USB)', description: '', options: { 'is-default': 'true' } },
    { name: 'office', displayName: 'Office Laser', description: '', options: {} }
  ]
})

const openNext = (path) =>
  app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, path)
const settle = () => page.waitForTimeout(400)
const shot = async (name, target = page) => {
  await settle()
  await target.screenshot({ path: `${out}${name}.png`, animations: 'disabled' })
  console.log('saved', name)
}

// Load the example template and attendee list.
await openNext(`${example}community-conf.badge`)
await page.getByRole('button', { name: 'Open…' }).click()
await openNext(`${example}attendees.csv`)
await page.getByRole('button', { name: 'Load CSV…' }).click()
await page.waitForSelector('.tabs button:has-text("(14)")')

// Designer with the name field selected.
await page.locator('.layers li', { hasText: 'Name' }).first().click()
await page.mouse.move(0, 0)
await shot('designer')

// Data view: mark a few badges printed, then focus the long name to show auto-fit.
await page.getByRole('tab', { name: /Data/ }).click()
await page.waitForSelector('.table-row')
const rows = page.locator('.table-row')
for (const i of [0, 1, 4]) await rows.nth(i).locator('input[type=checkbox]').check()
await page.getByRole('button', { name: 'Mark selected printed' }).click()
for (const i of [0, 1, 4]) await rows.nth(i).locator('input[type=checkbox]').uncheck()
await rows.nth(2).click()
await page.mouse.move(0, 0)
await shot('data-view')

// Conditional field: a sponsor gets the thank-you note.
await rows.nth(3).click()
await page.mouse.move(0, 0)
await shot('preview-sponsor', page.locator('.preview-sides'))

// Print dialog with batching options.
await page.getByRole('button', { name: /Print all shown/ }).click()
await page.locator('.advanced summary').click()
await page.mouse.move(0, 0)
await shot('print-dialog', page.locator('.modal'))
await page.getByRole('button', { name: 'Cancel' }).click()

// Fold mode: front and back on one piece of stock.
await page.getByRole('tab', { name: 'Design' }).click()
await page.locator('.panel-section', { hasText: 'Back side' }).locator('input[type=checkbox]').check()
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1680, 900))
await page.getByRole('tab', { name: /Data/ }).click()
await rows.nth(0).click()
await page.mouse.move(0, 0)
await shot('fold-preview', page.locator('.preview-sides'))

await app.close()
rmSync(profile, { recursive: true, force: true })
