import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { requireAuthOrToken } from '../../middleware/auth';
import { loadTenant, getTenantId } from '../../middleware/tenant';
import { getMenuForRole, groupMenuBySection } from '../../middleware/rbac';
import { APP_NAME } from '../../config/constants';

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

// Apply authentication (session OR token) and tenant loading to all admin routes
router.use(requireAuthOrToken);
router.use(loadTenant);

// Add menu and common data to all admin views
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    const menuItems = getMenuForRole(req.user.role);
    res.locals.menu = groupMenuBySection(menuItems);
    res.locals.basePath = process.env.BASE_PATH || '';
    res.locals.appName = APP_NAME;
    res.locals.user = req.user;
    res.locals.tenant = req.tenant;
    res.locals.industryCode = req.tenant?.industryCode;
    res.locals.active = '';
    // Ensure token is always defined (for template compatibility)
    res.locals.token = res.locals.token || req.query.token || '';
  }
  next();
});

// Dashboard
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get dashboard stats with tenant scoping
  const whereClause = companyId ? { companyId } : {};

  const [
    totalSessions,
    completedSessions,
    totalProducts,
    totalTechniques,
    recentSessions,
    topUsers
  ] = await Promise.all([
    // Total sessions
    prisma.salesSession.count({ where: whereClause }),

    // Completed sessions
    prisma.salesSession.count({
      where: { ...whereClause, outcome: 'completed' }
    }),

    // Total products
    prisma.product.count({ where: whereClause }),

    // Total techniques
    prisma.salesTechnique.count({ where: whereClause }),

    // Recent sessions
    prisma.salesSession.findMany({
      where: whereClause,
      orderBy: { startedAt: 'desc' },
      take: 5,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { name: true } }
      }
    }),

    // Top performers (last 30 days)
    prisma.salesSession.groupBy({
      by: ['userId'],
      where: {
        ...whereClause,
        startedAt: { gte: thirtyDaysAgo }
      },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 5
    })
  ]);

  // Get user details for top users
  const userIds = topUsers.map(u => u.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true }
  });

  const topUsersWithDetails = topUsers.map(u => ({
    ...u,
    user: users.find(user => user.id === u.userId)
  }));

  // Calculate conversion rate
  const conversionRate = totalSessions > 0
    ? ((completedSessions / totalSessions) * 100).toFixed(1)
    : '0.0';

  res.render('admin/dashboard', {
    title: 'Dashboard',
    active: 'dashboard',
    stats: {
      totalSessions,
      successfulSessions: completedSessions,
      conversionRate,
      totalProducts,
      totalTechniques
    },
    recentSessions,
    topUsers: topUsersWithDetails,
    topTechniques: []  // Will be populated when we have technique data
  });
}));

export default router;
