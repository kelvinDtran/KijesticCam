import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IPC,
  CaptureSource,
  AppSettings,
  RecordingConfig,
  HardwareInfo,
  HistoryEntry,
  ChunkPayload,
  FinalizePayload,
  StartRecordingPayload,
  RecordingStatusEvent,
} from '../shared/types'

/**
 * The ElectronAPI object is exposed to the renderer via window.electronAPI.
 * Every IPC call is explicitly whitelisted here — no arbitrary channel access.
 */
const api = {
  // ── Sources ──────────────────────────────────────────────────────────────
  getSources: (): Promise<CaptureSource[]> =>
    ipcRenderer.invoke(IPC.GET_SOURCES),

  /** Tell main which source ID to use for the next getDisplayMedia() call. */
  setCaptureSource: (sourceId: string): Promise<void> =>
    ipcRenderer.invoke('capture:set-source', sourceId),

  // ── Recording ────────────────────────────────────────────────────────────
  startRecording: (config: RecordingConfig): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.RECORDING_START, config),

  stopRecording: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.RECORDING_STOP),

  pauseRecording: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.RECORDING_PAUSE),

  resumeRecording: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.RECORDING_RESUME),

  /** Send a compressed video chunk (called ~1/sec from MediaRecorder.ondataavailable) */
  sendChunk: (payload: ChunkPayload): void =>
    ipcRenderer.send(IPC.RECORDING_CHUNK, payload),

  /** Signal that MediaRecorder has stopped and the temp file can be encoded */
  finalizeSession: (payload: FinalizePayload): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.RECORDING_FINALIZE, payload),

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_GET),

  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, settings),

  chooseOutputDir: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.SETTINGS_CHOOSE_DIR),

  openOutputDir: (): Promise<void> =>
    ipcRenderer.invoke(IPC.SETTINGS_OPEN_DIR),

  detectHardware: (): Promise<HardwareInfo> =>
    ipcRenderer.invoke(IPC.HARDWARE_DETECT),

  // ── File History ─────────────────────────────────────────────────────────
  getHistory: (): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke(IPC.FILES_GET_HISTORY),

  openFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FILES_OPEN, filePath),

  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FILES_OPEN_FOLDER, filePath),

  deleteHistoryEntry: (id: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.FILES_DELETE, id),

  // ── App ──────────────────────────────────────────────────────────────────
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke(IPC.APP_GET_VERSION),

  minimize: (): void => ipcRenderer.send(IPC.APP_MINIMIZE),
  maximize: (): void => ipcRenderer.send(IPC.APP_MAXIMIZE),
  closeApp: (): void => ipcRenderer.send(IPC.APP_CLOSE),

  // ── Event listeners (main → renderer) ───────────────────────────────────
  onRecordingSessionReady: (cb: (payload: StartRecordingPayload) => void) => {
    ipcRenderer.on(IPC.RECORDING_SESSION_READY, (_e, payload) => cb(payload))
    return () => ipcRenderer.removeAllListeners(IPC.RECORDING_SESSION_READY)
  },

  onRecordingStatus: (cb: (event: RecordingStatusEvent) => void) => {
    ipcRenderer.on(IPC.RECORDING_STATUS, (_e, event) => cb(event))
    return () => ipcRenderer.removeAllListeners(IPC.RECORDING_STATUS)
  },

  onRecordingComplete: (cb: (data: { sessionId: string; outputFilePath: string }) => void) => {
    ipcRenderer.on(IPC.RECORDING_COMPLETE, (_e, data) => cb(data))
    return () => ipcRenderer.removeAllListeners(IPC.RECORDING_COMPLETE)
  },

  onRecordingError: (cb: (data: { sessionId: string; error: string }) => void) => {
    ipcRenderer.on(IPC.RECORDING_ERROR, (_e, data) => cb(data))
    return () => ipcRenderer.removeAllListeners(IPC.RECORDING_ERROR)
  },

  onHotkeyStart: (cb: () => void) => {
    ipcRenderer.on('hotkey:start', cb)
    return () => ipcRenderer.removeAllListeners('hotkey:start')
  },

  onHotkeyStop: (cb: () => void) => {
    ipcRenderer.on('hotkey:stop', cb)
    return () => ipcRenderer.removeAllListeners('hotkey:stop')
  },

  onHotkeyPause: (cb: () => void) => {
    ipcRenderer.on('hotkey:pause', cb)
    return () => ipcRenderer.removeAllListeners('hotkey:pause')
  },

  onHotkeyResume: (cb: () => void) => {
    ipcRenderer.on('hotkey:resume', cb)
    return () => ipcRenderer.removeAllListeners('hotkey:resume')
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (err) {
    console.error(err)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.electronAPI = api
}

export type ElectronAPI = typeof api
