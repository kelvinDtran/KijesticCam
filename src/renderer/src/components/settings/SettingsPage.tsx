import React, { useState } from 'react'
import { Folder, Cpu, ChevronDown, Check, Info } from 'lucide-react'
import { VideoCodec, QualityPreset, FrameRate } from '../../../../shared/types'
import { useAppStore } from '../../store/appStore'
import { useSettings } from '../../hooks/useSettings'
import { Button } from '../common/Button'
import { Toggle } from '../common/Toggle'

export function SettingsPage() {
  const { settings, updateSettings, chooseOutputDir } = useSettings()
  const hardware = useAppStore((s) => s.hardware)
  const [saved, setSaved] = useState(false)

  async function handleSave(partial: Parameters<typeof updateSettings>[0]) {
    await updateSettings(partial)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex-1 px-5 py-5 flex flex-col gap-6 max-w-xl mx-auto w-full">

        {/* Output Folder */}
        <Section title="Storage" icon={<Folder size={14} />}>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-secondary)] truncate font-mono">
              {settings.outputDir || 'Not set'}
            </div>
            <Button variant="secondary" size="sm" onClick={chooseOutputDir} className="flex-shrink-0">
              Browse
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.electronAPI.openOutputDir()}
              className="flex-shrink-0 text-[var(--color-text-muted)]"
            >
              Open
            </Button>
          </div>
        </Section>

        {/* Video Settings */}
        <Section title="Video" icon={<Cpu size={14} />}>
          <div className="flex flex-col gap-4">
            {/* Codec */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--color-text-secondary)]">Codec</label>
              <SegmentedControl
                options={[
                  { value: 'h264', label: 'H.264', desc: 'Universal' },
                  { value: 'h265', label: 'H.265', desc: 'Smaller files' },
                  { value: 'av1', label: 'AV1', desc: 'Best compression' },
                ]}
                value={settings.video.codec}
                onChange={(v) => handleSave({ video: { ...settings.video, codec: v as VideoCodec } })}
              />
              {hardware && (
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Recommended: <span className="text-[var(--color-accent)]">{hardware.recommendedCodec.toUpperCase()}</span>
                  {hardware.gpuName && ` · ${hardware.gpuName}`}
                </p>
              )}
            </div>

            {/* Quality Preset */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--color-text-secondary)]">Quality Preset</label>
              <SegmentedControl
                options={[
                  { value: 'efficiency', label: 'Efficient', desc: 'Smallest files' },
                  { value: 'balanced', label: 'Balanced', desc: 'Recommended' },
                  { value: 'quality', label: 'Quality', desc: 'Largest files' },
                ]}
                value={settings.video.qualityPreset}
                onChange={(v) =>
                  handleSave({ video: { ...settings.video, qualityPreset: v as QualityPreset } })
                }
              />
              <PresetDescription preset={settings.video.qualityPreset} />
            </div>

            {/* Frame Rate */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--color-text-secondary)]">Frame Rate</label>
              <SegmentedControl
                options={[
                  { value: 30, label: '30 FPS', desc: 'Smaller' },
                  { value: 60, label: '60 FPS', desc: 'Smoother' },
                ]}
                value={settings.video.frameRate}
                onChange={(v) =>
                  handleSave({ video: { ...settings.video, frameRate: Number(v) as FrameRate } })
                }
              />
            </div>

            {/* Hardware Acceleration */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Hardware Acceleration</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {hardware?.nvenc
                    ? 'NVENC available'
                    : hardware?.quickSync
                    ? 'Intel Quick Sync available'
                    : hardware?.amf
                    ? 'AMD AMF available'
                    : 'No hardware encoder detected'}
                </p>
              </div>
              <Toggle
                checked={settings.video.hardwareAcceleration}
                disabled={!hardware?.nvenc && !hardware?.quickSync && !hardware?.amf}
                onChange={(v) =>
                  handleSave({ video: { ...settings.video, hardwareAcceleration: v } })
                }
              />
            </div>
          </div>
        </Section>

        {/* Recording Behavior */}
        <Section title="Recording">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Countdown Timer</p>
                <p className="text-xs text-[var(--color-text-muted)]">Seconds before recording starts</p>
              </div>
              <select
                value={settings.countdownSeconds}
                onChange={(e) => handleSave({ countdownSeconds: Number(e.target.value) })}
                className="no-drag bg-[var(--color-bg-hover)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                {[0, 1, 2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>{n === 0 ? 'None' : `${n}s`}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Multi-source mode</p>
                <p className="text-xs text-[var(--color-text-muted)]">How to handle multiple sources</p>
              </div>
              <select
                value={settings.multiSourceMode}
                onChange={(e) => handleSave({ multiSourceMode: e.target.value as 'separate' | 'composite' })}
                className="no-drag bg-[var(--color-bg-hover)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="separate">Separate files</option>
                <option value="composite">Composite (coming soon)</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">Minimize to tray</p>
                <p className="text-xs text-[var(--color-text-muted)]">Keep running in background</p>
              </div>
              <Toggle
                checked={settings.minimizeToTray}
                onChange={(v) => handleSave({ minimizeToTray: v })}
              />
            </div>
          </div>
        </Section>

        {/* Hotkeys */}
        <Section title="Hotkeys">
          <div className="flex flex-col gap-3">
            <HotkeyRow
              label="Start / Stop"
              value={settings.hotkeys.startStop}
              onChange={(v) => handleSave({ hotkeys: { ...settings.hotkeys, startStop: v } })}
            />
            <HotkeyRow
              label="Pause / Resume"
              value={settings.hotkeys.pauseResume}
              onChange={(v) => handleSave({ hotkeys: { ...settings.hotkeys, pauseResume: v } })}
            />
          </div>
        </Section>

        {saved && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-success)] bg-green-500/10 rounded-lg px-3 py-2">
            <Check size={12} />
            Settings saved
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {icon}
        {title}
      </div>
      <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
        {children}
      </div>
    </div>
  )
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; desc?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 bg-[var(--color-bg-primary)] rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={[
            'no-drag flex-1 flex flex-col items-center py-1.5 px-2 rounded-md text-xs transition-all duration-150',
            value === opt.value
              ? 'bg-[var(--color-accent)] text-white font-medium'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]',
          ].join(' ')}
        >
          <span>{opt.label}</span>
          {opt.desc && (
            <span
              className={['text-[9px] mt-0.5', value === opt.value ? 'text-white/70' : 'text-[var(--color-text-muted)]'].join(' ')}
            >
              {opt.desc}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function PresetDescription({ preset }: { preset: QualityPreset }) {
  const desc: Record<QualityPreset, string> = {
    efficiency: 'CRF 28–35 · ~3 Mbps WebM · Best for storage-constrained systems',
    balanced: 'CRF 23–30 · ~8 Mbps WebM · Great quality/size ratio (default)',
    quality: 'CRF 17–22 · ~20 Mbps WebM · Near-lossless for archival',
  }
  return (
    <p className="text-[10px] text-[var(--color-text-muted)] flex items-start gap-1">
      <Info size={10} className="mt-0.5 flex-shrink-0" />
      {desc[preset]}
    </p>
  )
}

function HotkeyRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md px-2 py-1">
        <span className="text-xs font-mono text-[var(--color-accent)]">{value}</span>
      </div>
    </div>
  )
}
