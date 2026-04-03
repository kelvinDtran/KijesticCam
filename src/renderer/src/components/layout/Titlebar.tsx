import React from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

export function Titlebar() {
  const globalStatus = useAppStore((s) => s.globalStatus)
  const isRecording = globalStatus === 'recording'

  return (
    <div
      className="drag-region flex items-center justify-between h-9 px-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex-shrink-0"
      style={{ minHeight: 36 }}
    >
      {/* Logo / Title */}
      <div className="flex items-center gap-2 no-drag select-none">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-[var(--color-accent)]">
          <svg viewBox="0 0 16 16" fill="white" width="10" height="10">
            <circle cx="8" cy="8" r="5" />
            <path d="M6 4l4 4-4 4" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-xs font-semibold tracking-wide text-[var(--color-text-primary)]">
          KijesticCam
        </span>
        {isRecording && (
          <span className="flex items-center gap-1 bg-[var(--color-rec)]/15 text-[var(--color-rec)] text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-rec)] rec-dot" />
            REC
          </span>
        )}
      </div>

      {/* Window controls */}
      <div className="flex items-center no-drag">
        <WinBtn onClick={() => window.electronAPI.minimize()} title="Minimize">
          <Minus size={11} />
        </WinBtn>
        <WinBtn onClick={() => window.electronAPI.maximize()} title="Maximize">
          <Square size={10} />
        </WinBtn>
        <WinBtn onClick={() => window.electronAPI.closeApp()} title="Close" danger>
          <X size={11} />
        </WinBtn>
      </div>
    </div>
  )
}

function WinBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'w-8 h-7 flex items-center justify-center transition-colors',
        danger
          ? 'hover:bg-red-500 text-[var(--color-text-muted)] hover:text-white'
          : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
