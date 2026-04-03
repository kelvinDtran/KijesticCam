import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import path from 'path'
import { app } from 'electron'
import { HardwareDetector } from './HardwareDetector'
import { FFmpegPipeline } from './FFmpegPipeline'
import { HardwareInfo, VideoSettings } from '../../shared/types'
import { logger } from '../logger'

/**
 * Resolves the FFmpeg binary path, preferring a packaged binary in extraResources
 * over the npm-installed one. In production builds, electron-builder copies FFmpeg
 * to resources/ffmpeg/ffmpeg.exe.
 */
function resolveFfmpegPath(): string {
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath
    const packed = path.join(resourcesPath, 'ffmpeg', 'ffmpeg.exe')
    return packed
  }
  // Development: use the npm-installed binary
  return ffmpegInstaller.path
}

class EncoderServiceImpl {
  private readonly ffmpegPath: string
  public readonly pipeline: FFmpegPipeline
  private readonly detector: HardwareDetector
  private hwInfo: HardwareInfo | null = null

  constructor() {
    this.ffmpegPath = resolveFfmpegPath()
    this.pipeline = new FFmpegPipeline(this.ffmpegPath)
    this.detector = new HardwareDetector(this.ffmpegPath)
    logger.info(`FFmpeg path: ${this.ffmpegPath}`)
  }

  async detectHardware(): Promise<HardwareInfo> {
    this.hwInfo = await this.detector.detect()
    return this.hwInfo
  }

  getHardwareInfo(): HardwareInfo | null {
    return this.hwInfo
  }

  /**
   * Determine the best hardware acceleration mode given the detected hardware
   * and user preference. Returns 'none' if hardware acceleration is disabled
   * or unavailable.
   */
  selectHwAccel(settings: VideoSettings): 'nvenc' | 'qsv' | 'amf' | 'none' {
    if (!settings.hardwareAcceleration || !this.hwInfo) return 'none'
    if (this.hwInfo.nvenc) return 'nvenc'
    if (this.hwInfo.quickSync) return 'qsv'
    if (this.hwInfo.amf) return 'amf'
    return 'none'
  }

  getFfmpegPath(): string {
    return this.ffmpegPath
  }
}

export const EncoderService = new EncoderServiceImpl()
