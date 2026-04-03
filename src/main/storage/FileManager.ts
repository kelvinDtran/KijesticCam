import path from 'path'
import fs from 'fs'
import { CaptureSourceType, VideoCodec } from '../../shared/types'
import { logger } from '../logger'

export interface OutputPaths {
  tempFilePath: string   // WebM capture from MediaRecorder
  outputFilePath: string // Final encoded file
  outputFileName: string
}

/**
 * Build file paths for a new recording session.
 *
 * Naming convention: KijesticCam_<source-slug>_<timestamp>.<ext>
 * Example: KijesticCam_Screen1_2024-06-15_14-32-01.mp4
 */
export function buildOutputPaths(
  outputDir: string,
  sourceName: string,
  sourceType: CaptureSourceType,
  codec: VideoCodec
): OutputPaths {
  const slug = toSlug(sourceName)
  const timestamp = toTimestamp(new Date())
  const typePrefix = sourceType === 'screen' ? 'Screen' : 'Window'
  const ext = codec === 'av1' ? 'mkv' : 'mp4'
  const baseName = `KijesticCam_${typePrefix}-${slug}_${timestamp}`

  ensureDir(outputDir)
  const tempDir = path.join(outputDir, '.tmp')
  ensureDir(tempDir)

  return {
    tempFilePath: path.join(tempDir, `${baseName}.webm`),
    outputFilePath: path.join(outputDir, `${baseName}.${ext}`),
    outputFileName: `${baseName}.${ext}`,
  }
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    logger.debug(`Created directory: ${dirPath}`)
  }
}

export async function getFileSizeBytes(filePath: string): Promise<number> {
  try {
    const stat = await fs.promises.stat(filePath)
    return stat.size
  } catch {
    return 0
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath)
  } catch (err) {
    logger.warn(`deleteFile failed for ${filePath}: ${err}`)
  }
}

function toSlug(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 32)
}

function toTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  )
}
