import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database';
import { requireAuthOrToken } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/rbac';
import logger from '../../../utils/logger';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuthOrToken);

// Get all banners (with optional industry filter)
router.get('/', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const industryId = req.query.industryId as string;

  const where: any = {};
  if (industryId && industryId !== 'all') {
    where.industryId = industryId;
  }

  const banners = await prisma.banner.findMany({
    where,
    include: {
      industry: { select: { id: true, name: true, code: true } }
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  });

  res.json(banners);
}));

// Get single banner
router.get('/:id', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const banner = await prisma.banner.findUnique({
    where: { id: req.params.id },
    include: {
      industry: { select: { id: true, name: true, code: true } }
    }
  });

  if (!banner) {
    res.status(404).json({ error: 'Banner not found' });
    return;
  }

  res.json(banner);
}));

// Create banner
router.post('/', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const {
    industryId,
    title,
    subtitle,
    desktopImageUrl,
    mobileImageUrl,
    linkUrl,
    buttonText,
    textPosition,
    textColor,
    overlayColor,
    startDate,
    endDate,
    isActive,
    sortOrder
  } = req.body;

  const banner = await prisma.banner.create({
    data: {
      industryId: industryId || null,
      title: title || '',
      subtitle: subtitle || '',
      desktopImageUrl: desktopImageUrl || '',
      mobileImageUrl: mobileImageUrl || '',
      linkUrl: linkUrl || '',
      buttonText: buttonText || '',
      textPosition: textPosition || 'center',
      textColor: textColor || '#ffffff',
      overlayColor: overlayColor || 'rgba(0,0,0,0.3)',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive !== false,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0
    },
    include: {
      industry: { select: { id: true, name: true, code: true } }
    }
  });

  logger.info('Banner created', { userId: req.user?.id, bannerId: banner.id });
  res.status(201).json(banner);
}));

// Update banner
router.put('/:id', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const {
    industryId,
    title,
    subtitle,
    desktopImageUrl,
    mobileImageUrl,
    linkUrl,
    buttonText,
    textPosition,
    textColor,
    overlayColor,
    startDate,
    endDate,
    isActive,
    sortOrder
  } = req.body;

  const banner = await prisma.banner.update({
    where: { id: req.params.id },
    data: {
      industryId: industryId || null,
      title: title || '',
      subtitle: subtitle || '',
      desktopImageUrl: desktopImageUrl || '',
      mobileImageUrl: mobileImageUrl || '',
      linkUrl: linkUrl || '',
      buttonText: buttonText || '',
      textPosition,
      textColor,
      overlayColor,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive === true || isActive === 'true',
      sortOrder: sortOrder ? parseInt(sortOrder) : 0
    },
    include: {
      industry: { select: { id: true, name: true, code: true } }
    }
  });

  logger.info('Banner updated', { userId: req.user?.id, bannerId: banner.id });
  res.json(banner);
}));

// Delete banner
router.delete('/:id', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  await prisma.banner.delete({
    where: { id: req.params.id }
  });

  logger.info('Banner deleted', { userId: req.user?.id, bannerId: req.params.id });
  res.json({ success: true });
}));

// Bulk delete banners
router.post('/bulk-delete', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'No IDs provided' });
    return;
  }

  await prisma.banner.deleteMany({
    where: { id: { in: ids } }
  });

  logger.info('Bulk banners deleted', { userId: req.user?.id, count: ids.length });
  res.json({ success: true, deleted: ids.length });
}));

// Toggle banner status
router.patch('/:id/toggle', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const banner = await prisma.banner.findUnique({
    where: { id: req.params.id }
  });

  if (!banner) {
    res.status(404).json({ error: 'Banner not found' });
    return;
  }

  const updated = await prisma.banner.update({
    where: { id: req.params.id },
    data: { isActive: !banner.isActive }
  });

  logger.info('Banner toggled', { userId: req.user?.id, bannerId: req.params.id, isActive: updated.isActive });
  res.json(updated);
}));

// Reorder banners
router.post('/reorder', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    res.status(400).json({ error: 'Invalid items array' });
    return;
  }

  await Promise.all(
    items.map((item: { id: string; sortOrder: number }) =>
      prisma.banner.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder }
      })
    )
  );

  logger.info('Banners reordered', { userId: req.user?.id });
  res.json({ success: true });
}));

export default router;
