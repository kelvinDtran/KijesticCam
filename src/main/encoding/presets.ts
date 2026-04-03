import { VideoCodec, QualityPreset, VideoSettings } from '../../shared/types'

/**
 * FFmpeg encoding preset parameters.
 *
 * Design philosophy:
 * - "efficiency": CRF 28-32 range → small files, imperceptible quality loss for typical screen content
 * - "balanced": CRF 23-26 → good quality/size tradeoff, recommended default
 * - "quality": CRF 16-18 → near-lossless, larger files
 *
 * Screen recordings differ from natural video: they contain sharp text, UI elements, and
 * static regions. H.264/H.265 with tune=screen (or zerolatency for screen) and high CRF
 * delivers surprisingly small files because the encoder can skip unchanged regions.
 *
 * Hardware encoders (NVENC/QSV/AMF) use CQ (constant quality) mode rather than CRF,
 * which is semantically equivalent but the scale may differ slightly.
 */
export interface EncoderParams {
  videoCodec: string     // e.g. 'libx264', 'h264_nvenc'
  crf?: number           // software encoders
  cq?: number            // hardware encoders (NVENC/AMF)
  preset: string         // encoder speed preset
  tune?: string
  pixelFormat: string
  audioCodec: string
  audioBitrate: string
  extraVideoArgs: string[]
}

type CodecPresetMap = Record<QualityPreset, EncoderParams>
type EncoderMatrix = Record<VideoCodec, { software: CodecPresetMap; nvenc: CodecPresetMap; qsv: CodecPresetMap; amf: CodecPresetMap }>

