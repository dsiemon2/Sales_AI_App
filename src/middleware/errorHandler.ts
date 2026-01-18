import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async handler wrapper
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // Default values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  // Check if it's our custom error
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
    isOperational = true;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    isOperational = true;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    isOperational = true;
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    isOperational = true;
  }

  // Log the error
  if (!isOperational) {
    logger.error('Unhandled error', err, {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: (req.session as { userId?: string })?.userId
    });
  } else {
    logger.warn('Operational error', {
      message: err.message,
      statusCode,
      path: req.path,
      method: req.method
    });
  }

  // Send response
  if (req.accepts('json')) {
    res.status(statusCode).json({
      success: false,
      error: {
        message,
        statusCode,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  } else {
    res.status(statusCode).render('error', {
      title: 'Error',
      message,
      statusCode,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response) => {
  const message = `Route ${req.originalUrl} not found`;

  if (req.accepts('json')) {
    res.status(404).json({
      success: false,
      error: { message, statusCode: 404 }
    });
  } else {
    res.status(404).render('error', {
      title: 'Not Found',
      message,
      statusCode: 404
    });
  }
};
