import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import { VideoSettings } from '../../shared/types'
import { getEncoderParams } from './presets'
import { logger } from '../logger'

export interface TranscodeOptions {
  inputPath: string
  outputPath: string
  videoSettings: VideoSettings
  hwAccel: 'nvenc' | 'qsv' | 'amf' | 'none'
  onProgress?: (percent: number) => void
}

/**
 * Re-encode a captured WebM file into the target format using FFmpeg.
 *
 * The MediaRecorder in the renderer produces a WebM container (VP8/VP9 + Opus).
 * This pipeline converts it to MP4 or MKV with H.264/H.265/AV1 depending on settings.
 *
 * Output container is chosen based on codec:
 * - H.264/H.265 → MP4 (broad compatibility, -movflags +faststart for streaming)
 * - AV1 → MKV (better container support for AV1)
 */
export class FFmpegPipeline {
  constructor(private ffmpegBinaryPath: string) {
    ffmpeg.setFfmpegPath(ffmpegBinaryPath)
  }

  transcode(options: TranscodeOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const { inputPath, outputPath, videoSettings, hwAccel, onProgress } = options
      const params = getEncoderParams(videoSettings, hwAccel)

      logger.info(`Transcoding: ${path.basename(inputPath)} → ${path.basename(outputPath)}`)
      logger.debug(`Encoder: ${params.videoCodec} preset=${params.preset} ` +
        (params.crf !== undefined ? `crf=${params.crf}` : `cq=${params.cq}`))

      const cmd = ffmpeg(inputPath)
        .videoCodec(params.videoCodec)
        .audioCodec(params.audioCodec)
        .outputOptions([
          '-preset', params.preset,
          '-pix_fmt', params.pixelFormat,
          '-b:a', params.audioBitrate,
          ...params.extraVideoArgs,
        ])
        .outputOptions(
          params.crf !== undefined
            ? ['-crf', String(params.crf)]
            : ['-cq', String(params.cq ?? 23)]
        )
        .outputOptions(['-r', String(videoSettings.frameRate)])
        .output(outputPath)
        .on('start', (cmd) => logger.debug(`FFmpeg cmd: ${cmd}`))
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(Math.min(progress.percent, 100))
          }
        })
        .on('end', () => {
          logger.info(`Transcode complete: ${path.basename(outputPath)}`)
          resolve()
        })
        .on('error', (err) => {
          logger.error(`FFmpeg error: ${err.message}`)
          reject(err)
        })

      if (params.tune) {
        cmd.outputOptions(['-tune', params.tune])
      }

      cmd.run()
    })
  }

  /**
   * Copy the WebM file directly without re-encoding (fastest, no quality loss,
   * but stays as WebM). Used as fallback when encoding fails.
   */
  copyToMkv(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('copy')
        .audioCodec('copy')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })
  }

  /**
   * Probe a file to get duration, codec, resolution info.
   */
  probe(filePath: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  }

  async getVideoInfo(filePath: string): Promise<{ duration: number; width: number; height: number; codec: string }> {
    const data = await this.probe(filePath)
    const videoStream = data.streams.find((s) => s.codec_type === 'video')
    return {
      duration: data.format.duration ?? 0,
      width: videoStream?.width ?? 0,
      height: videoStream?.height ?? 0,
      codec: videoStream?.codec_name ?? 'unknown',
    }
  }

  /**
   * Delete a file safely (used to clean up temp files after transcoding).
   */
  async cleanupTemp(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath)
      logger.debug(`Deleted temp file: ${filePath}`)
    } catch (err) {
      logger.warn(`Could not delete temp file ${filePath}: ${err}`)
    }
  }
}
