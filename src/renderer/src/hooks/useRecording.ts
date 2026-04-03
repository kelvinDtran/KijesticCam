import { useEffect, useRef, useCallback, useState } from 'react'
import { useAppStore, ActiveSession } from '../store/appStore'
import {
  StartRecordingPayload,
  RecordingConfig,
  AudioSettings,
  VideoSettings,
} from '../../../shared/types'
import { CompositeRecorder, CompositeLayout } from '../capture/CompositeRecorder'

export interface PreviewStream {
  sessionId: string
  stream: MediaStream
  sourceName: string
}

interface PerSessionRecorder {
  mediaRecorder: MediaRecorder
  stream: MediaStream
  startTime: number
  durationMs: number
}

/**
 * useRecording manages the renderer side of the recording pipeline.
 *
 * SEPARATE MODE (default):
 *   Main sends RECORDING_SESSION_READY for each source.
 *   Renderer starts one MediaRecorder per source, streams 1s chunks to main.
 *   Main writes chunks to .webm, then FFmpeg re-encodes on stop.
 *
 * COMPOSITE MODE:
 *   Renderer manages a CompositeRecorder that canvas-composites all sources.
 *   A single session is created in main. All canvas chunks go to that one session.
 *   Layout options: side-by-side, stacked, grid, pip.
 */
