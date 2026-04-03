import React from 'react'
import { Mic, Volume2 } from 'lucide-react'
import { AudioSettings } from '../../../../shared/types'
import { Toggle } from '../common/Toggle'
import { Slider } from '../common/Slider'

interface AudioControlsProps {
  audio: AudioSettings
  audioInputDevices: MediaDeviceInfo[]
  disabled: boolean
  onChange: (partial: Partial<AudioSettings>) => void
}

export function AudioControls({ audio, audioInputDevices, disabled, onChange }: AudioControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        Audio
      </span>

      {/* System Audio */}
      <div className="bg-[var(--color-bg-hover)] rounded-xl p-3.5 flex flex-col gap-3 border border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
            <Volume2 size={15} className="text-[var(--color-accent)]" />
            System Audio
          </div>
          <Toggle
            size="sm"
            checked={audio.systemAudioEnabled}
            onChange={(v) => onChange({ systemAudioEnabled: v })}
            disabled={disabled}
          />
        </div>

        {audio.systemAudioEnabled && (
          <Slider
            label="Gain"
            value={audio.systemAudioGain}
            min={0}
            max={2}
            step={0.05}
            disabled={disabled}
            onChange={(v) => onChange({ systemAudioGain: v })}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
        )}
      </div>

      {/* Microphone */}
      <div className="bg-[var(--color-bg-hover)] rounded-xl p-3.5 flex flex-col gap-3 border border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
            <Mic size={15} className="text-[var(--color-accent)]" />
            Microphone
          </div>
          <Toggle
            size="sm"
            checked={audio.microphoneEnabled}
            onChange={(v) => onChange({ microphoneEnabled: v })}
            disabled={disabled}
          />
        </div>

        {audio.microphoneEnabled && (
          <>
            {audioInputDevices.length > 1 && (
              <select
                value={audio.microphoneDeviceId ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ microphoneDeviceId: e.target.value || null })}
                className="no-drag w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">Default device</option>
                {audioInputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
                  </option>
                ))}
              </select>
            )}

            <Slider
              label="Gain"
              value={audio.microphoneGain}
              min={0}
              max={2}
              step={0.05}
              disabled={disabled}
              onChange={(v) => onChange({ microphoneGain: v })}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />
          </>
        )}
      </div>
    </div>
  )
}
