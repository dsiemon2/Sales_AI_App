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

// List all techniques
router.get('/', requirePermission('VIEW_TECHNIQUES'), asyncHandler(async (req: Request, res: Response) => {
  const tenantCompanyId = getTenantId(req);
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  // Get filter params
  const category = req.query.category as string;
  const industryId = req.query.industryId as string;
  const queryCompanyId = req.query.companyId as string;

  // Determine effective companyId for filtering
  const effectiveCompanyId = isSuperAdmin ? (queryCompanyId || null) : tenantCompanyId;

  const where: any = {};
  if (effectiveCompanyId) where.companyId = effectiveCompanyId;
  if (category) where.category = category;

  // If industry filter is set, get companies in that industry and filter by them
  if (isSuperAdmin && industryId && !queryCompanyId) {
    const industryCompanies = await prisma.company.findMany({
      where: { industryId },
      select: { id: true }
    });
    where.companyId = { in: industryCompanies.map(c => c.id) };
  }

  const catWhere: any = effectiveCompanyId ? { companyId: effectiveCompanyId } : {};
  const techniques = await prisma.salesTechnique.findMany({
    where,
    include: { company: { include: { industry: true } } },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
  });

  const categories = await prisma.salesTechnique.findMany({
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

  res.render('admin/techniques/index', {
    title: 'Sales Techniques',
    techniques,
    categories: categories.map(c => c.category).filter(Boolean),
    filters: { category, industryId, companyId: queryCompanyId },
    industries,
    companies,
    isSuperAdmin,
    user: req.user,
    tenant: req.tenant
  });
}));

// Create technique
router.post('/', requirePermission('MANAGE_TECHNIQUES'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, category, description, script, effectiveness, tips, examples, bestFor } = req.body;

  if (!companyId) {
    res.status(400).json({ error: 'Company context required to create technique' });
    return;
  }

  const maxOrder = await prisma.salesTechnique.aggregate({
    where: { companyId },
    _max: { sortOrder: true }
  });

  const technique = await prisma.salesTechnique.create({
    data: {
      companyId,
      name,
      category,
      description,
      script,
      effectiveness: effectiveness || 'medium',
      tips: tips ? tips.split('\n').filter(Boolean) : [],
      examples: examples ? examples.split('\n').filter(Boolean) : [],
      bestFor: bestFor ? bestFor.split('\n').filter(Boolean) : [],
      isActive: true,
      sortOrder: (maxOrder._max.sortOrder || 0) + 1
    }
  });

  logger.info(`Technique created: ${technique.name}`, { userId: req.user?.id, techniqueId: technique.id });
  res.json({ success: true, technique });
}));

// Update technique
router.put('/:id', requirePermission('MANAGE_TECHNIQUES'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, category, description, script, effectiveness, tips, examples, bestFor, isActive, sortOrder } = req.body;

  const techWhere: any = { id: req.params.id };
  if (companyId) techWhere.companyId = companyId;
  const technique = await prisma.salesTechnique.findFirst({
    where: techWhere
  });

  if (!technique) {
    res.status(404).json({ error: 'Technique not found' });
    return;
  }

  await prisma.salesTechnique.update({
    where: { id: req.params.id },
    data: {
      name,
      category,
      description,
      script,
      effectiveness,
      tips: tips ? (Array.isArray(tips) ? tips : tips.split('\n').filter(Boolean)) : [],
      examples: examples ? (Array.isArray(examples) ? examples : examples.split('\n').filter(Boolean)) : [],
      bestFor: bestFor ? (Array.isArray(bestFor) ? bestFor : bestFor.split('\n').filter(Boolean)) : [],
      isActive: isActive === true || isActive === 'on',
      sortOrder: sortOrder ? parseInt(sortOrder) : technique.sortOrder
    }
  });

  logger.info(`Technique updated: ${name}`, { userId: req.user?.id, techniqueId: req.params.id });
  res.json({ success: true });
}));

// Delete technique
router.delete('/:id', requirePermission('MANAGE_TECHNIQUES'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const techWhere: any = { id: req.params.id };
  if (companyId) techWhere.companyId = companyId;

  const technique = await prisma.salesTechnique.findFirst({
    where: techWhere
  });

  if (!technique) {
    res.status(404).json({ error: 'Technique not found' });
    return;
  }

  await prisma.salesTechnique.delete({ where: { id: req.params.id } });
  logger.info(`Technique deleted: ${technique.name}`, { userId: req.user?.id });
  res.json({ success: true });
}));

// Reorder techniques
router.post('/reorder', requirePermission('MANAGE_TECHNIQUES'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { items } = req.body; // Array of { id, sortOrder }

  for (const item of items) {
    const reorderWhere: any = { id: item.id };
    if (companyId) reorderWhere.companyId = companyId;
    await prisma.salesTechnique.updateMany({
      where: reorderWhere,
      data: { sortOrder: item.sortOrder }
    });
  }

  res.json({ success: true });
}));

export default router;
