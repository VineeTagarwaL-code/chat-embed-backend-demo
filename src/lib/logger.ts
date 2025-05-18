/***
 *
 * The logger is used to log request related information. It uses the winston library to log information to a file and to Loki.
 * you can use logger.info for sending non-error infos
 * you can use logger.error for sending error infos
 * you use use logger.warn for sending warning infos
 *
 */
import 'dotenv/config';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { formatTimestamp } from '../utils';
import path from 'path';

const levels: { [key: string]: number } = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const { combine, timestamp, printf, colorize } = format;

const customFormat = printf(({ level, message, timestamp }) => {
  return `[ ${formatTimestamp(timestamp as string)} ] -  ${level} -  ${message}`;
});

const logger = createLogger({
  levels,
  format: combine(timestamp(), customFormat),
  transports: [
    new transports.Console({
      format: combine(colorize(), timestamp(), customFormat),
    }),
    new DailyRotateFile({
      filename: path.join('logs', 'info-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      maxFiles: '14d',
    }),

    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d',
    }),

    new DailyRotateFile({
      filename: path.join('logs', 'http-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxFiles: '14d',
    }),

    new DailyRotateFile({
      filename: path.join('logs', 'warn-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'warn',
      maxFiles: '14d',
    }),
  ],
});

export { logger };