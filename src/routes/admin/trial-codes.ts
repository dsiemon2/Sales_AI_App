import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { requireAuthOrToken } from '../../middleware/auth';
import { loadTenant } from '../../middleware/tenant';
import { getMenuForRole, groupMenuBySection } from '../../middleware/rbac';
import logger from '../../utils/logger';
import { ROLES, APP_NAME } from '../../config/constants';
import crypto from 'crypto';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

// Middleware to require SUPER_ADMIN role
const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ error: 'Access denied. Super Admin role required.' });
  }
  next();
};

// All trial code routes require SUPER_ADMIN
router.use(requireAuthOrToken);
router.use(loadTenant);
router.use(requireSuperAdmin);

// Add menu and common data to views
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    const menuItems = getMenuForRole(req.user.role);
    res.locals.menu = groupMenuBySection(menuItems);
    res.locals.basePath = process.env.BASE_PATH || '';
    res.locals.appName = APP_NAME;
    res.locals.user = req.user;
    res.locals.tenant = req.tenant;
  }
  next();
});

// Generate random trial code
function generateTrialCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars like O/0, I/1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

// List trial codes
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;

  const where: any = {};
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  if (status === 'expired') {
    where.expiresAt = { lt: new Date() };
  }

  const [trialCodes, total, industries] = await Promise.all([
    prisma.trialCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.trialCode.count({ where }),
    prisma.industry.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' }
    })
  ]);

  res.render('admin/trial-codes/index', {
    title: 'Trial Codes',
    active: 'trial-codes',
    trialCodes,
    industries,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    filters: { status },
    user: req.user
  });
}));

// Create trial code
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { description, maxUses, daysValid, industryId, expiresAt, customCode } = req.body;

  // Use custom code or generate one
  let code = customCode?.trim().toUpperCase();
  if (!code) {
    code = generateTrialCode();
  }

  // Check if code already exists
  const existing = await prisma.trialCode.findUnique({ where: { code } });
  if (existing) {
    res.status(400).json({ error: 'A trial code with this code already exists' });
    return;
  }

  const trialCode = await prisma.trialCode.create({
    data: {
      code,
      description: description || null,
      maxUses: parseInt(maxUses) || 1,
      daysValid: parseInt(daysValid) || 14,
      industryId: industryId || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user?.id || null,
      isActive: true
    }
  });

  logger.info(`Trial code created: ${code}`, { userId: req.user?.id, trialCodeId: trialCode.id });
  res.json({ success: true, trialCode: { id: trialCode.id, code: trialCode.code } });
}));

// Update trial code
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { description, maxUses, daysValid, industryId, expiresAt, isActive } = req.body;

  const trialCode = await prisma.trialCode.findUnique({ where: { id: req.params.id } });
  if (!trialCode) {
    res.status(404).json({ error: 'Trial code not found' });
    return;
  }

  await prisma.trialCode.update({
    where: { id: req.params.id },
    data: {
      description: description || null,
      maxUses: parseInt(maxUses) || trialCode.maxUses,
      daysValid: parseInt(daysValid) || trialCode.daysValid,
      industryId: industryId || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: isActive === true || isActive === 'true'
    }
  });

  logger.info(`Trial code updated: ${trialCode.code}`, { userId: req.user?.id, trialCodeId: req.params.id });
  res.json({ success: true });
}));

// Delete trial code
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const trialCode = await prisma.trialCode.findUnique({ where: { id: req.params.id } });
  if (!trialCode) {
    res.status(404).json({ error: 'Trial code not found' });
    return;
  }

  await prisma.trialCode.delete({ where: { id: req.params.id } });
  logger.info(`Trial code deleted: ${trialCode.code}`, { userId: req.user?.id, trialCodeId: req.params.id });
  res.json({ success: true });
}));

// Toggle trial code status
router.post('/:id/toggle', asyncHandler(async (req: Request, res: Response) => {
  const trialCode = await prisma.trialCode.findUnique({ where: { id: req.params.id } });
  if (!trialCode) {
    res.status(404).json({ error: 'Trial code not found' });
    return;
  }

  await prisma.trialCode.update({
    where: { id: req.params.id },
    data: { isActive: !trialCode.isActive }
  });

  logger.info(`Trial code toggled: ${trialCode.code}`, { userId: req.user?.id, trialCodeId: req.params.id, newStatus: !trialCode.isActive });
  res.json({ success: true, isActive: !trialCode.isActive });
}));

export default router;
