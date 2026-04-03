import { CaptureSource, AudioSettings, VideoSettings } from '../../../../shared/types'

export type CompositeLayout = 'side-by-side' | 'grid' | 'pip' | 'stacked'

export interface CompositeConfig {
  sources: CaptureSource[]
  audio: AudioSettings
  video: VideoSettings
  layout: CompositeLayout
}

interface SourceCapture {
  source: CaptureSource
  stream: MediaStream
  videoEl: HTMLVideoElement
}

/**
 * CompositeRecorder captures multiple sources simultaneously and draws them
 * onto an OffscreenCanvas (or regular Canvas as fallback), then feeds the
 * canvas MediaStream to a single MediaRecorder.
 *
 * Layout strategies:
 *   side-by-side  — all sources in a horizontal row (good for 2 screens)
 *   stacked       — all sources in a vertical column
 *   grid          — square grid (good for 3–4 sources)
 *   pip           — first source is full-size, remaining are small overlays
 *
 * Canvas resolution is calculated from the actual source stream dimensions
 * so 4K sources are preserved at full resolution.
 */
export class CompositeRecorder {
  private captures: SourceCapture[] = []
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private animFrameId: number | null = null
  private audioContext: AudioContext | null = null
  private mediaRecorder: MediaRecorder | null = null
  private startTime = 0
  private readonly layout: CompositeLayout
  private readonly audio: AudioSettings
  private readonly video: VideoSettings

  constructor(private config: CompositeConfig) {
    this.layout = config.layout
    this.audio = config.audio
    this.video = config.video
  }

  /** Set up all source streams. Call before start(). */
  async prepare(): Promise<void> {
    this.captures = await Promise.all(
      this.config.sources.map((src) => this.captureSource(src))
    )
  }

