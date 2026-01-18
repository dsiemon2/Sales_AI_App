import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app';
import { PORT, APP_NAME } from './config/constants';
import { checkDatabaseConnection, disconnectDatabase } from './config/database';
import { checkRedisConnection, disconnectRedis } from './config/redis';
import logger from './utils/logger';
import { createVoiceWebSocketServer, handleUpgrade } from './services/voice-websocket.service';

// Import routes
import publicRoutes from './routes/public/home';
import authRoutes from './routes/auth/login';
import adminRoutes from './routes/admin/index';
import apiV1Routes from './routes/api/v1/index';

// Get base path from environment
const basePath = process.env.BASE_PATH || '';

// Mount routes under base path
app.use('/', publicRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/v1', apiV1Routes);

// If BASE_PATH is set, also mount routes with prefix for direct access
if (basePath) {
  app.use(basePath, publicRoutes);
  app.use(`${basePath}/auth`, authRoutes);
  app.use(`${basePath}/admin`, adminRoutes);
  app.use(`${basePath}/api/v1`, apiV1Routes);
}

// Import and apply error handling AFTER routes are mounted
import { errorHandler } from './middleware/errorHandler';
app.use(errorHandler);

// Handle 404 - must be LAST
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    statusCode: 404
  });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server for voice
const voiceWss = createVoiceWebSocketServer();

// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
  handleUpgrade(voiceWss, request, socket, head, basePath);
});

// Start server
async function startServer() {
  try {
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Check Redis connection
    const redisConnected = await checkRedisConnection();
    if (!redisConnected) {
      logger.warn('Redis not available, falling back to memory sessions');
    }

    // Start listening
    server.listen(PORT, () => {
      logger.info(`${APP_NAME} server started`, {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        basePath: basePath || '/',
        publicUrl: `http://localhost:${PORT}${basePath}/`,
        adminUrl: `http://localhost:${PORT}${basePath}/admin?token=admin`,
        voiceWs: `ws://localhost:${PORT}${basePath}/ws/voice`
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Close WebSocket server
    voiceWss.close();

    // Close HTTP server
    server.close();

    await disconnectDatabase();
    await disconnectRedis();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
startServer();
