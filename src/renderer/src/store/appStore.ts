import { create } from 'zustand'
import {
  CaptureSource,
  AppSettings,
  HistoryEntry,
  HardwareInfo,
  RecordingStatus,
  DEFAULT_SETTINGS,
} from '../../../shared/types'

export interface ActiveSession {
  id: string
  sourceName: string
  status: RecordingStatus
  progress: number
  startTime: number
  durationSec: number
}

interface AppState {
  // Sources
  sources: CaptureSource[]
  selectedSourceIds: Set<string>
  loadingSources: boolean

  // Audio devices
  audioInputDevices: MediaDeviceInfo[]

  // Recording state
  sessions: Map<string, ActiveSession>
  globalStatus: RecordingStatus

  // Settings
  settings: AppSettings
  loadingSettings: boolean

  // Hardware
  hardware: HardwareInfo | null

  // History
  history: HistoryEntry[]
  loadingHistory: boolean

  // UI
  activePage: 'record' | 'history' | 'settings'

  // Actions
  setSources: (sources: CaptureSource[]) => void
  setLoadingSources: (v: boolean) => void
  toggleSource: (id: string) => void
  setSelectedSources: (ids: string[]) => void

  setAudioInputDevices: (devices: MediaDeviceInfo[]) => void

  setSession: (session: ActiveSession) => void
  removeSession: (id: string) => void
  clearSessions: () => void
  setGlobalStatus: (status: RecordingStatus) => void
  updateSessionDuration: () => void

  setSettings: (s: Partial<AppSettings>) => void
  setLoadingSettings: (v: boolean) => void

  setHardware: (hw: HardwareInfo) => void

  setHistory: (h: HistoryEntry[]) => void
  addHistoryEntry: (entry: HistoryEntry) => void
  removeHistoryEntry: (id: string) => void
  setLoadingHistory: (v: boolean) => void

  setActivePage: (page: AppState['activePage']) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  sources: [],
  selectedSourceIds: new Set(),
  loadingSources: false,

  audioInputDevices: [],

  sessions: new Map(),
  globalStatus: 'idle',

  settings: DEFAULT_SETTINGS,
  loadingSettings: true,

  hardware: null,

  history: [],
  loadingHistory: false,

  activePage: 'record',

  setSources: (sources) => set({ sources }),
  setLoadingSources: (v) => set({ loadingSources: v }),
  toggleSource: (id) =>
    set((state) => {
      const next = new Set(state.selectedSourceIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedSourceIds: next }
    }),
  setSelectedSources: (ids) => set({ selectedSourceIds: new Set(ids) }),

  setAudioInputDevices: (devices) => set({ audioInputDevices: devices }),

  setSession: (session) =>
    set((state) => {
      const next = new Map(state.sessions)
      next.set(session.id, session)
      return { sessions: next }
    }),
  removeSession: (id) =>
    set((state) => {
      const next = new Map(state.sessions)
      next.delete(id)
      return { sessions: next }
    }),
  clearSessions: () => set({ sessions: new Map() }),
  setGlobalStatus: (status) => set({ globalStatus: status }),
  updateSessionDuration: () => {
    const now = Date.now()
    set((state) => {
      const next = new Map(state.sessions)
      for (const [id, session] of next) {
        if (session.status === 'recording') {
          next.set(id, {
            ...session,
            durationSec: (now - session.startTime) / 1000,
          })
        }
      }
      return { sessions: next }
    })
  },

  setSettings: (s) =>
    set((state) => ({ settings: { ...state.settings, ...s } })),
  setLoadingSettings: (v) => set({ loadingSettings: v }),

  setHardware: (hw) => set({ hardware: hw }),

  setHistory: (h) => set({ history: h }),
  addHistoryEntry: (entry) =>
    set((state) => ({ history: [entry, ...state.history] })),
  removeHistoryEntry: (id) =>
    set((state) => ({ history: state.history.filter((e) => e.id !== id) })),
  setLoadingHistory: (v) => set({ loadingHistory: v }),

  setActivePage: (page) => set({ activePage: page }),
}))
