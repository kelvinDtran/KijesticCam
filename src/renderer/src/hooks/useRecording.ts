import { useEffect, useRef, useCallback } from 'react'
import { useAppStore, ActiveSession } from '../store/appStore'
import {
  StartRecordingPayload,
  RecordingConfig,
  AudioSettings,
  VideoSettings,
} from '../../../shared/types'

interface PerSessionRecorder {
  mediaRecorder: MediaRecorder
  stream: MediaStream
  startTime: number
  durationMs: number
}

/**
 * useRecording hook manages the renderer-side of the recording pipeline.
 *
 * When main sends RECORDING_SESSION_READY, this hook:
 *  1. Gets the MediaStream for the source via desktopCapturer
 *  2. Mixes audio (system + mic) using Web Audio API
 *  3. Creates a MediaRecorder and starts recording
 *  4. Streams chunks to main via IPC every ~1 second
 *
 * When stop is requested, it stops each MediaRecorder and calls finalizeSession.
 */
export function useRecording() {
  const {
    globalStatus,
    sessions,
    setGlobalStatus,
    setSession,
    removeSession,
    updateSessionDuration,
  } = useAppStore()

  const recorders = useRef<Map<string, PerSessionRecorder>>(new Map())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Timer to update session durations in UI
  useEffect(() => {
    if (globalStatus === 'recording') {
      timerRef.current = setInterval(() => updateSessionDuration(), 250)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [globalStatus])

  // Subscribe to main-process events
  useEffect(() => {
    const offReady = window.electronAPI.onRecordingSessionReady((payload) => {
      startCaptureForSession(payload)
    })

    const offStatus = window.electronAPI.onRecordingStatus((event) => {
      const session = useAppStore.getState().sessions.get(event.sessionId)
      if (!session) return
      setSession({ ...session, status: event.status, progress: event.progress ?? 0 })
      // If any session is recording, mark global as recording
      const states = [...useAppStore.getState().sessions.values()].map((s) => s.status)
      if (states.includes('recording')) setGlobalStatus('recording')
      else if (states.every((s) => s === 'idle' || s === 'encoding')) {
        const anyEncoding = states.includes('encoding')
        setGlobalStatus(anyEncoding ? 'encoding' : 'idle')
      }
    })

    const offComplete = window.electronAPI.onRecordingComplete(({ sessionId }) => {
      removeSession(sessionId)
      const remaining = [...useAppStore.getState().sessions.values()]
      if (remaining.length === 0) setGlobalStatus('idle')
    })

    const offStop = window.electronAPI.onHotkeyStop(() => stopAll())
    const offPause = window.electronAPI.onHotkeyPause(() => pauseAll())
    const offResume = window.electronAPI.onHotkeyResume(() => resumeAll())

    return () => {
      offReady()
      offStatus()
      offComplete()
      offStop()
      offPause()
      offResume()
    }
  }, [])

  const startCaptureForSession = useCallback(async (payload: StartRecordingPayload) => {
    try {
      const stream = await buildCaptureStream(payload)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: getSupportedMimeType(),
        videoBitsPerSecond: getVideoBitrate(payload.video),
        audioBitsPerSecond: 192000,
      })

      const startTime = Date.now()

      // Register in store
      setSession({
        id: payload.sessionId,
        sourceName: payload.sourceName,
        status: 'recording',
        progress: 0,
        startTime,
        durationSec: 0,
      })

      const rec: PerSessionRecorder = {
        mediaRecorder,
        stream,
        startTime,
        durationMs: 0,
      }
      recorders.current.set(payload.sessionId, rec)

      // Stream chunks to main process
      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size === 0) return
        const buffer = await e.data.arrayBuffer()
        window.electronAPI.sendChunk({
          sessionId: payload.sessionId,
          data: new Uint8Array(buffer),
        })
      }

      mediaRecorder.onstop = async () => {
        const r = recorders.current.get(payload.sessionId)
        if (!r) return
        r.durationMs = Date.now() - r.startTime
        r.stream.getTracks().forEach((t) => t.stop())
        recorders.current.delete(payload.sessionId)

        await window.electronAPI.finalizeSession({
          sessionId: payload.sessionId,
          durationMs: r.durationMs,
        })
      }

      mediaRecorder.start(1000)  // emit chunks every 1 second
      setGlobalStatus('recording')
    } catch (err) {
      console.error('startCaptureForSession error:', err)
    }
  }, [])

  const stopAll = useCallback(async () => {
    await window.electronAPI.stopRecording()
    setGlobalStatus('stopping')
    for (const [, rec] of recorders.current) {
      if (rec.mediaRecorder.state !== 'inactive') {
        rec.mediaRecorder.stop()
      }
    }
  }, [])

  const pauseAll = useCallback(async () => {
    await window.electronAPI.pauseRecording()
    for (const [, rec] of recorders.current) {
      if (rec.mediaRecorder.state === 'recording') {
        rec.mediaRecorder.pause()
      }
    }
    setGlobalStatus('paused')
  }, [])

  const resumeAll = useCallback(async () => {
    await window.electronAPI.resumeRecording()
    for (const [, rec] of recorders.current) {
      if (rec.mediaRecorder.state === 'paused') {
        rec.mediaRecorder.resume()
      }
    }
    setGlobalStatus('recording')
  }, [])

  const startRecording = useCallback(async (config: RecordingConfig) => {
    setGlobalStatus('recording')
    const result = await window.electronAPI.startRecording(config)
    if (!result.ok) {
      console.error('startRecording failed:', result.error)
      setGlobalStatus('idle')
    }
  }, [])

  return {
    globalStatus,
    sessions,
    startRecording,
    stopAll,
    pauseAll,
    resumeAll,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildCaptureStream(payload: StartRecordingPayload): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    video: {
      // @ts-ignore — Electron-specific constraint
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: payload.sourceName,  // source.id is passed via payload
        minFrameRate: payload.video.frameRate,
        maxFrameRate: payload.video.frameRate,
      },
    },
    audio: false,
  }

  // We'll get the source ID from the sources list in the store.
  // payload.sourceName here is used as a display label; source.id is needed.
  // The actual source ID is embedded in the StartRecordingPayload's context via
  // the RecordingConfig → sources list. We use sourceName to look it up.
  // For a cleaner solution, we pass sourceId directly.
  const sources = await window.electronAPI.getSources()
  const matchedSource = sources.find(
    (s) => s.name === payload.sourceName || s.id === payload.sourceName
  )

  if (matchedSource) {
    // @ts-ignore
    constraints.video = {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: matchedSource.id,
        minFrameRate: payload.video.frameRate,
        maxFrameRate: payload.video.frameRate,
      },
    }
  }

  const videoStream = await navigator.mediaDevices.getUserMedia(constraints)

  // Build audio stream
  const audioTracks: MediaStreamTrack[] = []

  if (payload.audio.systemAudioEnabled) {
    try {
      const systemStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // @ts-ignore
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: matchedSource?.id ?? '',
          },
        },
        video: false,
      })
      audioTracks.push(...systemStream.getAudioTracks())
    } catch {
      // System audio may not be available on some configs
    }
  }

  if (payload.audio.microphoneEnabled) {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: payload.audio.microphoneDeviceId ?? undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      })
      audioTracks.push(...micStream.getAudioTracks())
    } catch {
      // Mic not available
    }
  }

  if (audioTracks.length > 0) {
    // Mix audio with gain nodes
    const ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()

    const systemGain = payload.audio.systemAudioGain
    const micGain = payload.audio.microphoneGain

    let trackIdx = 0
    if (payload.audio.systemAudioEnabled && audioTracks[trackIdx]) {
      const src = ctx.createMediaStreamSource(new MediaStream([audioTracks[trackIdx++]]))
      const gain = ctx.createGain()
      gain.gain.value = systemGain
      src.connect(gain)
      gain.connect(dest)
    }

    if (payload.audio.microphoneEnabled && audioTracks[trackIdx]) {
      const src = ctx.createMediaStreamSource(new MediaStream([audioTracks[trackIdx]]))
      const gain = ctx.createGain()
      gain.gain.value = micGain
      src.connect(gain)
      gain.connect(dest)
    }

    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ])
    return combined
  }

  return videoStream
}

function getSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

/** Estimate target video bitrate based on quality preset and codec settings. */
function getVideoBitrate(video: VideoSettings): number {
  const presetBitrates: Record<string, number> = {
    efficiency: 3_000_000,   // 3 Mbps — sufficient for 1080p screen content at 60fps
    balanced: 8_000_000,     // 8 Mbps
    quality: 20_000_000,     // 20 Mbps — near-lossless for 4K
  }
  return presetBitrates[video.qualityPreset] ?? 8_000_000
}
