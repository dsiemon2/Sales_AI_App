import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import session from 'express-session';
import RedisStore from 'connect-redis';
import path from 'path';
import dotenv from 'dotenv';

import redis from './config/redis';
import logger from './utils/logger';
import { SESSION_SECRET, SESSION_MAX_AGE, APP_NAME } from './config/constants';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files - serve at root and at basePath
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Also serve static files at basePath if set
const basePath = process.env.BASE_PATH || '';
if (basePath) {
  app.use(basePath, express.static(publicPath));
}

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.http(message.trim());
    }
  }
}));

// Session configuration
const redisStore = new RedisStore({
  client: redis,
  prefix: 'sess:'
});

// In Docker, we're behind nginx - don't require secure cookies on local development
const isSecure = process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true';

app.use(session({
  store: redisStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isSecure,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    sameSite: 'lax'
  },
  name: 'apex.sid'
}));

// Rate limiting
app.use(rateLimiter);

// Add app name and base path to all responses
app.use((req, res, next) => {
  res.locals.appName = APP_NAME;
  res.locals.basePath = process.env.BASE_PATH || '';
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Note: errorHandler and 404 handler are added in server.ts AFTER routes are mounted

export default app;