export const ENCODER_MATRIX: EncoderMatrix = {
  h264: {
    software: {
      efficiency: {
        videoCodec: 'libx264',
        crf: 28,
        preset: 'veryfast',
        tune: 'zerolatency',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '128k',
        extraVideoArgs: ['-movflags', '+faststart'],
      },
      balanced: {
        videoCodec: 'libx264',
        crf: 23,
        preset: 'fast',
        tune: 'zerolatency',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '192k',
        extraVideoArgs: ['-movflags', '+faststart'],
      },
      quality: {
        videoCodec: 'libx264',
        crf: 17,
        preset: 'slow',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '256k',
        extraVideoArgs: ['-movflags', '+faststart'],
      },
    },
    nvenc: {
      efficiency: {
        videoCodec: 'h264_nvenc',
        cq: 28,
        preset: 'p4',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '128k',
        extraVideoArgs: ['-rc', 'vbr', '-movflags', '+faststart'],
      },
      balanced: {
        videoCodec: 'h264_nvenc',
        cq: 23,
        preset: 'p4',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '192k',
        extraVideoArgs: ['-rc', 'vbr', '-movflags', '+faststart'],
      },
      quality: {
        videoCodec: 'h264_nvenc',
        cq: 17,
        preset: 'p7',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '256k',
        extraVideoArgs: ['-rc', 'vbr', '-movflags', '+faststart'],
      },
    },
    qsv: {
      efficiency: {
        videoCodec: 'h264_qsv',
        cq: 28,
        preset: 'faster',
        pixelFormat: 'nv12',
        audioCodec: 'aac',
        audioBitrate: '128k',
        extraVideoArgs: ['-movflags', '+faststart'],
      },
      balanced: {
        videoCodec: 'h264_qsv',
        cq: 23,
        preset: 'medium',
        pixelFormat: 'nv12',
        audioCodec: 'aac',
        audioBitrate: '192k',
        extraVideoArgs: ['-movflags', '+faststart'],
      },
      quality: {
        videoCodec: 'h264_qsv',
        cq: 17,
        preset: 'slow',
        pixelFormat: 'nv12',
        audioCodec: 'aac',
        audioBitrate: '256k',
        extraVideoArgs: ['-movflags', '+faststart'],
      },
    },
    amf: {
      efficiency: {
        videoCodec: 'h264_amf',
        cq: 28,
        preset: 'speed',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '128k',
        extraVideoArgs: ['-rc', 'vbr_latency', '-movflags', '+faststart'],
      },
      balanced: {
        videoCodec: 'h264_amf',
        cq: 23,
        preset: 'balanced',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '192k',
        extraVideoArgs: ['-rc', 'vbr_latency', '-movflags', '+faststart'],
      },
      quality: {
        videoCodec: 'h264_amf',
        cq: 17,
        preset: 'quality',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '256k',
        extraVideoArgs: ['-rc', 'vbr_latency', '-movflags', '+faststart'],
      },
    },
  },

  h265: {
    software: {
      efficiency: {
        videoCodec: 'libx265',
        crf: 28,
        preset: 'veryfast',
        tune: 'zerolatency',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '128k',
        extraVideoArgs: ['-tag:v', 'hvc1'],  // Apple compatibility tag
      },
      balanced: {
        videoCodec: 'libx265',
        crf: 24,
        preset: 'fast',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '192k',
        extraVideoArgs: ['-tag:v', 'hvc1'],
      },
      quality: {
        videoCodec: 'libx265',
        crf: 18,
        preset: 'slow',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '256k',
        extraVideoArgs: ['-tag:v', 'hvc1'],
      },
    },
    nvenc: {
      efficiency: {
        videoCodec: 'hevc_nvenc',
        cq: 28,
        preset: 'p4',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '128k',
        extraVideoArgs: ['-rc', 'vbr', '-tag:v', 'hvc1'],
      },
      balanced: {
        videoCodec: 'hevc_nvenc',
        cq: 24,
        preset: 'p4',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '192k',
        extraVideoArgs: ['-rc', 'vbr', '-tag:v', 'hvc1'],
      },
      quality: {
        videoCodec: 'hevc_nvenc',
        cq: 18,
        preset: 'p7',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '256k',
        extraVideoArgs: ['-rc', 'vbr', '-tag:v', 'hvc1'],
      },
    },
    qsv: {
      efficiency: {
        videoCodec: 'hevc_qsv',
        cq: 28,
        preset: 'faster',
        pixelFormat: 'nv12',
        audioCodec: 'aac',
        audioBitrate: '128k',
        extraVideoArgs: [],
      },
      balanced: {
        videoCodec: 'hevc_qsv',
        cq: 24,
        preset: 'medium',
        pixelFormat: 'nv12',
        audioCodec: 'aac',
        audioBitrate: '192k',
        extraVideoArgs: [],
      },
      quality: {
        videoCodec: 'hevc_qsv',
        cq: 18,
        preset: 'slow',
        pixelFormat: 'nv12',
        audioCodec: 'aac',
        audioBitrate: '256k',
        extraVideoArgs: [],
      },
    },
    amf: {
      efficiency: {
        videoCodec: 'hevc_amf',
        cq: 28,
        preset: 'speed',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '128k',
        extraVideoArgs: ['-rc', 'vbr_latency'],
      },
      balanced: {
        videoCodec: 'hevc_amf',
        cq: 24,
        preset: 'balanced',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '192k',
        extraVideoArgs: ['-rc', 'vbr_latency'],
      },
      quality: {
        videoCodec: 'hevc_amf',
        cq: 18,
        preset: 'quality',
        pixelFormat: 'yuv420p',
        audioCodec: 'aac',
        audioBitrate: '256k',
        extraVideoArgs: ['-rc', 'vbr_latency'],
      },
    },
  },

  av1: {
    software: {
      efficiency: {
        videoCodec: 'libsvtav1',
        crf: 35,
        preset: '8',  // SVT-AV1 uses numeric presets (0=slowest, 12=fastest)
        pixelFormat: 'yuv420p',
        audioCodec: 'libopus',
        audioBitrate: '128k',
        extraVideoArgs: [],
      },
      balanced: {
        videoCodec: 'libsvtav1',
        crf: 30,
        preset: '6',
        pixelFormat: 'yuv420p',
        audioCodec: 'libopus',
        audioBitrate: '192k',
        extraVideoArgs: [],
      },
      quality: {
        videoCodec: 'libsvtav1',
        crf: 22,
        preset: '4',
        pixelFormat: 'yuv420p',
        audioCodec: 'libopus',
        audioBitrate: '256k',
        extraVideoArgs: [],
      },
    },
    // AV1 hardware encoders — require modern GPU
    nvenc: {
      efficiency: {
        videoCodec: 'av1_nvenc',
        cq: 35,
        preset: 'p4',
        pixelFormat: 'yuv420p',
        audioCodec: 'libopus',
        audioBitrate: '128k',
        extraVideoArgs: ['-rc', 'vbr'],
      },
      balanced: {
        videoCodec: 'av1_nvenc',
        cq: 30,
        preset: 'p4',
        pixelFormat: 'yuv420p',
        audioCodec: 'libopus',
        audioBitrate: '192k',
        extraVideoArgs: ['-rc', 'vbr'],
      },
      quality: {
        videoCodec: 'av1_nvenc',
        cq: 22,
        preset: 'p7',
        pixelFormat: 'yuv420p',
        audioCodec: 'libopus',
        audioBitrate: '256k',
        extraVideoArgs: ['-rc', 'vbr'],
      },
    },
    qsv: {
      efficiency: {
        videoCodec: 'av1_qsv',
        cq: 35,
        preset: 'faster',
        pixelFormat: 'nv12',
        audioCodec: 'libopus',
        audioBitrate: '128k',
        extraVideoArgs: [],
      },
      balanced: {
        videoCodec: 'av1_qsv',
        cq: 30,
        preset: 'medium',
        pixelFormat: 'nv12',
        audioCodec: 'libopus',
        audioBitrate: '192k',
        extraVideoArgs: [],
      },
      quality: {
        videoCodec: 'av1_qsv',
        cq: 22,
        preset: 'slow',
        pixelFormat: 'nv12',
        audioCodec: 'libopus',
        audioBitrate: '256k',
        extraVideoArgs: [],
      },
    },
    amf: {
      // AMD AV1 encoding (RX 7000 series+)
      efficiency: {
        videoCodec: 'av1_amf',
        cq: 35,
        preset: 'speed',
        pixelFormat: 'yuv420p',
        audioCodec: 'libopus',
        audioBitrate: '128k',
        extraVideoArgs: [],
      },
      balanced: {
        videoCodec: 'av1_amf',
        cq: 30,
        preset: 'balanced',
        pixelFormat: 'yuv420p',
        audioCodec: 'libopus',
        audioBitrate: '192k',
        extraVideoArgs: [],
      },
      quality: {
        videoCodec: 'av1_amf',
        cq: 22,
        preset: 'quality',
        pixelFormat: 'yuv420p',
        audioCodec: 'libopus',
        audioBitrate: '256k',
        extraVideoArgs: [],
      },
    },
  },
}

export function getEncoderParams(settings: VideoSettings, hwAccel: 'nvenc' | 'qsv' | 'amf' | 'none'): EncoderParams {
  const codecMap = ENCODER_MATRIX[settings.codec]
  const tier = hwAccel === 'none' ? 'software' : hwAccel
  return codecMap[tier][settings.qualityPreset]
}
