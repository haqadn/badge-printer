// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState, type ReactNode } from 'react'

/**
 * A labelled form row. Pass `button` when the control is (or contains) a button, so the
 * row isn't a <label> — a label would swallow the button's accessible name.
 */
export function Row({
  label,
  children,
  hint,
  button
}: {
  label: string
  children: ReactNode
  hint?: string
  button?: boolean
}) {
  const Tag = button ? 'div' : 'label'
  return (
    <Tag className="form-row" title={hint}>
      <span className="form-label">{label}</span>
      <span className="form-control">{children}</span>
    </Tag>
  )
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="panel-section">
      <header>
        <h3>{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  )
}

/**
 * A number input that lets you type freely and only commits valid numbers on blur or
 * Enter, so a half-typed value like "1." doesn't get rejected mid-keystroke.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 0.1,
  suffix,
  disabled
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
}) {
  const [text, setText] = useState(fmt(value))
  useEffect(() => setText(fmt(value)), [value])

  const commit = (): void => {
    let v = parseFloat(text)
    if (!Number.isFinite(v)) {
      setText(fmt(value))
      return
    }
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    if (v !== value) onChange(v)
    setText(fmt(v))
  }

  return (
    <span className="number-input">
      <input
        type="number"
        value={text}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </span>
  )
}

function fmt(v: number): string {
  return String(Math.round(v * 100) / 100)
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <span className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

/** Text input that commits on every keystroke but keeps the caret stable. */
export function TextInput({
  value,
  onChange,
  placeholder,
  multiline
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  if (multiline) {
    return <textarea value={value} placeholder={placeholder} rows={2} onChange={(e) => onChange(e.target.value)} />
  }
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}
