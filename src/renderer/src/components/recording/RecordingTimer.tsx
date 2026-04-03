import React, { useEffect, useState, useCallback } from 'react'
import { RecordingStatus } from '../../../../shared/types'
import { ActiveSession } from '../../store/appStore'

interface RecordingTimerProps {
  status: RecordingStatus
  sessions: Map<string, ActiveSession>
  countdownSeconds: number
  onCountdownComplete: () => void
}

export function RecordingTimer({
  status,
  sessions,
  countdownSeconds,
  onCountdownComplete,
}: RecordingTimerProps) {
  const [countdown, setCountdown] = useState<number | null>(null)

  // Start countdown when status enters 'countdown'
  useEffect(() => {
    if (status !== 'countdown') {
      setCountdown(null)
      return
    }
    setCountdown(countdownSeconds)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          onCountdownComplete()
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [status, countdownSeconds])

  if (status === 'idle') return null

  if (status === 'countdown' && countdown !== null) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">
          Recording starts in
        </p>
        <span className="text-7xl font-bold text-[var(--color-accent)] tabular-nums">{countdown}</span>
      </div>
    )
  }

  if (status === 'recording' || status === 'paused') {
    return (
      <div className="flex flex-col gap-2">
        {[...sessions.values()].map((session) => (
          <SessionRow key={session.id} session={session} isPaused={status === 'paused'} />
        ))}
      </div>
    )
  }

  if (status === 'stopping' || status === 'encoding') {
    const session = [...sessions.values()][0]
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {status === 'encoding' ? 'Encoding…' : 'Finalizing…'}
        </p>
        {session && session.progress > 0 && (
          <div className="w-full h-1 rounded-full bg-[var(--color-bg-hover)] overflow-hidden">
            <div
              className="h-full shimmer rounded-full transition-all duration-300"
              style={{ width: `${session.progress}%` }}
            />
          </div>
        )}
        {session && session.progress === 0 && (
          <div className="w-full h-1 rounded-full bg-[var(--color-bg-hover)] overflow-hidden">
            <div className="h-full shimmer rounded-full w-full" />
          </div>
        )}
      </div>
    )
  }

  return null
}

function SessionRow({ session, isPaused }: { session: ActiveSession; isPaused: boolean }) {
  const { durationSec, sourceName } = session
  const h = Math.floor(durationSec / 3600)
  const m = Math.floor((durationSec % 3600) / 60)
  const s = Math.floor(durationSec % 60)
  const formatted =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-3 bg-[var(--color-bg-hover)] rounded-lg px-3 py-2">
      <div
        className={['w-2 h-2 rounded-full flex-shrink-0', isPaused ? 'bg-yellow-500' : 'bg-[var(--color-rec)] rec-dot'].join(' ')}
      />
      <span className="flex-1 text-xs text-[var(--color-text-secondary)] truncate">{sourceName}</span>
      <span className="text-sm font-mono font-semibold text-[var(--color-text-primary)] tabular-nums">
        {formatted}
      </span>
    </div>
  )
}
