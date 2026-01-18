import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { requireAuthOrToken } from '../../middleware/auth';
import { loadTenant, getTenantId } from '../../middleware/tenant';
import { requirePermission } from '../../middleware/rbac';
import logger from '../../utils/logger';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuthOrToken);
router.use(loadTenant);

// List all closing strategies
router.get('/', requirePermission('VIEW_CLOSING'), asyncHandler(async (req: Request, res: Response) => {
  const tenantCompanyId = getTenantId(req);
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  // Get filter params
  const type = req.query.type as string;
  const industryId = req.query.industryId as string;
  const queryCompanyId = req.query.companyId as string;

  // Determine effective companyId for filtering
  const effectiveCompanyId = isSuperAdmin ? (queryCompanyId || null) : tenantCompanyId;

  const where: any = {};
  if (effectiveCompanyId) where.companyId = effectiveCompanyId;
  if (type) where.type = type;

  // If industry filter is set, get companies in that industry and filter by them
  if (isSuperAdmin && industryId && !queryCompanyId) {
    const industryCompanies = await prisma.company.findMany({
      where: { industryId },
      select: { id: true }
    });
    where.companyId = { in: industryCompanies.map(c => c.id) };
  }

  const closings = await prisma.closingStrategy.findMany({
    where,
    include: { company: { include: { industry: true } } },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }]
  });

  const typeWhere: any = effectiveCompanyId ? { companyId: effectiveCompanyId } : {};
  const types = await prisma.closingStrategy.findMany({
    where: typeWhere,
    select: { type: true },
    distinct: ['type']
  });

  // Fetch industries and companies for SUPER_ADMIN filter
  const industries = isSuperAdmin ? await prisma.industry.findMany({ orderBy: { name: 'asc' } }) : [];
  const companies = isSuperAdmin ? await prisma.company.findMany({
    include: { industry: true },
    orderBy: { name: 'asc' }
  }) : [];

  res.render('admin/closings/index', {
    title: 'Closing Strategies',
    closings,
    types: types.map(t => t.type).filter(Boolean),
    filters: { type, industryId, companyId: queryCompanyId },
    industries,
    companies,
    isSuperAdmin,
    user: req.user,
    tenant: req.tenant
  });
}));

// Create closing strategy
router.post('/', requirePermission('MANAGE_CLOSING'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, type, script, useWhen, tips } = req.body;

  if (!companyId) {
    res.status(400).json({ error: 'Company context required to create closing strategy' });
    return;
  }

  const maxOrder = await prisma.closingStrategy.aggregate({
    where: { companyId },
    _max: { sortOrder: true }
  });

  const closing = await prisma.closingStrategy.create({
    data: {
      companyId,
      name,
      type,
      script,
      useWhen,
      tips: tips ? tips.split('\n').filter(Boolean) : [],
      isActive: true,
      sortOrder: (maxOrder._max.sortOrder || 0) + 1
    }
  });

  logger.info(`Closing strategy created: ${name}`, { userId: req.user?.id, closingId: closing.id });
  res.json({ success: true, closing });
}));

// Update closing strategy
router.put('/:id', requirePermission('MANAGE_CLOSING'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, type, script, useWhen, tips, isActive, sortOrder } = req.body;

  const closingWhere: any = { id: req.params.id };
  if (companyId) closingWhere.companyId = companyId;
  const existing = await prisma.closingStrategy.findFirst({
    where: closingWhere
  });

  if (!existing) {
    res.status(404).json({ error: 'Closing strategy not found' });
    return;
  }

  await prisma.closingStrategy.update({
    where: { id: req.params.id },
    data: {
      name,
      type,
      script,
      useWhen,
      tips: tips ? (Array.isArray(tips) ? tips : tips.split('\n').filter(Boolean)) : [],
      isActive: isActive === true || isActive === 'on',
      sortOrder: sortOrder ? parseInt(sortOrder) : existing.sortOrder
    }
  });

  logger.info(`Closing strategy updated: ${name}`, { userId: req.user?.id, closingId: req.params.id });
  res.json({ success: true });
}));

// Delete closing strategy
router.delete('/:id', requirePermission('MANAGE_CLOSING'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  const closingWhere: any = { id: req.params.id };
  if (companyId) closingWhere.companyId = companyId;
  const closing = await prisma.closingStrategy.findFirst({
    where: closingWhere
  });

  if (!closing) {
    res.status(404).json({ error: 'Closing strategy not found' });
    return;
  }

  await prisma.closingStrategy.delete({ where: { id: req.params.id } });
  logger.info(`Closing strategy deleted: ${closing.name}`, { userId: req.user?.id });
  res.json({ success: true });
}));

// Reorder closing strategies
router.post('/reorder', requirePermission('MANAGE_CLOSING'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { items } = req.body;

  for (const item of items) {
    const reorderWhere: any = { id: item.id };
    if (companyId) reorderWhere.companyId = companyId;
    await prisma.closingStrategy.updateMany({
      where: reorderWhere,
      data: { sortOrder: item.sortOrder }
    });
  }

  res.json({ success: true });
}));

export default router;
