import winston from 'winston';
import { join } from 'path';

/**
 * Configures and exports a centralized winston logger for the application.
 * Supports console logging with colors and file logging in JSON format.
 */

/** Log level fetched from environment, defaults to 'info' */
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
/** Flag to enable/disable file logging */
const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';

/** Console transport format: Readable text with colors and timestamps */
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

/** File transport format: Structured JSON with error stacks */
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const transports: winston.transport[] = [
    new winston.transports.Console({
        format: consoleFormat,
    }),
];

if (LOG_TO_FILE) {
    const logsDir = join(process.cwd(), 'logs');

    // Combined logs for all levels
    transports.push(
        new winston.transports.File({
            filename: join(logsDir, 'combined.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );

    // Error-only logs
    transports.push(
        new winston.transports.File({
            filename: join(logsDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );
}

/**
 * Shared logger instance used across the entire application.
 */
export const logger = winston.createLogger({
    level: LOG_LEVEL,
    transports,
    exitOnError: false,
    silent: process.env.NODE_ENV === 'test',
});

// Notify initialization status to logs
if (process.env.NODE_ENV !== 'test') {
    logger.info('Logger initialized', {
        logLevel: LOG_LEVEL,
        fileLogging: LOG_TO_FILE,
    });
}

