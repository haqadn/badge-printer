// SPDX-License-Identifier: GPL-3.0-or-later
// Builds examples/community-conf/community-conf.badge from the files next to it.
// Fields only list what differs from the defaults; the app fills in the rest on open.
import { readFileSync, writeFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'

const dir = new URL('../examples/community-conf/', import.meta.url)
const text = (id, name, content, box, extra = {}) => ({ type: 'text', id, name, content, box, ...extra })

const template = {
  version: 1,
  name: 'Community Conf 2026',
  size: { w: 101.6, h: 152.4 },
  front: {
    stock: 'stock-front.svg',
    fields: [
      text('name', 'Name', '{{Name}}', { x: 6, y: 64, w: 89.6, h: 25 }, {
        maxFontSize: 34, minFontSize: 12, maxLines: 2, color: '#0f172a', lineHeight: 1.1
      }),
      text('company', 'Company', '{{Company}}', { x: 6, y: 90, w: 89.6, h: 8 }, {
        maxFontSize: 14, minFontSize: 9, maxLines: 1, fontWeight: 400, color: '#475569', overflow: 'ellipsis'
      }),
      text('type', 'Ticket type', '{{Type}}', { x: 6, y: 99, w: 89.6, h: 8 }, {
        maxFontSize: 12, minFontSize: 8, maxLines: 1, transform: 'uppercase', letterSpacing: 0.12, color: '#0e7490'
      }),
      { type: 'qr', id: 'qr', name: 'Check-in QR', content: 'https://example.com/checkin/{{ID}}', box: { x: 8, y: 112, w: 27, h: 27 } },
      text('thanks', 'Sponsor thank-you', 'Thank you for sponsoring!', { x: 39, y: 113, w: 55, h: 12 }, {
        hAlign: 'left', vAlign: 'top', maxFontSize: 11, minFontSize: 8, maxLines: 2, italic: true, fontWeight: 600, color: '#b45309',
        showIf: { column: 'Type', op: 'contains', value: 'sponsor' }
      }),
      text('id', 'Badge number', '#{{ID}}', { x: 39, y: 130, w: 55, h: 8 }, {
        hAlign: 'left', maxFontSize: 12, minFontSize: 8, maxLines: 1, fontWeight: 600, color: '#334155'
      })
    ]
  },
  back: { enabled: false, foldEdge: 'bottom', source: 'mirror', layout: { stock: 'stock-front.svg', fields: [] } },
  fonts: [],
  sampleRow: { Name: 'Tahmid Rahman', Company: 'Sylhet Web Studio', Type: 'Attendee', ID: '1002' }
}

const zip = zipSync({
  'template.json': strToU8(JSON.stringify(template, null, 2)),
  'assets/stock-front.svg': readFileSync(new URL('stock-front.svg', dir))
})
writeFileSync(new URL('community-conf.badge', dir), zip)
console.log('wrote examples/community-conf/community-conf.badge')
