// SPDX-License-Identifier: GPL-3.0-or-later

/** All geometry in a template is stored in millimetres. */
export type Mm = number

export interface Box {
  x: Mm
  y: Mm
  w: Mm
  h: Mm
}

export type HAlign = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'middle' | 'bottom'

export type ConditionOp = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'empty' | 'notEmpty'

export interface Condition {
  column: string
  op: ConditionOp
  value: string
}

interface FieldBase {
  id: string
  /** Label shown in the designer's layer list. */
  name: string
  box: Box
  hAlign: HAlign
  vAlign: VAlign
  /** When set, the field is only drawn for rows matching the condition. */
  showIf: Condition | null
  locked: boolean
}

export type Overflow = 'shrink' | 'ellipsis' | 'clip'

export interface TextField extends FieldBase {
  type: 'text'
  /** Text with `{{Column Name}}` placeholders. */
  content: string
  fontFamily: string
  fontWeight: number
  italic: boolean
  color: string
  /** Font sizes are in points. */
  maxFontSize: number
  minFontSize: number
  lineHeight: number
  letterSpacing: number
  /** 0 means as many lines as fit in the box. */
  maxLines: number
  transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  /** What to do when the text does not fit at the minimum font size. */
  overflow: Overflow
}

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H'

export interface QrField extends FieldBase {
  type: 'qr'
  /** Text with `{{Column Name}}` placeholders, e.g. `https://example.com/t/{{ID}}`. */
  content: string
  errorCorrection: QrErrorCorrection
  color: string
  background: string
  /** Quiet zone around the code, in modules. */
  margin: number
}

export type Field = TextField | QrField
export type FieldType = Field['type']

export interface SideLayout {
  /** Asset name of the stock design image. Shown as a guide only; never printed. */
  stock: string | null
  fields: Field[]
}

/**
 * Fold mode prints both sides on one double-length piece of stock.
 * `bottom`: back is below the front, rotated 180° (fold along the horizontal middle).
 * `right`: back is to the right of the front (fold along the vertical middle).
 */
export type FoldEdge = 'bottom' | 'right'

export interface BackSide {
  enabled: boolean
  foldEdge: FoldEdge
  /** `mirror`: reuse the front layout on the back. `custom`: use `layout`. */
  source: 'mirror' | 'custom'
  layout: SideLayout
}

export interface FontAsset {
  family: string
  weight: number
  italic: boolean
  /** Asset name of the font file inside the template package. */
  asset: string
}

export interface Template {
  version: 1
  name: string
  /** Size of one badge side. */
  size: { w: Mm; h: Mm }
  front: SideLayout
  back: BackSide
  fonts: FontAsset[]
  /** Values used for the designer preview when no CSV is loaded. */
  sampleRow: Record<string, string>
}

export type Row = Record<string, string>

/** A template together with its binary assets (stock images, fonts). */
export interface TemplatePackage {
  template: Template
  assets: Record<string, Uint8Array>
}
