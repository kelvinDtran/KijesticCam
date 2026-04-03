import { createLogger, format, transports } from 'winston'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const logsDir = path.join(app.getPath('userData'), 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

export const logger = createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
        : `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    new transports.File({
      filename: path.join(logsDir, 'kijjestic-cam.log'),
      maxsize: 5 * 1024 * 1024,  // 5 MB
      maxFiles: 3,
      tailable: true,
    }),
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
})
