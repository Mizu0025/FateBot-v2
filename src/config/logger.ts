import winston from 'winston';
import { join } from 'path';

// Get log level from environment variable, default to 'info'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';

// Define custom log format for console (colorized and readable)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Define format for file logging (JSON for structured logs)
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create transports array
const transports: winston.transport[] = [
    // Always log to console
    new winston.transports.Console({
        format: consoleFormat,
    }),
];

// Optionally add file logging
if (LOG_TO_FILE) {
    const logsDir = join(process.cwd(), 'logs');

    // Log all levels to combined.log
    transports.push(
        new winston.transports.File({
            filename: join(logsDir, 'combined.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );

    // Log only errors to error.log
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

// Create the logger instance
export const logger = winston.createLogger({
    level: LOG_LEVEL,
    transports,
    // Don't exit on handled exceptions
    exitOnError: false,
});

// Log the logger configuration on startup
logger.info('Logger initialized', {
    logLevel: LOG_LEVEL,
    fileLogging: LOG_TO_FILE,
});
