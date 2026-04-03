// ─── Source Types ────────────────────────────────────────────────────────────

export type CaptureSourceType = 'screen' | 'window'

export interface CaptureSource {
  id: string
  name: string
  type: CaptureSourceType
  thumbnailDataUrl?: string
  displayId?: number
  appIcon?: string
}

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

// ─── Recording Types ──────────────────────────────────────────────────────────

export type RecordingStatus = 'idle' | 'countdown' | 'recording' | 'paused' | 'stopping' | 'encoding'

export type VideoCodec = 'h264' | 'h265' | 'av1'
export type QualityPreset = 'efficiency' | 'balanced' | 'quality'
export type FrameRate = 30 | 60

export interface AudioSettings {
  systemAudioEnabled: boolean
  microphoneEnabled: boolean
  systemAudioGain: number  // 0.0 – 2.0
  microphoneGain: number   // 0.0 – 2.0
  microphoneDeviceId: string | null
}

export interface VideoSettings {
  codec: VideoCodec
  qualityPreset: QualityPreset
  frameRate: FrameRate
  hardwareAcceleration: boolean
}

export type CompositeLayout = 'side-by-side' | 'grid' | 'pip' | 'stacked'

export interface RecordingConfig {
  sources: CaptureSource[]
  audio: AudioSettings
  video: VideoSettings
  outputDir: string
  countdownSeconds: number
  multiSourceMode: 'separate' | 'composite'
  compositeLayout?: CompositeLayout
}

export interface RecordingSession {
  id: string
  sourceId: string
  sourceName: string
  sourceType: CaptureSourceType
  status: RecordingStatus
  startTime: number
  duration: number
  tempFilePath: string
  outputFilePath: string
}

export interface RecordingResult {
  sessionId: string
  outputFilePath: string
  duration: number
  fileSize: number
  resolution: string
  codec: string
  frameRate: number
}

// ─── History Types ────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string
  fileName: string
  filePath: string
  duration: number       // seconds
  fileSize: number       // bytes
  resolution: string     // e.g. "1920x1080"
  codec: string
  frameRate: number
  sourceName: string
  recordedAt: number     // unix timestamp ms
}

// ─── Settings Types ───────────────────────────────────────────────────────────

export interface AppSettings {
  outputDir: string
  video: VideoSettings
  audio: AudioSettings
  countdownSeconds: number
  hotkeys: HotkeySettings
  multiSourceMode: 'separate' | 'composite'
  compositeLayout: CompositeLayout
  minimizeToTray: boolean
  showCapturePreview: boolean
}

export interface HotkeySettings {
  startStop: string
  pauseResume: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  outputDir: '',   // populated at runtime with user's Videos folder
  video: {
    codec: 'h264',
    qualityPreset: 'balanced',
    frameRate: 60,
    hardwareAcceleration: true,
  },
  audio: {
    systemAudioEnabled: true,
    microphoneEnabled: false,
    systemAudioGain: 1.0,
    microphoneGain: 1.0,
    microphoneDeviceId: null,
  },
  countdownSeconds: 3,
  hotkeys: {
    startStop: 'CommandOrControl+Shift+R',
    pauseResume: 'CommandOrControl+Shift+P',
  },
  multiSourceMode: 'separate',
  compositeLayout: 'side-by-side',
  minimizeToTray: true,
  showCapturePreview: true,
}

// ─── IPC Channel Names ────────────────────────────────────────────────────────

export const IPC = {
  // Sources
  GET_SOURCES: 'sources:get',
  GET_AUDIO_DEVICES: 'sources:get-audio-devices',

  // Recording lifecycle (main → renderer control)
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_PAUSE: 'recording:pause',
  RECORDING_RESUME: 'recording:resume',

  // Recording data (renderer → main streaming)
  RECORDING_CHUNK: 'recording:chunk',
  RECORDING_FINALIZE: 'recording:finalize',
  RECORDING_SESSION_READY: 'recording:session-ready',

  // Status events (main → renderer)
  RECORDING_STATUS: 'recording:status',
  RECORDING_COMPLETE: 'recording:complete',
  RECORDING_ERROR: 'recording:error',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_OPEN_DIR: 'settings:open-dir',
  SETTINGS_CHOOSE_DIR: 'settings:choose-dir',

  // File management
  FILES_GET_HISTORY: 'files:get-history',
  FILES_OPEN: 'files:open',
  FILES_OPEN_FOLDER: 'files:open-folder',
  FILES_DELETE: 'files:delete',

  // Hardware
  HARDWARE_DETECT: 'hardware:detect',

  // App
  APP_GET_VERSION: 'app:get-version',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  APP_CLOSE: 'app:close',
} as const

// ─── Hardware Info ────────────────────────────────────────────────────────────

export interface HardwareInfo {
  nvenc: boolean
  quickSync: boolean
  amf: boolean
  recommendedCodec: VideoCodec
  gpuName: string | null
}

// ─── IPC Payload Types ────────────────────────────────────────────────────────

export interface StartRecordingPayload {
  sessionId: string
  sourceName: string
  sourceType: CaptureSourceType
  outputFileName: string
  video: VideoSettings
  audio: AudioSettings
}

export interface ChunkPayload {
  sessionId: string
  data: Uint8Array
}

export interface FinalizePayload {
  sessionId: string
  durationMs: number
}

export interface RecordingStatusEvent {
  sessionId: string
  status: RecordingStatus
  progress?: number
}
