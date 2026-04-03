import React, { useCallback } from 'react'
import { Monitor, AppWindow, RefreshCw } from 'lucide-react'
import { CaptureSource } from '../../../../shared/types'
import { useAppStore } from '../../store/appStore'

interface SourcePickerProps {
  sources: CaptureSource[]
  selectedIds: Set<string>
  loading: boolean
  disabled: boolean
  onToggle: (id: string) => void
  onRefresh: () => void
}

export function SourcePicker({
  sources,
  selectedIds,
  loading,
  disabled,
  onToggle,
  onRefresh,
}: SourcePickerProps) {
  const screens = sources.filter((s) => s.type === 'screen')
  const windows = sources.filter((s) => s.type === 'window')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Capture Sources
        </span>
        <button
          onClick={onRefresh}
          disabled={loading || disabled}
          className="no-drag p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors disabled:opacity-40"
          title="Refresh sources"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24 text-[var(--color-text-muted)] text-sm">
          Loading sources…
        </div>
      ) : sources.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-[var(--color-text-muted)] text-sm">
          No sources found
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {screens.length > 0 && (
            <SourceGroup
              label="Displays"
              sources={screens}
              selectedIds={selectedIds}
              disabled={disabled}
              onToggle={onToggle}
            />
          )}
          {windows.length > 0 && (
            <SourceGroup
              label="Windows"
              sources={windows}
              selectedIds={selectedIds}
              disabled={disabled}
              onToggle={onToggle}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SourceGroup({
  label,
  sources,
  selectedIds,
  disabled,
  onToggle,
}: {
  label: string
  sources: CaptureSource[]
  selectedIds: Set<string>
  disabled: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] px-1 mt-1">
        {label}
      </span>
      {sources.map((src) => (
        <SourceCard
          key={src.id}
          source={src}
          selected={selectedIds.has(src.id)}
          disabled={disabled}
          onToggle={() => onToggle(src.id)}
        />
      ))}
    </div>
  )
}

function SourceCard({
  source,
  selected,
  disabled,
  onToggle,
}: {
  source: CaptureSource
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={[
        'no-drag w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all duration-150',
        'border focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]',
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-glow)] text-[var(--color-text-primary)]'
          : 'border-transparent bg-[var(--color-bg-hover)] hover:border-[var(--color-border)] text-[var(--color-text-secondary)]',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {/* Thumbnail or icon */}
      <div className="flex-shrink-0 w-16 h-9 rounded overflow-hidden bg-[var(--color-bg-primary)] flex items-center justify-center">
        {source.thumbnailDataUrl ? (
          <img
            src={source.thumbnailDataUrl}
            alt={source.name}
            className="w-full h-full object-cover"
          />
        ) : source.type === 'screen' ? (
          <Monitor size={18} className="text-[var(--color-text-muted)]" />
        ) : (
          <AppWindow size={18} className="text-[var(--color-text-muted)]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{source.name}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 capitalize">{source.type}</p>
      </div>

      {selected && (
        <div className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="currentColor">
            <path d="M3.5 7.5L1 5l1-1 1.5 1.5L8 3l1 1z" />
          </svg>
        </div>
      )}
    </button>
  )
}
