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

// List all objection handlers
router.get('/', requirePermission('VIEW_OBJECTIONS'), asyncHandler(async (req: Request, res: Response) => {
  const tenantCompanyId = getTenantId(req);
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  // Get filter params
  const category = req.query.category as string;
  const frequency = req.query.frequency as string;
  const industryId = req.query.industryId as string;
  const queryCompanyId = req.query.companyId as string;

  // Determine effective companyId for filtering
  const effectiveCompanyId = isSuperAdmin ? (queryCompanyId || null) : tenantCompanyId;

  const where: any = {};
  if (effectiveCompanyId) where.companyId = effectiveCompanyId;
  if (category) where.category = category;
  if (frequency) where.frequency = frequency;

  // If industry filter is set, get companies in that industry and filter by them
  if (isSuperAdmin && industryId && !queryCompanyId) {
    const industryCompanies = await prisma.company.findMany({
      where: { industryId },
      select: { id: true }
    });
    where.companyId = { in: industryCompanies.map(c => c.id) };
  }

  const objections = await prisma.objectionHandler.findMany({
    where,
    include: { company: { include: { industry: true } } },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
  });

  const catWhere: any = effectiveCompanyId ? { companyId: effectiveCompanyId } : {};
  const categories = await prisma.objectionHandler.findMany({
    where: catWhere,
    select: { category: true },
    distinct: ['category']
  });

  // Fetch industries and companies for SUPER_ADMIN filter
  const industries = isSuperAdmin ? await prisma.industry.findMany({ orderBy: { name: 'asc' } }) : [];
  const companies = isSuperAdmin ? await prisma.company.findMany({
    include: { industry: true },
    orderBy: { name: 'asc' }
  }) : [];

  res.render('admin/objections/index', {
    title: 'Objection Handlers',
    objections,
    categories: categories.map(c => c.category).filter(Boolean),
    frequencies: ['very_common', 'common', 'occasional', 'rare'],
    filters: { category, frequency, industryId, companyId: queryCompanyId },
    industries,
    companies,
    isSuperAdmin,
    user: req.user,
    tenant: req.tenant
  });
}));

// Create objection handler
router.post('/', requirePermission('MANAGE_OBJECTIONS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { objection, category, response, technique, frequency, followUp } = req.body;

  if (!companyId) {
    res.status(400).json({ error: 'Company context required to create objection handler' });
    return;
  }

  const maxOrder = await prisma.objectionHandler.aggregate({
    where: { companyId },
    _max: { sortOrder: true }
  });

  const handler = await prisma.objectionHandler.create({
    data: {
      companyId,
      objection,
      category,
      response,
      technique,
      frequency: frequency || 'common',
      followUp: followUp || null,
      isActive: true,
      sortOrder: (maxOrder._max.sortOrder || 0) + 1
    }
  });

  logger.info(`Objection handler created: ${objection}`, { userId: req.user?.id, handlerId: handler.id });
  res.json({ success: true, handler });
}));

// Update objection handler
router.put('/:id', requirePermission('MANAGE_OBJECTIONS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { objection, category, response, technique, frequency, followUp, isActive, sortOrder } = req.body;

  const objWhere: any = { id: req.params.id };
  if (companyId) objWhere.companyId = companyId;
  const existing = await prisma.objectionHandler.findFirst({
    where: objWhere
  });

  if (!existing) {
    res.status(404).json({ error: 'Objection handler not found' });
    return;
  }

  await prisma.objectionHandler.update({
    where: { id: req.params.id },
    data: {
      objection,
      category,
      response,
      technique,
      frequency,
      followUp: followUp || null,
      isActive: isActive === true || isActive === 'on',
      sortOrder: sortOrder ? parseInt(sortOrder) : existing.sortOrder
    }
  });

  logger.info(`Objection handler updated: ${objection}`, { userId: req.user?.id, handlerId: req.params.id });
  res.json({ success: true });
}));

// Delete objection handler
router.delete('/:id', requirePermission('MANAGE_OBJECTIONS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  const objWhere: any = { id: req.params.id };
  if (companyId) objWhere.companyId = companyId;
  const handler = await prisma.objectionHandler.findFirst({
    where: objWhere
  });

  if (!handler) {
    res.status(404).json({ error: 'Objection handler not found' });
    return;
  }

  await prisma.objectionHandler.delete({ where: { id: req.params.id } });
  logger.info(`Objection handler deleted: ${handler.objection}`, { userId: req.user?.id });
  res.json({ success: true });
}));

// Reorder objection handlers
router.post('/reorder', requirePermission('MANAGE_OBJECTIONS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { items } = req.body;

  for (const item of items) {
    const reorderWhere: any = { id: item.id };
    if (companyId) reorderWhere.companyId = companyId;
    await prisma.objectionHandler.updateMany({
      where: reorderWhere,
      data: { sortOrder: item.sortOrder }
    });
  }

  res.json({ success: true });
}));

export default router;
