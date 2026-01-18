import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// JSON format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'apex-sales-ai' },
  transports: [
    // Error logs - separate file with 30-day retention
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    }),
    // Combined logs with 14-day retention
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat
    })
  );

  // Debug logs only in development
  logger.add(
    new DailyRotateFile({
      filename: path.join(logDir, 'debug-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'debug',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '7d'
    })
  );
}

// Helper methods for structured logging
export const logInfo = (message: string, meta?: Record<string, unknown>) => {
  logger.info(message, meta);
};

export const logError = (message: string, error?: Error, meta?: Record<string, unknown>) => {
  logger.error(message, {
    ...meta,
    error: error?.message,
    stack: error?.stack
  });
};

export const logWarn = (message: string, meta?: Record<string, unknown>) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: Record<string, unknown>) => {
  logger.debug(message, meta);
};

export const logHttp = (message: string, meta?: Record<string, unknown>) => {
  logger.http(message, meta);
};

// Request logging helper
export const logRequest = (req: {
  method: string;
  url: string;
  ip?: string;
  userId?: string;
  companyId?: string;
}, responseTime?: number) => {
  logger.http('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.userId,
    companyId: req.companyId,
    responseTime: responseTime ? `${responseTime}ms` : undefined
  });
};

// Audit logging helper
export const logAudit = (action: string, details: {
  userId?: string;
  companyId?: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  changes?: Record<string, unknown>;
}) => {
  logger.info(`AUDIT: ${action}`, {
    type: 'audit',
    ...details
  });
};

// Security event logging
export const logSecurity = (event: string, details: {
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}) => {
  const level = details.riskLevel === 'critical' || details.riskLevel === 'high' ? 'error' : 'warn';
  logger.log(level, `SECURITY: ${event}`, {
    type: 'security',
    ...details
  });
};

export default logger;
