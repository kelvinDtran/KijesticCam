import { getEncoderParams, ENCODER_MATRIX } from '../main/encoding/presets'
import { VideoSettings } from '../shared/types'

describe('Encoder Presets', () => {
  const baseSettings: VideoSettings = {
    codec: 'h264',
    qualityPreset: 'balanced',
    frameRate: 60,
    hardwareAcceleration: true,
  }

  test('returns software H.264 balanced params', () => {
    const params = getEncoderParams({ ...baseSettings }, 'none')
    expect(params.videoCodec).toBe('libx264')
    expect(params.crf).toBe(23)
    expect(params.preset).toBe('fast')
    expect(params.audioCodec).toBe('aac')
  })

  test('returns NVENC H.264 params when hardware available', () => {
    const params = getEncoderParams(baseSettings, 'nvenc')
    expect(params.videoCodec).toBe('h264_nvenc')
    expect(params.cq).toBe(23)
  })

  test('returns H.265 software efficiency params', () => {
    const params = getEncoderParams(
      { ...baseSettings, codec: 'h265', qualityPreset: 'efficiency' },
      'none'
    )
    expect(params.videoCodec).toBe('libx265')
    expect(params.crf).toBe(28)
  })

  test('NVENC H.265 quality params have lower CQ', () => {
    const efficiency = getEncoderParams(
      { ...baseSettings, codec: 'h265', qualityPreset: 'efficiency' },
      'nvenc'
    )
    const quality = getEncoderParams(
      { ...baseSettings, codec: 'h265', qualityPreset: 'quality' },
      'nvenc'
    )
    expect(quality.cq!).toBeLessThan(efficiency.cq!)
  })

  test('AV1 software uses libsvtav1', () => {
    const params = getEncoderParams({ ...baseSettings, codec: 'av1' }, 'none')
    expect(params.videoCodec).toBe('libsvtav1')
  })

  test('all codec/preset/hwaccel combinations are defined', () => {
    const codecs = ['h264', 'h265', 'av1'] as const
    const presets = ['efficiency', 'balanced', 'quality'] as const
    const hws = ['software', 'nvenc', 'qsv', 'amf'] as const

    for (const codec of codecs) {
      for (const preset of presets) {
        for (const hw of hws) {
          const entry = ENCODER_MATRIX[codec][hw][preset]
          expect(entry).toBeDefined()
          expect(entry.videoCodec).toBeTruthy()
          expect(entry.audioCodec).toBeTruthy()
        }
      }
    }
  })
})
