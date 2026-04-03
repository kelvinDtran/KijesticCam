import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { BrowserWindow } from 'electron'
import {
  CaptureSource,
  RecordingStatus,
  VideoSettings,
  AudioSettings,
  IPC,
  StartRecordingPayload,
  ChunkPayload,
  FinalizePayload,
} from '../../shared/types'
import { buildOutputPaths, getFileSizeBytes } from '../storage/FileManager'
import { EncoderService } from '../encoding/EncoderService'
import { HistoryStore } from '../storage/HistoryStore'
import { logger } from '../logger'

export interface SessionConfig {
  source: CaptureSource
  video: VideoSettings
  audio: AudioSettings
  outputDir: string
}

/**
 * A RecordingSession manages the lifecycle of recording a single capture source.
 *
 * Data flow:
 *   Renderer captures via MediaRecorder → sends binary chunks over IPC
 *   → written to a temp .webm file on disk
 *   → on finalize: FFmpeg transcodes .webm → .mp4/.mkv
 *
 * Each session has its own temp file and output file. Multiple sessions
 * run in parallel for multi-source recording.
 */
export class RecordingSession {
  readonly id: string
  readonly source: CaptureSource
  private status: RecordingStatus = 'idle'
  private writeStream: fs.WriteStream | null = null
  private startTime: number = 0
  private tempFilePath: string = ''
  private outputFilePath: string = ''
  private outputFileName: string = ''
  private readonly video: VideoSettings
  private readonly audio: AudioSettings
  private readonly outputDir: string

  constructor(config: SessionConfig) {
    this.id = uuidv4()
    this.source = config.source
    this.video = config.video
    this.audio = config.audio
    this.outputDir = config.outputDir
  }

  /** Called by RecordingCoordinator after session creation to signal renderer. */
  getStartPayload(): StartRecordingPayload {
    const paths = buildOutputPaths(
      this.outputDir,
      this.source.name,
      this.source.type,
      this.video.codec
    )
    this.tempFilePath = paths.tempFilePath
    this.outputFilePath = paths.outputFilePath
    this.outputFileName = paths.outputFileName

    // Open write stream to temp file immediately
    this.writeStream = fs.createWriteStream(this.tempFilePath)
    this.writeStream.on('error', (err) => {
      logger.error(`Write stream error for session ${this.id}: ${err.message}`)
    })

    return {
      sessionId: this.id,
      sourceId: this.source.id,
      sourceName: this.source.name,
      sourceType: this.source.type,
      outputFileName: this.outputFileName,
      video: this.video,
      audio: this.audio,
    }
  }

  markRecording(): void {
    this.status = 'recording'
    this.startTime = Date.now()
    logger.info(`Session ${this.id} recording started: ${this.source.name}`)
  }

  markPaused(): void {
    this.status = 'paused'
  }

  markResumed(): void {
    this.status = 'recording'
  }

  /** Append a chunk from MediaRecorder to the temp file. */
  writeChunk(data: Buffer): void {
    if (!this.writeStream || this.writeStream.destroyed) return
    this.writeStream.write(data)
  }

  /**
   * Finalize the recording:
   * 1. Close the write stream
   * 2. Run FFmpeg to transcode temp WebM → final file
   * 3. Add to history
   * 4. Clean up temp file
   */
  async finalize(durationMs: number, win: BrowserWindow): Promise<void> {
    this.status = 'encoding'
    logger.info(`Session ${this.id} finalizing (duration: ${(durationMs / 1000).toFixed(1)}s)`)

    // Close write stream
    await new Promise<void>((resolve, reject) => {
      if (!this.writeStream || this.writeStream.destroyed) {
        resolve()
        return
      }
      this.writeStream.end((err?: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })

    const hwAccel = EncoderService.selectHwAccel(this.video)

    // Notify renderer that encoding started
    this.emitStatus(win, 'encoding')

    try {
      await EncoderService.pipeline.transcode({
        inputPath: this.tempFilePath,
        outputPath: this.outputFilePath,
        videoSettings: this.video,
        hwAccel,
        onProgress: (pct) => this.emitProgress(win, pct),
      })
    } catch (transcodeErr) {
      logger.error(`Transcode failed for session ${this.id}, falling back to copy: ${transcodeErr}`)
      // Fallback: copy to MKV without re-encoding
      const fallbackPath = this.outputFilePath.replace(/\.(mp4|mkv)$/, '_copy.mkv')
      await EncoderService.pipeline.copyToMkv(this.tempFilePath, fallbackPath)
      this.outputFilePath = fallbackPath
    }

    // Get final file info for history
    try {
      const info = await EncoderService.pipeline.getVideoInfo(this.outputFilePath)
      const fileSize = getFileSizeBytes(this.outputFilePath)

      HistoryStore.add({
        id: this.id,
        fileName: this.outputFileName,
        filePath: this.outputFilePath,
        duration: durationMs / 1000,
        fileSize: await fileSize,
        resolution: `${info.width}x${info.height}`,
        codec: info.codec,
        frameRate: this.video.frameRate,
        sourceName: this.source.name,
        recordedAt: Date.now(),
      })
    } catch (err) {
      logger.warn(`Could not read file info for history: ${err}`)
    }

    // Clean up temp file
    await EncoderService.pipeline.cleanupTemp(this.tempFilePath)

    this.status = 'idle'
    logger.info(`Session ${this.id} complete: ${path.basename(this.outputFilePath)}`)
  }

  getStatus(): RecordingStatus {
    return this.status
  }

  getTempFilePath(): string {
    return this.tempFilePath
  }

  getOutputFilePath(): string {
    return this.outputFilePath
  }

  getDurationSec(now = Date.now()): number {
    if (!this.startTime) return 0
    return (now - this.startTime) / 1000
  }

  private emitStatus(win: BrowserWindow, status: RecordingStatus): void {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.RECORDING_STATUS, { sessionId: this.id, status })
    }
  }

  private emitProgress(win: BrowserWindow, progress: number): void {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.RECORDING_STATUS, {
        sessionId: this.id,
        status: 'encoding',
        progress,
      })
    }
  }

  /** Emergency cleanup: close write stream without finalizing. */
  async abort(): Promise<void> {
    logger.warn(`Session ${this.id} aborted`)
    if (this.writeStream && !this.writeStream.destroyed) {
      this.writeStream.destroy()
    }
    try {
      await fs.promises.unlink(this.tempFilePath)
    } catch { /* ignore */ }
    this.status = 'idle'
  }
}
