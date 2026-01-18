import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database';
import { requireAuthOrToken } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/rbac';
import logger from '../../../utils/logger';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuthOrToken);

// Get all announcements (with optional industry filter)
router.get('/', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const industryId = req.query.industryId as string;

  const where: any = {};
  if (industryId && industryId !== 'all') {
    where.industryId = industryId;
  }

  const announcements = await prisma.announcement.findMany({
    where,
    include: {
      industry: { select: { id: true, name: true, code: true } }
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  });

  res.json(announcements);
}));

// Get single announcement
router.get('/:id', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const announcement = await prisma.announcement.findUnique({
    where: { id: req.params.id },
    include: {
      industry: { select: { id: true, name: true, code: true } }
    }
  });

  if (!announcement) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  res.json(announcement);
}));

// Create announcement
router.post('/', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const {
    industryId,
    text,
    icon,
    bgColor,
    textColor,
    linkUrl,
    linkText,
    position,
    startDate,
    endDate,
    isActive,
    sortOrder,
    allowDismiss
  } = req.body;

  const announcement = await prisma.announcement.create({
    data: {
      industryId: industryId || null,
      text,
      icon: icon || 'bi-megaphone',
      bgColor: bgColor || '#2563eb',
      textColor: textColor || '#ffffff',
      linkUrl: linkUrl || '',
      linkText: linkText || '',
      position: position || 'top',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive !== false,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      allowDismiss: allowDismiss !== false
    },
    include: {
      industry: { select: { id: true, name: true, code: true } }
    }
  });

  logger.info('Announcement created', { userId: req.user?.id, announcementId: announcement.id });
  res.status(201).json(announcement);
}));

// Update announcement
router.put('/:id', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const {
    industryId,
    text,
    icon,
    bgColor,
    textColor,
    linkUrl,
    linkText,
    position,
    startDate,
    endDate,
    isActive,
    sortOrder,
    allowDismiss
  } = req.body;

  const announcement = await prisma.announcement.update({
    where: { id: req.params.id },
    data: {
      industryId: industryId || null,
      text,
      icon,
      bgColor,
      textColor,
      linkUrl: linkUrl || '',
      linkText: linkText || '',
      position,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive === true || isActive === 'true',
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      allowDismiss: allowDismiss === true || allowDismiss === 'true'
    },
    include: {
      industry: { select: { id: true, name: true, code: true } }
    }
  });

  logger.info('Announcement updated', { userId: req.user?.id, announcementId: announcement.id });
  res.json(announcement);
}));

// Delete announcement
router.delete('/:id', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  await prisma.announcement.delete({
    where: { id: req.params.id }
  });

  logger.info('Announcement deleted', { userId: req.user?.id, announcementId: req.params.id });
  res.json({ success: true });
}));

// Bulk delete announcements
router.post('/bulk-delete', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'No IDs provided' });
    return;
  }

  await prisma.announcement.deleteMany({
    where: { id: { in: ids } }
  });

  logger.info('Bulk announcements deleted', { userId: req.user?.id, count: ids.length });
  res.json({ success: true, deleted: ids.length });
}));

// Toggle announcement status
router.patch('/:id/toggle', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const announcement = await prisma.announcement.findUnique({
    where: { id: req.params.id }
  });

  if (!announcement) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  const updated = await prisma.announcement.update({
    where: { id: req.params.id },
    data: { isActive: !announcement.isActive }
  });

  logger.info('Announcement toggled', { userId: req.user?.id, announcementId: req.params.id, isActive: updated.isActive });
  res.json(updated);
}));

// Reorder announcements
router.post('/reorder', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    res.status(400).json({ error: 'Invalid items array' });
    return;
  }

  await Promise.all(
    items.map((item: { id: string; sortOrder: number }) =>
      prisma.announcement.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder }
      })
    )
  );

  logger.info('Announcements reordered', { userId: req.user?.id });
  res.json({ success: true });
}));

export default router;
