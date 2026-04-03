import React from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function Toggle({ checked, onChange, label, disabled, size = 'md' }: ToggleProps) {
  const trackW = size === 'sm' ? 'w-8' : 'w-10'
  const trackH = size === 'sm' ? 'h-4' : 'h-5'
  const thumbSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const thumbTranslate = checked ? (size === 'sm' ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0.5'

  return (
    <label className="no-drag flex items-center gap-2 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          `relative inline-flex flex-shrink-0 ${trackW} ${trackH} rounded-full transition-colors duration-200`,
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
          checked
            ? 'bg-[var(--color-accent)]'
            : 'bg-[var(--color-bg-hover)] border border-[var(--color-border)]',
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        <span
          className={[
            `absolute top-0.5 ${thumbSize} rounded-full bg-white shadow-sm transition-transform duration-200`,
            thumbTranslate,
          ].join(' ')}
        />
      </button>
      {label && (
        <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      )}
    </label>
  )
}
