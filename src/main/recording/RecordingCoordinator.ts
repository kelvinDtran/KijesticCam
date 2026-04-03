import { BrowserWindow } from 'electron'
import {
  RecordingConfig,
  RecordingStatus,
  IPC,
  ChunkPayload,
  FinalizePayload,
} from '../../shared/types'
import { RecordingSession } from './RecordingSession'
import { logger } from '../logger'

/**
 * RecordingCoordinator manages multiple concurrent RecordingSession instances.
 *
 * Multi-source strategy: one independent RecordingSession per selected source.
 * All sessions start within the same tick so they are synchronized as closely
 * as the IPC + OS scheduling allows. Each produces its own output file.
 *
 * The coordinator tracks overall state (are any sessions still active?)
 * and aggregates events back to the renderer.
 */
export class RecordingCoordinator {
  private sessions = new Map<string, RecordingSession>()
  private win: BrowserWindow | null = null
  private _status: RecordingStatus = 'idle'
  private sessionStartTimes = new Map<string, number>()

  setWindow(win: BrowserWindow): void {
    this.win = win
  }

  get status(): RecordingStatus {
    return this._status
  }

  isActive(): boolean {
    return this._status === 'recording' || this._status === 'paused' || this._status === 'encoding'
  }

  /**
   * Start recording all sources in the config simultaneously.
   * Returns array of start payloads, one per session.
   * The caller (IPC handler) sends each payload to the renderer so it can
   * start the corresponding MediaRecorder capture.
   */
  async start(config: RecordingConfig): Promise<void> {
    if (this.isActive()) {
      logger.warn('RecordingCoordinator.start() called while already active — ignoring')
      return
    }

    this.sessions.clear()
    this._status = 'recording'

    // Create all sessions upfront
    for (const source of config.sources) {
      const session = new RecordingSession({
        source,
        video: config.video,
        audio: config.audio,
        outputDir: config.outputDir,
      })
      this.sessions.set(session.id, session)
    }

    // Send start payloads to renderer for each session
    for (const session of this.sessions.values()) {
      const payload = session.getStartPayload()
      session.markRecording()
      this.sessionStartTimes.set(session.id, Date.now())

      if (this.win && !this.win.isDestroyed()) {
        this.win.webContents.send(IPC.RECORDING_SESSION_READY, payload)
      }
    }

    logger.info(`RecordingCoordinator started ${this.sessions.size} session(s)`)
  }

  pause(): void {
    if (this._status !== 'recording') return
    this._status = 'paused'
    for (const session of this.sessions.values()) {
      session.markPaused()
    }
    this.broadcastStatus('paused')
  }

  resume(): void {
    if (this._status !== 'paused') return
    this._status = 'recording'
    for (const session of this.sessions.values()) {
      session.markResumed()
    }
    this.broadcastStatus('recording')
  }

  /** Accept a video chunk from the renderer for a specific session. */
  writeChunk(payload: ChunkPayload): void {
    const session = this.sessions.get(payload.sessionId)
    if (!session) {
      logger.warn(`writeChunk: unknown session ${payload.sessionId}`)
      return
    }
    session.writeChunk(Buffer.from(payload.data))
  }

  /**
   * Finalize a single session. Called once per session from the renderer
   * when its MediaRecorder fires the 'stop' event.
   */
  async finalizeSession(payload: FinalizePayload): Promise<void> {
    const session = this.sessions.get(payload.sessionId)
    if (!session || !this.win) return

    await session.finalize(payload.durationMs, this.win)

    // Notify renderer this session is done
    if (!this.win.isDestroyed()) {
      this.win.webContents.send(IPC.RECORDING_COMPLETE, {
        sessionId: session.id,
        outputFilePath: session.getOutputFilePath(),
      })
    }

    this.sessions.delete(payload.sessionId)

    // All sessions done → reset to idle
    if (this.sessions.size === 0) {
      this._status = 'idle'
      logger.info('All recording sessions complete')
    }
  }

  /** Stop all sessions. Sends stop signals; finalization happens per-session via finalizeSession(). */
  stop(): void {
    if (!this.isActive()) return
    this._status = 'stopping'
    this.broadcastStatus('stopping')
    logger.info('RecordingCoordinator stop requested')
  }

  /** Emergency abort — abandon all sessions without encoding. */
  async abortAll(): Promise<void> {
    for (const session of this.sessions.values()) {
      await session.abort()
    }
    this.sessions.clear()
    this._status = 'idle'
  }

  getSessionIds(): string[] {
    return [...this.sessions.keys()]
  }

  private broadcastStatus(status: RecordingStatus): void {
    if (!this.win || this.win.isDestroyed()) return
    for (const session of this.sessions.values()) {
      this.win.webContents.send(IPC.RECORDING_STATUS, {
        sessionId: session.id,
        status,
      })
    }
  }
}