export function useRecording() {
  const globalStatus = useAppStore((s) => s.globalStatus)
  const sessions = useAppStore((s) => s.sessions)
  const setGlobalStatus = useAppStore((s) => s.setGlobalStatus)
  const setSession = useAppStore((s) => s.setSession)
  const removeSession = useAppStore((s) => s.removeSession)
  const updateSessionDuration = useAppStore((s) => s.updateSessionDuration)

  const recorders = useRef<Map<string, PerSessionRecorder>>(new Map())
  const compositeRef = useRef<CompositeRecorder | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [previewStreams, setPreviewStreams] = useState<PreviewStream[]>([])
  // Serializes getDisplayMedia() calls — only one capture request active at a time
  const captureChainRef = useRef<Promise<void>>(Promise.resolve())

  // Clear preview when recording finishes
  useEffect(() => {
    if (globalStatus === 'idle') setPreviewStreams([])
  }, [globalStatus])

  // Tick session durations while recording
  useEffect(() => {
    if (globalStatus === 'recording') {
      timerRef.current = setInterval(() => updateSessionDuration(), 250)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [globalStatus])

  // Subscribe to main-process events
  useEffect(() => {
    const offReady = window.electronAPI.onRecordingSessionReady((payload) => {
      startCaptureForSession(payload)
    })

    const offStatus = window.electronAPI.onRecordingStatus((event) => {
      const current = useAppStore.getState().sessions.get(event.sessionId)
      if (!current) return
      setSession({ ...current, status: event.status, progress: event.progress ?? 0 })
      const statuses = [...useAppStore.getState().sessions.values()].map((s) => s.status)
      if (statuses.includes('recording')) setGlobalStatus('recording')
      else if (statuses.every((s) => s === 'idle' || s === 'encoding')) {
        setGlobalStatus(statuses.includes('encoding') ? 'encoding' : 'idle')
      }
    })

    const offComplete = window.electronAPI.onRecordingComplete(({ sessionId }) => {
      removeSession(sessionId)
      if (useAppStore.getState().sessions.size === 0) setGlobalStatus('idle')
    })

    const offStop    = window.electronAPI.onHotkeyStop(() => stopAll())
    const offPause   = window.electronAPI.onHotkeyPause(() => pauseAll())
    const offResume  = window.electronAPI.onHotkeyResume(() => resumeAll())

    return () => { offReady(); offStatus(); offComplete(); offStop(); offPause(); offResume() }
  }, [])

  // ── SEPARATE MODE: one MediaRecorder per RECORDING_SESSION_READY event ─────

  const startCaptureForSession = useCallback((payload: StartRecordingPayload) => {
    // Queue behind any in-flight capture — getDisplayMedia() calls must be serialized
    // because each one uses a single pending-source slot in the main process.
    captureChainRef.current = captureChainRef.current
      .catch(() => {})
      .then(() => doCaptureForSession(payload))
  }, []) // eslint-disable-line

  const doCaptureForSession = useCallback(async (payload: StartRecordingPayload) => {
    try {
      const stream = await buildCaptureStream(payload)
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: getSupportedMimeType(),
        videoBitsPerSecond: getVideoBitrate(payload.video),
        audioBitsPerSecond: 192_000,
      })

      const startTime = Date.now()
      setSession({
        id: payload.sessionId,
        sourceName: payload.sourceName,
        status: 'recording',
        progress: 0,
        startTime,
        durationSec: 0,
      })

      const rec: PerSessionRecorder = { mediaRecorder, stream, startTime, durationMs: 0 }
      recorders.current.set(payload.sessionId, rec)
      setPreviewStreams((prev) => [...prev, { sessionId: payload.sessionId, stream, sourceName: payload.sourceName }])

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size === 0) return
        window.electronAPI.sendChunk({
          sessionId: payload.sessionId,
          data: new Uint8Array(await e.data.arrayBuffer()),
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

      mediaRecorder.start(1000)
      setGlobalStatus('recording')
    } catch (err) {
      console.error('startCaptureForSession error:', err)
    }
  }, [])

  // ── COMPOSITE MODE: one CompositeRecorder for all sources together ──────────

  const startCompositeCapture = useCallback(async (
    config: RecordingConfig,
    sessionId: string
  ) => {
    const layout = (config as RecordingConfig & { compositeLayout?: CompositeLayout })
      .compositeLayout ?? 'side-by-side'

    const compositor = new CompositeRecorder({
      sources: config.sources,
      audio: config.audio,
      video: config.video,
      layout,
    })

    compositeRef.current = compositor
    await compositor.prepare()

    setSession({
      id: sessionId,
      sourceName: config.sources.map((s) => s.name).join(' + '),
      status: 'recording',
      progress: 0,
      startTime: Date.now(),
      durationSec: 0,
    })

    compositor.start(
      // onChunk
      (buffer) => {
        window.electronAPI.sendChunk({
          sessionId,
          data: new Uint8Array(buffer),
        })
      },
      // onStop
      async (durationMs) => {
        compositeRef.current = null
        setPreviewStreams([])
        await window.electronAPI.finalizeSession({ sessionId, durationMs })
      }
    )

    const previewStream = compositor.getPreviewStream()
    if (previewStream) {
      const compositeName = config.sources.map((s) => s.name).join(' + ')
      setPreviewStreams([{ stream: previewStream, sourceName: compositeName }])
    }

    setGlobalStatus('recording')
  }, [])

  // ── Public API ──────────────────────────────────────────────────────────────

  const startRecording = useCallback(async (config: RecordingConfig) => {
    setGlobalStatus('recording')

    if (config.multiSourceMode === 'composite' && config.sources.length > 1) {
      // In composite mode: tell main to create ONE session for "composite",
      // then handle all capture in the renderer via CompositeRecorder.
      const result = await window.electronAPI.startRecording({
        ...config,
        // Override to single "composite" source so coordinator creates one session
        sources: [{
          id: 'composite',
          name: config.sources.map((s) => s.name).join(' + '),
          type: 'screen',
        }],
      })
      if (!result.ok) {
        console.error('startRecording failed:', result.error)
        setGlobalStatus('idle')
        return
      }
      // The RECORDING_SESSION_READY event from main gives us the sessionId.
      // We intercept it via a one-shot listener here instead of startCaptureForSession.
      const removeListener = window.electronAPI.onRecordingSessionReady(async (payload) => {
        removeListener()
        await startCompositeCapture(config, payload.sessionId)
      })
    } else {
      // Separate mode (default): main creates one session per source
      const result = await window.electronAPI.startRecording(config)
      if (!result.ok) {
        console.error('startRecording failed:', result.error)
        setGlobalStatus('idle')
      }
    }
  }, [startCompositeCapture])

  const stopSession = useCallback((sessionId: string) => {
    setPreviewStreams((prev) => prev.filter((ps) => ps.sessionId !== sessionId))
    const rec = recorders.current.get(sessionId)
    if (rec && rec.mediaRecorder.state !== 'inactive') {
      rec.mediaRecorder.stop()  // triggers onstop → finalizeSession
    }
  }, [])

  const stopAll = useCallback(async () => {
    setPreviewStreams([])
    await window.electronAPI.stopRecording()
    setGlobalStatus('stopping')

    // Stop composite recorder if active
    if (compositeRef.current) {
      compositeRef.current.stop()
      return
    }

    // Stop all per-session recorders
    for (const [, rec] of recorders.current) {
      if (rec.mediaRecorder.state !== 'inactive') {
        rec.mediaRecorder.stop()
      }
    }
  }, [])

  const pauseAll = useCallback(async () => {
    await window.electronAPI.pauseRecording()
    compositeRef.current?.pause()
    for (const [, rec] of recorders.current) {
      if (rec.mediaRecorder.state === 'recording') rec.mediaRecorder.pause()
    }
    setGlobalStatus('paused')
  }, [])

  const resumeAll = useCallback(async () => {
    await window.electronAPI.resumeRecording()
    compositeRef.current?.resume()
    for (const [, rec] of recorders.current) {
      if (rec.mediaRecorder.state === 'paused') rec.mediaRecorder.resume()
    }
    setGlobalStatus('recording')
  }, [])

  return { globalStatus, sessions, previewStreams, startRecording, stopAll, stopSession, pauseAll, resumeAll }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildCaptureStream(payload: StartRecordingPayload): Promise<MediaStream> {
  // Register the desired source BEFORE calling getDisplayMedia() so the main-process
  // setDisplayMediaRequestHandler can return the correct window/screen source.
  await window.electronAPI.setCaptureSource(payload.sourceId)

  // Use getDisplayMedia() — the only allowed path for desktop capture in Electron 35+.
  // System audio loopback is provided by the handler via { audio: 'loopback' }.
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: payload.video.frameRate } as MediaTrackConstraints,
    audio: payload.audio.systemAudioEnabled,
  })

  const videoTracks = displayStream.getVideoTracks()
  const systemAudioTracks = displayStream.getAudioTracks()
  const micAudioTracks: MediaStreamTrack[] = []

  if (payload.audio.microphoneEnabled) {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: payload.audio.microphoneDeviceId ?? undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      })
      micAudioTracks.push(...mic.getAudioTracks())
    } catch { /* mic unavailable */ }
  }

  if (systemAudioTracks.length === 0 && micAudioTracks.length === 0) {
    return new MediaStream(videoTracks)
  }

  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()

  if (systemAudioTracks.length > 0) {
    const gain = ctx.createGain()
    gain.gain.value = payload.audio.systemAudioGain
    ctx.createMediaStreamSource(new MediaStream(systemAudioTracks)).connect(gain)
    gain.connect(dest)
  }
  if (micAudioTracks.length > 0) {
    const gain = ctx.createGain()
    gain.gain.value = payload.audio.microphoneGain
    ctx.createMediaStreamSource(new MediaStream(micAudioTracks)).connect(gain)
    gain.connect(dest)
  }

  return new MediaStream([...videoTracks, ...dest.stream.getAudioTracks()])
}

function getSupportedMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

function getVideoBitrate(video: VideoSettings): number {
  return { efficiency: 3_000_000, balanced: 8_000_000, quality: 20_000_000 }[video.qualityPreset] ?? 8_000_000
}
