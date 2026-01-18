import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import logger from '../utils/logger';
import { RATE_LIMITS } from '../config/constants';

// General API rate limiter
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: RATE_LIMITS.API_REQUESTS_PER_MINUTE,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests, please try again later.',
        statusCode: 429
      }
    });
  },
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    const session = req.session as { userId?: string };
    return session?.userId || req.ip || 'unknown';
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;

    // Skip rate limiting for admin routes with valid token
    const token = req.query.token || req.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_TOKEN || 'admin';
    if (token === expectedToken) return true;

    // Skip static assets
    if (req.path.match(/\.(css|js|png|jpg|ico|woff|woff2|ttf)$/)) return true;

    return false;
  }
});

// Stricter rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: RATE_LIMITS.LOGIN_ATTEMPTS_PER_HOUR,
  message: {
    success: false,
    error: {
      message: 'Too many login attempts, please try again later.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email
    });
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many login attempts, please try again later.',
        statusCode: 429
      }
    });
  },
  keyGenerator: (req: Request) => {
    // Use email + IP for login attempts
    const email = req.body?.email || '';
    return `${email}:${req.ip}`;
  }
});

// Password reset rate limiter
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: RATE_LIMITS.PASSWORD_RESET_PER_HOUR,
  message: {
    success: false,
    error: {
      message: 'Too many password reset requests, please try again later.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = req.body?.email || '';
    return `reset:${email}:${req.ip}`;
  }
});

// Demo mode rate limiter
export const demoRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: RATE_LIMITS.DEMO_MESSAGES_PER_SESSION,
  message: {
    success: false,
    error: {
      message: 'Demo message limit reached. Please register for full access.',
      statusCode: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const session = req.session as { demoId?: string };
    return `demo:${session?.demoId || req.ip}`;
  }
});