  /**
   * Start compositing and recording.
   * @param onChunk  called for each MediaRecorder chunk (~1s)
   * @param onStop   called when MediaRecorder fully stops
   */
  start(
    onChunk: (data: ArrayBuffer) => void,
    onStop: (durationMs: number) => void
  ): void {
    if (this.captures.length === 0) throw new Error('Call prepare() first')

    // Wait for all video elements to have valid dimensions
    const { width, height } = this.calculateCanvasSize()

    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    this.ctx = this.canvas.getContext('2d', { alpha: false })!

    // Start render loop
    this.startTime = Date.now()
    this.renderFrame()

    // Capture canvas stream at target FPS
    const canvasStream = this.canvas.captureStream(this.video.frameRate)

    // Build mixed audio stream
    const mixedAudioStream = this.buildAudioMix()
    const allTracks = [
      ...canvasStream.getVideoTracks(),
      ...mixedAudioStream.getAudioTracks(),
    ]
    const compositeStream = new MediaStream(allTracks)

    this.mediaRecorder = new MediaRecorder(compositeStream, {
      mimeType: getSupportedMimeType(),
      videoBitsPerSecond: getVideoBitrate(this.video),
      audioBitsPerSecond: 192_000,
    })

    this.mediaRecorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        onChunk(await e.data.arrayBuffer())
      }
    }

    this.mediaRecorder.onstop = () => {
      onStop(Date.now() - this.startTime)
      this.cleanup()
    }

    this.mediaRecorder.start(1000)
  }

  pause(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause()
    }
  }

  resume(): void {
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume()
    }
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    } else {
      this.cleanup()
    }
  }

  getDurationMs(): number {
    return this.startTime ? Date.now() - this.startTime : 0
  }

  /** Returns a live preview stream from the composite canvas, or null before start(). */
  getPreviewStream(): MediaStream | null {
    return this.canvas ? this.canvas.captureStream(this.video.frameRate) : null
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async captureSource(source: CaptureSource): Promise<SourceCapture> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        // @ts-ignore — Electron-specific mandatory constraints
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          minFrameRate: this.video.frameRate,
          maxFrameRate: this.video.frameRate,
        },
      },
      audio: false, // audio is handled separately via buildAudioMix()
    })

    const videoEl = document.createElement('video')
    videoEl.srcObject = stream
    videoEl.muted = true
    videoEl.autoplay = true
    await videoEl.play()

    return { source, stream, videoEl }
  }

  private buildAudioMix(): MediaStream {
    const ctx = new AudioContext()
    this.audioContext = ctx
    const dest = ctx.createMediaStreamDestination()

    if (this.audio.systemAudioEnabled) {
      // System audio from first source (loopback captures all system audio)
      const firstCapture = this.captures[0]
      if (firstCapture) {
        this.tryAddSystemAudio(ctx, dest, firstCapture.source.id)
      }
    }

    if (this.audio.microphoneEnabled) {
      this.tryAddMicrophone(ctx, dest)
    }

    return dest.stream
  }

  private tryAddSystemAudio(
    ctx: AudioContext,
    dest: MediaStreamAudioDestinationNode,
    sourceId: string
  ): void {
    // Attempt to get audio from a loopback stream for the first screen source
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          // @ts-ignore
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          },
        },
        video: false,
      })
      .then((audioStream) => {
        const src = ctx.createMediaStreamSource(audioStream)
        const gain = ctx.createGain()
        gain.gain.value = this.audio.systemAudioGain
        src.connect(gain)
        gain.connect(dest)
      })
      .catch(() => { /* system audio unavailable for this source — silent */ })
  }

  private tryAddMicrophone(ctx: AudioContext, dest: MediaStreamAudioDestinationNode): void {
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: this.audio.microphoneDeviceId ?? undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      })
      .then((micStream) => {
        const src = ctx.createMediaStreamSource(micStream)
        const gain = ctx.createGain()
        gain.gain.value = this.audio.microphoneGain
        src.connect(gain)
        gain.connect(dest)
      })
      .catch(() => { /* mic unavailable */ })
  }

  private renderFrame(): void {
    if (!this.ctx || !this.canvas) return

    const rects = this.computeRects(this.canvas.width, this.canvas.height)

    // Black background
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    for (let i = 0; i < this.captures.length; i++) {
      const { videoEl } = this.captures[i]
      const rect = rects[i]
      if (!rect || videoEl.readyState < 2) continue

      try {
        this.ctx.drawImage(videoEl, rect.x, rect.y, rect.w, rect.h)
      } catch {
        // Frame not ready yet — skip
      }

      // Draw source label overlay
      this.drawLabel(this.captures[i].source.name, rect)
    }

    this.animFrameId = requestAnimationFrame(() => this.renderFrame())
  }

  private drawLabel(name: string, rect: Rect): void {
    if (!this.ctx) return
    const fontSize = Math.max(10, Math.min(16, rect.h * 0.03))
    this.ctx.font = `${fontSize}px -apple-system, sans-serif`
    this.ctx.fillStyle = 'rgba(0,0,0,0.55)'
    const padding = fontSize * 0.6
    const textW = this.ctx.measureText(name).width
    this.ctx.fillRect(rect.x + 8, rect.y + 8, textW + padding * 2, fontSize + padding)
    this.ctx.fillStyle = '#fff'
    this.ctx.fillText(name, rect.x + 8 + padding, rect.y + 8 + fontSize)
  }

  private calculateCanvasSize(): { width: number; height: number } {
    // Use first video element's natural dimensions, or fallback
    const first = this.captures[0]
    const srcW = first?.videoEl.videoWidth || 1920
    const srcH = first?.videoEl.videoHeight || 1080
    const n = this.captures.length

    switch (this.layout) {
      case 'side-by-side':
        return { width: srcW * n, height: srcH }
      case 'stacked':
        return { width: srcW, height: srcH * n }
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(n))
        const rows = Math.ceil(n / cols)
        return { width: srcW * cols, height: srcH * rows }
      }
      case 'pip':
        // Main source full size; pip sources are 1/4 width overlaid
        return { width: srcW, height: srcH }
    }
  }

  private computeRects(totalW: number, totalH: number): Rect[] {
    const n = this.captures.length
    if (n === 0) return []

    switch (this.layout) {
      case 'side-by-side': {
        const w = totalW / n
        return this.captures.map((_, i) => ({ x: i * w, y: 0, w, h: totalH }))
      }
      case 'stacked': {
        const h = totalH / n
        return this.captures.map((_, i) => ({ x: 0, y: i * h, w: totalW, h }))
      }
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(n))
        const rows = Math.ceil(n / cols)
        const w = totalW / cols
        const h = totalH / rows
        return this.captures.map((_, i) => ({
          x: (i % cols) * w,
          y: Math.floor(i / cols) * h,
          w,
          h,
        }))
      }
      case 'pip': {
        const rects: Rect[] = [{ x: 0, y: 0, w: totalW, h: totalH }]
        const pipW = Math.round(totalW * 0.25)
        const pipH = Math.round(totalH * 0.25)
        const margin = 16
        for (let i = 1; i < n; i++) {
          rects.push({
            x: totalW - pipW - margin - (i - 1) * (pipW + margin),
            y: totalH - pipH - margin,
            w: pipW,
            h: pipH,
          })
        }
        return rects
      }
    }
  }

  private cleanup(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
    for (const cap of this.captures) {
      cap.stream.getTracks().forEach((t) => t.stop())
      cap.videoEl.srcObject = null
    }
    this.captures = []
    this.audioContext?.close()
    this.audioContext = null
    this.canvas = null
    this.ctx = null
  }
}

interface Rect { x: number; y: number; w: number; h: number }

function getSupportedMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

function getVideoBitrate(video: VideoSettings): number {
  return { efficiency: 3_000_000, balanced: 8_000_000, quality: 20_000_000 }[video.qualityPreset] ?? 8_000_000
}
