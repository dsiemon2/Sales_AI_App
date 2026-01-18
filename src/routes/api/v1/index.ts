import { Router, Request, Response, NextFunction } from 'express';
import industriesRoutes from './industries';
import aiToolsRoutes from './ai-tools';
import announcementsRoutes from './announcements';
import bannersRoutes from './banners';
import webhooksRoutes from './webhooks';
import { requireApiAccess } from '../../../middleware/subscription';
import { requireAuth } from '../../../middleware/auth';
import { loadTenant } from '../../../middleware/tenant';

const router = Router();

// Webhook routes - no auth required (validated by signature)
router.use('/webhooks', webhooksRoutes);

// API routes that require authentication and API access (Professional+ tier)
// Public API endpoints (industries list) don't require auth
router.use('/industries', industriesRoutes);

// Protected API endpoints require auth + API access tier
router.use('/ai-tools', requireAuth, loadTenant, requireApiAccess, aiToolsRoutes);
router.use('/announcements', requireAuth, loadTenant, requireApiAccess, announcementsRoutes);
router.use('/banners', requireAuth, loadTenant, requireApiAccess, bannersRoutes);

// API info endpoint
router.get('/', (req: Request, res: Response) => {
  res.json({
    version: 'v1',
    endpoints: ['/industries', '/ai-tools', '/announcements', '/banners', '/webhooks'],
    note: 'Most endpoints require Professional plan or higher for API access. Webhooks are authenticated by signature.'
  });
});

export default router;
