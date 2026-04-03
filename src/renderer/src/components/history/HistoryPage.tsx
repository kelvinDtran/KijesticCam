import React, { useEffect, useState } from 'react'
import { Film, FolderOpen, Play, Trash2, Clock, HardDrive, Maximize } from 'lucide-react'
import { HistoryEntry } from '../../../../shared/types'
import { useAppStore } from '../../store/appStore'
import { Button } from '../common/Button'

export function HistoryPage() {
  const history = useAppStore((s) => s.history)
  const loadingHistory = useAppStore((s) => s.loadingHistory)
  const setHistory = useAppStore((s) => s.setHistory)
  const setLoadingHistory = useAppStore((s) => s.setLoadingHistory)
  const removeHistoryEntry = useAppStore((s) => s.removeHistoryEntry)

  useEffect(() => {
    async function load() {
      setLoadingHistory(true)
      try {
        const h = await window.electronAPI.getHistory()
        setHistory(h)
      } finally {
        setLoadingHistory(false)
      }
    }
    load()
  }, [])

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
        Loading…
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)]">
        <Film size={36} strokeWidth={1} />
        <p className="text-sm">No recordings yet</p>
        <p className="text-xs">Start recording to see your files here</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-muted)]">
          {history.length} recording{history.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.electronAPI.openOutputDir()}
          icon={<FolderOpen size={12} />}
        >
          Open folder
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
        {history.map((entry) => (
          <HistoryCard
            key={entry.id}
            entry={entry}
            onDelete={() => {
              window.electronAPI.deleteHistoryEntry(entry.id).then(({ ok }) => {
                if (ok) removeHistoryEntry(entry.id)
              })
            }}
          />
        ))}
      </div>
    </div>
  )
}

function HistoryCard({
  entry,
  onDelete,
}: {
  entry: HistoryEntry
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  const date = new Date(entry.recordedAt)
  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="group bg-[var(--color-bg-card)] rounded-xl p-3.5 border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--color-bg-hover)] flex items-center justify-center mt-0.5">
          <Film size={14} className="text-[var(--color-accent)]" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate" title={entry.fileName}>
            {entry.fileName}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{dateStr} · {entry.sourceName}</p>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Chip icon={<Clock size={10} />} label={formatDuration(entry.duration)} />
            <Chip icon={<HardDrive size={10} />} label={formatBytes(entry.fileSize)} />
            <Chip icon={<Maximize size={10} />} label={entry.resolution} />
            <Chip label={`${entry.codec.toUpperCase()} · ${entry.frameRate}fps`} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => window.electronAPI.openFile(entry.filePath)}
            className="no-drag p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            title="Play"
          >
            <Play size={13} />
          </button>
          <button
            onClick={() => window.electronAPI.showInFolder(entry.filePath)}
            className="no-drag p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            title="Show in folder"
          >
            <FolderOpen size={13} />
          </button>
          {confirming ? (
            <button
              onClick={() => { onDelete(); setConfirming(false) }}
              className="no-drag p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-xs font-medium px-2"
            >
              Confirm
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="no-drag p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] rounded px-1.5 py-0.5">
      {icon}
      {label}
    </span>
  )
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
