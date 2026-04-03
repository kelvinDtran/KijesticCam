import { execFile } from 'child_process'
import { promisify } from 'util'
import { HardwareInfo, VideoCodec } from '../../shared/types'
import { logger } from '../logger'

const execFileAsync = promisify(execFile)

/**
 * Probe FFmpeg to determine which hardware encoders are available.
 * We do a fast test encode of a single blank frame to confirm each encoder actually works,
 * not just that it's listed in `ffmpeg -encoders`.
 */
export class HardwareDetector {
  private ffmpegPath: string
  private cached: HardwareInfo | null = null

  constructor(ffmpegPath: string) {
    this.ffmpegPath = ffmpegPath
  }

  async detect(): Promise<HardwareInfo> {
    if (this.cached) return this.cached

    const [nvenc, qsv, amf] = await Promise.all([
      this.testEncoder('h264_nvenc'),
      this.testEncoder('h264_qsv'),
      this.testEncoder('h264_amf'),
    ])

    const gpuName = await this.getGpuName()

    let recommendedCodec: VideoCodec = 'h264'
    if (nvenc || qsv || amf) {
      // H.265 gives ~40-50% better compression than H.264 at same quality
      const hasH265 = await this.testEncoder(nvenc ? 'hevc_nvenc' : qsv ? 'hevc_qsv' : 'hevc_amf')
      if (hasH265) recommendedCodec = 'h265'
    }

    this.cached = { nvenc, quickSync: qsv, amf, recommendedCodec, gpuName }
    logger.info(
      `Hardware detection: NVENC=${nvenc} QSV=${qsv} AMF=${amf} GPU="${gpuName}" recommended=${recommendedCodec}`
    )
    return this.cached
  }

  private async testEncoder(encoderName: string): Promise<boolean> {
    try {
      // Encode a 1-frame 32x32 black video as null output to test encoder availability
      await execFileAsync(
        this.ffmpegPath,
        [
          '-f', 'lavfi', '-i', 'color=black:s=32x32:r=1',
          '-frames:v', '1',
          '-c:v', encoderName,
          '-f', 'null', '-',
        ],
        { timeout: 8000 }
      )
      return true
    } catch {
      return false
    }
  }

  private async getGpuName(): Promise<string | null> {
    if (process.platform !== 'win32') return null
    try {
      const { stdout } = await execFileAsync('wmic', [
        'path', 'win32_VideoController', 'get', 'name', '/format:value'
      ], { timeout: 5000 })
      const match = stdout.match(/Name=(.+)/i)
      return match ? match[1].trim() : null
    } catch {
      return null
    }
  }
}
