import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { requireAuthOrToken } from '../../middleware/auth';
import { loadTenant, getTenantId } from '../../middleware/tenant';
import { requirePermission } from '../../middleware/rbac';
import logger from '../../utils/logger';

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuthOrToken);
router.use(loadTenant);

// List all sessions
router.get('/', requirePermission('VIEW_SESSIONS'), asyncHandler(async (req: Request, res: Response) => {
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  const userCompanyId = req.user?.companyId;

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;
  const userId = req.query.userId as string;
  const industryId = req.query.industryId as string;
  const filterCompanyId = req.query.companyId as string;

  // Build where clause
  const where: any = {};

  if (isSuperAdmin) {
    // SUPER_ADMIN: Only filter if explicitly requested via query params
    if (filterCompanyId) {
      where.companyId = filterCompanyId;
    } else if (industryId) {
      // Filter by industry - get all companies in that industry
      const companiesInIndustry = await prisma.company.findMany({
        where: { industryId },
        select: { id: true }
      });
      if (companiesInIndustry.length > 0) {
        where.companyId = { in: companiesInIndustry.map(c => c.id) };
      }
    }
    // If neither companyId nor industryId specified, show ALL sessions (no filter)
  } else {
    // Non-super admins are restricted to their company
    if (userCompanyId) {
      where.companyId = userCompanyId;
    } else {
      // Fallback to tenant if user doesn't have company (shouldn't happen)
      const tenantId = getTenantId(req);
      if (tenantId) where.companyId = tenantId;
    }
  }
  if (status) where.outcome = status;
  if (userId) where.userId = userId;

  const [sessions, total] = await Promise.all([
    prisma.salesSession.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        company: {
          select: {
            id: true,
            name: true,
            industry: { select: { id: true, name: true, code: true } }
          }
        },
        product: { select: { id: true, name: true, category: true } }
      },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.salesSession.count({ where })
  ]);

  // Get users for filter dropdown
  const usersWhere: any = { isActive: true };
  // For non-super admins, only show users from their company
  if (!isSuperAdmin && userCompanyId) {
    usersWhere.companyId = userCompanyId;
  }
  // For super admin, show all users (or filter by selected company/industry)
  if (isSuperAdmin && filterCompanyId) {
    usersWhere.companyId = filterCompanyId;
  } else if (isSuperAdmin && industryId) {
    const companiesInInd = await prisma.company.findMany({
      where: { industryId },
      select: { id: true }
    });
    if (companiesInInd.length > 0) {
      usersWhere.companyId = { in: companiesInInd.map(c => c.id) };
    }
  }
  const users = await prisma.user.findMany({
    where: usersWhere,
    select: { id: true, firstName: true, lastName: true }
  });

  // Get industries and companies for filter dropdowns (SUPER_ADMIN only)
  let industries: any[] = [];
  let companies: any[] = [];

  if (isSuperAdmin) {
    industries = await prisma.industry.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    // Get companies - all if no industry filter, or filtered by industry
    const companiesWhere: any = { isActive: true };
    if (industryId) companiesWhere.industryId = industryId;

    companies = await prisma.company.findMany({
      where: companiesWhere,
      include: { industry: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' }
    });
  } else if (userCompanyId) {
    // Get user's company info for the view
    const userCompany = await prisma.company.findUnique({
      where: { id: userCompanyId },
      include: { industry: { select: { id: true, name: true, code: true } } }
    });
    if (userCompany) {
      companies = [userCompany];
      industries = userCompany.industry ? [userCompany.industry] : [];
    }
  }

  res.render('admin/sessions/index', {
    title: 'Training Sessions',
    sessions,
    users,
    industries,
    companies,
    isSuperAdmin,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    filters: { status, userId, industryId, companyId: filterCompanyId },
    user: req.user,
    tenant: req.tenant
  });
}));

// View session details
router.get('/:id', requirePermission('VIEW_SESSIONS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const sessionWhere: any = { id: req.params.id };
  if (companyId) sessionWhere.companyId = companyId;
  const session = await prisma.salesSession.findFirst({
    where: sessionWhere,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      company: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, category: true } },
      messages: { orderBy: { createdAt: 'asc' } },
      analytics: true
    }
  });

  if (!session) {
    return res.status(404).render('error', { title: 'Not Found', message: 'Session not found', statusCode: 404 });
  }

  const userName = session.user ? `${session.user.firstName} ${session.user.lastName}` : session.userName || 'Unknown';

  res.render('admin/sessions/view', {
    title: `Session - ${userName}`,
    session,
    user: req.user
  });
}));

// API: Get session stats
router.get('/api/stats', requirePermission('VIEW_ANALYTICS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const baseWhere: any = companyId ? { companyId } : {};
  const [totalSessions, completedSessions, recentSessionCount] = await Promise.all([
    prisma.salesSession.count({ where: baseWhere }),
    prisma.salesSession.count({ where: { ...baseWhere, outcome: 'completed' } }),
    prisma.salesSession.count({
      where: { ...baseWhere, startedAt: { gte: thirtyDaysAgo } }
    })
  ]);

  res.json({
    totalSessions,
    completedSessions,
    completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0,
    recentSessions: recentSessionCount
  });
}));

// API: Delete session
router.delete('/:id', requirePermission('DELETE_SESSIONS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const sessionWhere: any = { id: req.params.id };
  if (companyId) sessionWhere.companyId = companyId;

  const session = await prisma.salesSession.findFirst({
    where: sessionWhere
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  await prisma.salesSession.delete({ where: { id: req.params.id } });

  logger.info(`Session deleted: ${req.params.id}`, { userId: req.user?.id });
  res.json({ success: true });
}));

export default router;
