# Badge Printer

A desktop app for printing event badges in bulk from a CSV file onto **pre-printed badge stock**.

- **Visual template designer.** Load a picture of your stock design as a guide, then draw placeholder boxes on it.
  - A placeholder holds text with `{{Column Name}}` tokens. They are filled from the CSV column of the same name, and you can mix in plain text, e.g. `{{First}} {{Last}}`.
  - Each box is the area the text may grow into. Set horizontal and vertical alignment, **max and min font size**, max lines, weight, colour, case, letter spacing, and what happens when text is too long: keep shrinking, cut off with …, or clip.
  - **QR codes** get their content from columns, e.g. `https://example.com/t/{{ID}}`.
  - **Conditional fields**: show a field only when a column has, or doesn't have, a value (e.g. a "MICRO" label only for `Type = Microsponsor`).
  - Snapping guides, arrow-key nudging, locking, layers, undo/redo.
- **Optional back side (fold mode).** Both sides print on one double-length piece of stock that you fold in half, either top/bottom (the back is turned 180°) or left/right. The back can repeat the front layout or have its own.
- **Portable templates.** A `.badge` file is a zip holding the layout, the stock preview images and any embedded fonts.
- **Data view with live preview.** Browse the loaded rows with search, per-column filters and printed / not-printed status. Move through rows with the arrow keys and the badge preview beside the list updates, with a warning when text doesn't fit.
  - <kbd>Space</kbd> selects a row and <kbd>Enter</kbd> prints it.
  - Fix a typo or add a walk-in attendee without touching the CSV.
  - If the CSV's headers differ from the template's, map them.
- **Batched printing.** Badges go to the printer in small batches (10 by default, with an optional pause between batches). Only one batch is laid out and spooled at a time, so neither the printer's memory nor the computer's fills up on large runs. You can cancel a run midway, and each badge is marked printed as its batch goes out.
- **PDF export**, built from the same batches.
- **Alignment calibration.** Shift everything by fractions of a millimetre to line up with the pre-printed stock.

The stock design image is never printed. It is only a guide for placing fields.

## Development

```bash
npm install
npm run dev        # run the app with hot reload
npm test           # unit tests
npm run typecheck
npm run dist       # build an installer for the current OS into dist/
```

Built with Electron, React, TypeScript and electron-vite.

### Layout

| Path | What it holds |
|---|---|
| `src/shared/` | Template types, placeholder filling and conditions, batching. Used by both processes. |
| `src/main/` | Electron main process: file dialogs and the batched print-job runner (`jobs.ts`). |
| `src/preload/` | The small API the page can call (`window.badge`). |
| `src/renderer/src/badge/` | Draws a badge. The same component is used for the designer, the preview and the print window, so what you see is what prints. `fit.ts` does the auto-fit text sizing. |
| `src/renderer/src/designer/` | The template designer. |
| `src/renderer/src/data/` | The row list and preview panel. |
| `src/renderer/src/print/` | The print dialog, and `PrintRoot`, which lays out a batch in the hidden print window. |

### Printing tips

Set the printer's paper size to the stock size (doubled in fold mode) with no margins. Print one sample badge on plain paper, hold it against a piece of stock, and correct any offset with **Batching and alignment → Shift right / Shift down** in the print dialog. The shift is remembered.

## License

Copyright (C) 2026 haqadn

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.
