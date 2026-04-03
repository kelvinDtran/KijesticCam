import React, { useCallback } from 'react'
import { Circle, Square, Pause, Play, AlertTriangle, Layers, SquareSplitHorizontal } from 'lucide-react'
import { RecordingStatus } from '../../../../shared/types'
import { useAppStore, ActiveSession } from '../../store/appStore'
import { useRecording } from '../../hooks/useRecording'
import { useSources } from '../../hooks/useSources'
import { SourcePicker } from './SourcePicker'
import { AudioControls } from './AudioControls'
import { RecordingTimer } from './RecordingTimer'
import { Button } from '../common/Button'

export function RecordingPanel() {
  const { settings, setSettings, setGlobalStatus } = useAppStore((s) => ({
    settings: s.settings,
    setSettings: s.setSettings,
    setGlobalStatus: s.setGlobalStatus,
  }))

  const { globalStatus, sessions, startRecording, stopAll, pauseAll, resumeAll } = useRecording()

  const {
    sources,
    selectedSources,
    selectedSourceIds,
    loadingSources,
    audioInputDevices,
    toggleSource,
    refreshSources,
  } = useSources()

  const isIdle = globalStatus === 'idle'
  const isRecording = globalStatus === 'recording'
  const isPaused = globalStatus === 'paused'
  const isBusy = !isIdle && !isRecording && !isPaused

  const handleStart = useCallback(async () => {
    if (selectedSourceIds.size === 0) return
    setGlobalStatus('countdown')
  }, [selectedSourceIds])

  const handleCountdownComplete = useCallback(async () => {
    await startRecording({
      sources: selectedSources,
      audio: settings.audio,
      video: settings.video,
      outputDir: settings.outputDir,
      countdownSeconds: settings.countdownSeconds,
      multiSourceMode: settings.multiSourceMode,
      compositeLayout: settings.compositeLayout,
    })
  }, [selectedSources, settings])

  const handleStop = useCallback(() => stopAll(), [stopAll])
  const handlePause = useCallback(() => pauseAll(), [pauseAll])
  const handleResume = useCallback(() => resumeAll(), [resumeAll])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* Source picker */}
        <SourcePicker
          sources={sources}
          selectedIds={selectedSourceIds}
          loading={loadingSources}
          disabled={!isIdle}
          onToggle={toggleSource}
          onRefresh={refreshSources}
        />

        {/* Audio controls */}
        <AudioControls
          audio={settings.audio}
          audioInputDevices={audioInputDevices}
          disabled={!isIdle}
          onChange={(partial) => setSettings({ audio: { ...settings.audio, ...partial } })}
        />

        {/* Timer / status display */}
        <RecordingTimer
          status={globalStatus}
          sessions={sessions}
          countdownSeconds={settings.countdownSeconds}
          onCountdownComplete={handleCountdownComplete}
        />

        {/* Multi-source mode indicator */}
        {isIdle && selectedSourceIds.size > 1 && (
          <div className={[
            'flex items-center gap-2 text-xs rounded-lg px-3 py-2 border',
            settings.multiSourceMode === 'composite'
              ? 'text-[var(--color-accent)] bg-[var(--color-accent-glow)] border-[var(--color-accent)]/30'
              : 'text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] border-[var(--color-border)]',
          ].join(' ')}>
            {settings.multiSourceMode === 'composite'
              ? <><Layers size={12} /> Composite mode · {settings.compositeLayout} layout · 1 output file</>
              : <><SquareSplitHorizontal size={12} /> Separate files mode · {selectedSourceIds.size} output files</>
            }
          </div>
        )}

        {/* No source warning */}
        {isIdle && selectedSourceIds.size === 0 && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-warning)] bg-yellow-500/10 rounded-lg px-3 py-2">
            <AlertTriangle size={12} />
            Select at least one source to start recording
          </div>
        )}
      </div>

      {/* Recording controls — fixed at bottom */}
      <div className="flex-shrink-0 px-4 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <RecordingControls
          status={globalStatus}
          canStart={selectedSourceIds.size > 0 && isIdle}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
          isBusy={isBusy}
        />
      </div>
    </div>
  )
}

interface RecordingControlsProps {
  status: RecordingStatus
  canStart: boolean
  isBusy: boolean
  onStart: () => void
  onStop: () => void
  onPause: () => void
  onResume: () => void
}

function RecordingControls({
  status,
  canStart,
  isBusy,
  onStart,
  onStop,
  onPause,
  onResume,
}: RecordingControlsProps) {
  if (status === 'idle' || status === 'countdown') {
    return (
      <Button
        variant="danger"
        size="lg"
        className="w-full"
        disabled={!canStart || status === 'countdown'}
        loading={status === 'countdown'}
        icon={<Circle size={16} fill="currentColor" />}
        onClick={onStart}
      >
        {status === 'countdown' ? 'Starting…' : 'Start Recording'}
      </Button>
    )
  }

  if (status === 'recording') {
    return (
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          icon={<Pause size={16} />}
          onClick={onPause}
        >
          Pause
        </Button>
        <Button
          variant="danger"
          size="lg"
          className="flex-1"
          icon={<Square size={16} fill="currentColor" />}
          onClick={onStop}
        >
          Stop
        </Button>
      </div>
    )
  }

  if (status === 'paused') {
    return (
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          icon={<Play size={16} />}
          onClick={onResume}
        >
          Resume
        </Button>
        <Button
          variant="danger"
          size="lg"
          className="flex-1"
          icon={<Square size={16} fill="currentColor" />}
          onClick={onStop}
        >
          Stop
        </Button>
      </div>
    )
  }

  return (
    <Button variant="secondary" size="lg" className="w-full" loading disabled>
      {status === 'encoding' ? 'Encoding…' : 'Finalizing…'}
    </Button>
  )
}
