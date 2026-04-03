import path from 'path'

// Mock logger and fs before importing FileManager
jest.mock('../main/logger', () => ({ logger: { debug: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  promises: { stat: jest.fn().mockResolvedValue({ size: 0 }), unlink: jest.fn() },
}))

import { buildOutputPaths } from '../main/storage/FileManager'

describe('FileManager', () => {
  test('builds correct paths for screen source with H.264', () => {
    const result = buildOutputPaths('/recordings', 'Screen 1', 'screen', 'h264')
    expect(result.outputFilePath).toMatch(/\.mp4$/)
    expect(result.tempFilePath).toMatch(/\.webm$/)
    expect(result.outputFileName).toMatch(/^KijesticCam_Screen-Screen-1_/)
  })

  test('builds MKV extension for AV1', () => {
    const result = buildOutputPaths('/recordings', 'My App', 'window', 'av1')
    expect(result.outputFilePath).toMatch(/\.mkv$/)
  })

  test('slugifies source names with special characters', () => {
    const result = buildOutputPaths('/recordings', 'Chrome: Tab #1 (Work)', 'window', 'h265')
    expect(result.outputFileName).not.toMatch(/[:#()\[\]]/)
  })

  test('timestamp format is valid', () => {
    const result = buildOutputPaths('/recordings', 'Display 1', 'screen', 'h265')
    // Should match YYYY-MM-DD_HH-MM-SS
    expect(result.outputFileName).toMatch(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/)
  })

  test('temp file goes in .tmp subdirectory', () => {
    const result = buildOutputPaths('/recordings', 'Screen 1', 'screen', 'h264')
    expect(result.tempFilePath).toContain('.tmp')
  })
})
