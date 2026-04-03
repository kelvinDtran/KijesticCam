import React from 'react'

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  disabled?: boolean
  formatValue?: (v: number) => string
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 2,
  step = 0.05,
  label,
  disabled,
  formatValue,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="no-drag flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
          <span className="text-xs font-mono text-[var(--color-accent)]">
            {formatValue ? formatValue(value) : value.toFixed(2)}
          </span>
        </div>
      )}
      <div className="relative flex items-center h-4">
        <div className="w-full h-1 rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
    </div>
  )
}
