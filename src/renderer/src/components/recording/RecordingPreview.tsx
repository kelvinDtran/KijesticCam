import React, { useEffect, useRef } from 'react'
import { Square } from 'lucide-react'
import { PreviewStream } from '../../hooks/useRecording'
import { ActiveSession } from '../../store/appStore'

interface RecordingPreviewProps {
  previewStreams: PreviewStream[]
  sessions: Map<string, ActiveSession>
  isPaused: boolean
  onStopSession: (sessionId: string) => void
}

export function RecordingPreview({ previewStreams, sessions, isPaused, onStopSession }: RecordingPreviewProps) {
  const firstSession = [...sessions.values()][0]
  const totalSec = firstSession?.durationSec ?? 0
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = Math.floor(totalSec % 60)
  const elapsed = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  const cols = previewStreams.length === 1 ? 'grid-cols-1' : 'grid-cols-2'

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPaused ? (
            <>
              <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Paused</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[var(--color-rec)] rec-dot flex-shrink-0" />
              <span className="text-xs font-semibold text-[var(--color-rec)] uppercase tracking-wider">Recording</span>
            </>
          )}
          {sessions.size > 1 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              · {sessions.size} sources
            </span>
          )}
        </div>
        <span className="text-sm font-mono font-semibold text-[var(--color-text-primary)] tabular-nums">
          {elapsed}
        </span>
      </div>

      {/* Preview grid */}
      {previewStreams.length > 0 ? (
        <div className={`grid ${cols} gap-2`}>
          {previewStreams.map((ps) => (
            <VideoTile
              key={ps.sessionId}
              stream={ps.stream}
              sourceName={ps.sourceName}
              canStop={sessions.size > 1}
              onStop={() => onStopSession(ps.sessionId)}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-lg bg-black aspect-video text-xs text-white/40">
          Connecting to capture source…
        </div>
      )}
    </div>
  )
}

interface VideoTileProps {
  stream: MediaStream
  sourceName: string
  canStop: boolean
  onStop: () => void
}

function VideoTile({ stream, sourceName, canStop, onStop }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    video.play().catch(() => {})
    return () => {
      video.srcObject = null
    }
  }, [stream])

  return (
    <div className="relative rounded-lg overflow-hidden bg-black aspect-video group">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted
        autoPlay
        playsInline
      />
      {/* Bottom label */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/60 to-transparent">
        <span className="text-[10px] text-white/70 truncate block">{sourceName}</span>
      </div>
      {/* Per-tile stop button (only when multiple sessions active) */}
      {canStop && (
        <button
          onClick={onStop}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity
            bg-black/60 hover:bg-red-600/80 rounded p-1 text-white/80 hover:text-white"
          title="Stop this source"
        >
          <Square size={10} fill="currentColor" />
        </button>
      )}
    </div>
  )
}
