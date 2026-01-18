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

// List all discovery questions
router.get('/', requirePermission('VIEW_DISCOVERY'), asyncHandler(async (req: Request, res: Response) => {
  const tenantCompanyId = getTenantId(req);
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  // Get filter params
  const phase = req.query.phase as string;
  const targetNeed = req.query.targetNeed as string;
  const industryId = req.query.industryId as string;
  const queryCompanyId = req.query.companyId as string;

  // Determine effective companyId for filtering
  const effectiveCompanyId = isSuperAdmin ? (queryCompanyId || null) : tenantCompanyId;

  const where: any = {};
  if (effectiveCompanyId) where.companyId = effectiveCompanyId;
  if (phase) where.phase = phase;
  if (targetNeed) where.targetNeed = targetNeed;

  // If industry filter is set, get companies in that industry and filter by them
  if (isSuperAdmin && industryId && !queryCompanyId) {
    const industryCompanies = await prisma.company.findMany({
      where: { industryId },
      select: { id: true }
    });
    where.companyId = { in: industryCompanies.map(c => c.id) };
  }

  const questions = await prisma.discoveryQuestion.findMany({
    where,
    include: { company: { include: { industry: true } } },
    orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }]
  });

  const filterWhere: any = effectiveCompanyId ? { companyId: effectiveCompanyId } : {};
  const phases = await prisma.discoveryQuestion.findMany({
    where: filterWhere,
    select: { phase: true },
    distinct: ['phase']
  });

  const targetNeeds = await prisma.discoveryQuestion.findMany({
    where: filterWhere,
    select: { targetNeed: true },
    distinct: ['targetNeed']
  });

  // Fetch industries and companies for SUPER_ADMIN filter
  const industries = isSuperAdmin ? await prisma.industry.findMany({ orderBy: { name: 'asc' } }) : [];
  const companies = isSuperAdmin ? await prisma.company.findMany({
    include: { industry: true },
    orderBy: { name: 'asc' }
  }) : [];

  res.render('admin/discovery/index', {
    title: 'Discovery Questions',
    questions,
    phases: phases.map(p => p.phase).filter(Boolean),
    targetNeeds: targetNeeds.map(t => t.targetNeed).filter(Boolean),
    filters: { phase, targetNeed, industryId, companyId: queryCompanyId },
    industries,
    companies,
    isSuperAdmin,
    user: req.user,
    tenant: req.tenant
  });
}));

// Create question
router.post('/', requirePermission('MANAGE_DISCOVERY'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { question, purpose, targetNeed, phase, followUp } = req.body;

  if (!companyId) {
    res.status(400).json({ error: 'Company context required to create discovery question' });
    return;
  }

  const maxOrder = await prisma.discoveryQuestion.aggregate({
    where: { companyId },
    _max: { sortOrder: true }
  });

  const newQuestion = await prisma.discoveryQuestion.create({
    data: {
      companyId,
      question,
      purpose,
      targetNeed,
      phase: phase || 'discovery',
      followUp: followUp || null,
      isActive: true,
      sortOrder: (maxOrder._max.sortOrder || 0) + 1
    }
  });

  logger.info(`Discovery question created`, { userId: req.user?.id, questionId: newQuestion.id });
  res.json({ success: true, question: newQuestion });
}));

// Update question
router.put('/:id', requirePermission('MANAGE_DISCOVERY'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { question, purpose, targetNeed, phase, followUp, isActive, sortOrder } = req.body;

  const questionWhere: any = { id: req.params.id };
  if (companyId) questionWhere.companyId = companyId;
  const existing = await prisma.discoveryQuestion.findFirst({
    where: questionWhere
  });

  if (!existing) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  await prisma.discoveryQuestion.update({
    where: { id: req.params.id },
    data: {
      question,
      purpose,
      targetNeed,
      phase,
      followUp: followUp || null,
      isActive: isActive === true || isActive === 'on',
      sortOrder: sortOrder ? parseInt(sortOrder) : existing.sortOrder
    }
  });

  logger.info(`Discovery question updated`, { userId: req.user?.id, questionId: req.params.id });
  res.json({ success: true });
}));

// Delete question
router.delete('/:id', requirePermission('MANAGE_DISCOVERY'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  const questionWhere: any = { id: req.params.id };
  if (companyId) questionWhere.companyId = companyId;
  const question = await prisma.discoveryQuestion.findFirst({
    where: questionWhere
  });

  if (!question) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }

  await prisma.discoveryQuestion.delete({ where: { id: req.params.id } });
  logger.info(`Discovery question deleted`, { userId: req.user?.id });
  res.json({ success: true });
}));

// Reorder questions
router.post('/reorder', requirePermission('MANAGE_DISCOVERY'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { items } = req.body;

  for (const item of items) {
    const reorderWhere: any = { id: item.id };
    if (companyId) reorderWhere.companyId = companyId;
    await prisma.discoveryQuestion.updateMany({
      where: reorderWhere,
      data: { sortOrder: item.sortOrder }
    });
  }

  res.json({ success: true });
}));

export default router;
