import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { requireAuthOrToken } from '../../middleware/auth';
import { loadTenant, getTenantId } from '../../middleware/tenant';
import { requirePermission } from '../../middleware/rbac';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuthOrToken);
router.use(loadTenant);

// Analytics dashboard
router.get('/', requirePermission('VIEW_ANALYTICS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const days = parseInt(req.query.days as string) || 30;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Build where clause - SUPER_ADMIN sees all if no company selected
  const baseWhere: any = companyId ? { companyId } : {};
  const messageWhere: any = companyId ? { session: { companyId } } : {};
  const groupWhere: any = companyId ? { companyId, startedAt: { gte: startDate } } : { startedAt: { gte: startDate } };

  // Get session analytics
  const [
    totalSessions,
    completedSessions,
    totalMessages,
    sessionsOverTime,
    topUsers
  ] = await Promise.all([
    // Total sessions
    prisma.salesSession.count({ where: baseWhere }),

    // Completed sessions
    prisma.salesSession.count({ where: { ...baseWhere, outcome: 'completed' } }),

    // Total messages
    prisma.sessionMessage.count({
      where: messageWhere
    }),

    // Sessions over time (grouped by day) - use Prisma groupBy for cross-platform compatibility
    prisma.salesSession.groupBy({
      by: ['startedAt'],
      where: { ...baseWhere, startedAt: { gte: startDate } },
      _count: true,
      orderBy: { startedAt: 'asc' }
    }).then(results => {
      // Group by date (day)
      const byDate = new Map<string, number>();
      results.forEach(r => {
        const dateKey = r.startedAt.toISOString().split('T')[0];
        byDate.set(dateKey, (byDate.get(dateKey) || 0) + r._count);
      });
      return Array.from(byDate.entries()).map(([date, count]) => ({ date, count }));
    }),

    // Top users by sessions
    prisma.salesSession.groupBy({
      by: ['userId'],
      where: groupWhere,
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 10
    })
  ]);

  // Get user details for top users
  const userIds = topUsers.map(u => u.userId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true }
  });

  const topUsersWithNames = topUsers.map(u => ({
    ...u,
    user: users.find(user => user.id === u.userId)
  }));

  // Get sessions for technique and duration analysis
  const allSessions = await prisma.salesSession.findMany({
    where: baseWhere,
    select: { techniquesUsed: true, startedAt: true, endedAt: true }
  });

  // Product usage - sessions don't track productId, so provide empty array
  const productUsage: { productId: string; _count: number; product: { id: string; name: string } | undefined }[] = [];

  // Aggregate technique usage from techniquesUsed JSON array field
  const techniqueCounts = new Map<string, number>();
  allSessions.forEach(s => {
    // techniquesUsed is a JSON array of technique names
    const techniques = Array.isArray(s.techniquesUsed) ? s.techniquesUsed : [];
    techniques.forEach((technique: string) => {
      if (technique) {
        techniqueCounts.set(technique, (techniqueCounts.get(technique) || 0) + 1);
      }
    });
  });
  const techniqueUsage = Array.from(techniqueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([techniqueUsed, count]) => ({ techniqueUsed, _count: count }));

  // Calculate avg duration from sessions with endedAt
  const sessionsWithDuration = allSessions.filter(s => s.endedAt);
  const avgDuration = sessionsWithDuration.length > 0
    ? sessionsWithDuration.reduce((acc, s) => acc + (s.endedAt!.getTime() - s.startedAt.getTime()), 0) / sessionsWithDuration.length / 1000
    : 0;

  res.render('admin/analytics/index', {
    title: 'Analytics',
    stats: {
      totalSessions,
      completedSessions,
      completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0,
      totalMessages,
      avgMessagesPerSession: totalSessions > 0 ? (totalMessages / totalSessions).toFixed(1) : 0,
      avgDuration
    },
    sessionsOverTime,
    topUsers: topUsersWithNames,
    productUsage,
    techniqueUsage,
    days,
    user: req.user
  });
}));

// API: Get session trends
router.get('/api/trends', requirePermission('VIEW_ANALYTICS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const days = parseInt(req.query.days as string) || 30;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const baseWhere: any = companyId ? { companyId, startedAt: { gte: startDate } } : { startedAt: { gte: startDate } };
  const sessions = await prisma.salesSession.findMany({
    where: baseWhere,
    select: { startedAt: true, outcome: true }
  });

  // Group by date
  const byDate = new Map<string, { sessions: number; completed: number }>();
  sessions.forEach(s => {
    const dateKey = s.startedAt.toISOString().split('T')[0];
    const existing = byDate.get(dateKey) || { sessions: 0, completed: 0 };
    existing.sessions++;
    if (s.outcome === 'completed') existing.completed++;
    byDate.set(dateKey, existing);
  });

  const trends = Array.from(byDate.entries()).map(([date, stats]) => ({
    date,
    sessions: stats.sessions,
    completed: stats.completed
  })).sort((a, b) => a.date.localeCompare(b.date));

  res.json(trends);
}));

// API: Get user performance
router.get('/api/users', requirePermission('VIEW_ANALYTICS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  const userPerformance = await prisma.salesSession.groupBy({
    by: ['userId'],
    where: { companyId },
    _count: true,
    _avg: { score: true }
  });

  const userIds = userPerformance.map(u => u.userId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, email: true }
  });

  const result = userPerformance.map(u => ({
    user: users.find(user => user.id === u.userId),
    sessionCount: u._count,
    avgScore: u._avg.score
  }));

  res.json(result);
}));

// API: Export analytics data
router.get('/api/export', requirePermission('VIEW_ALL_ANALYTICS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const format = req.query.format as string || 'json';
  const days = parseInt(req.query.days as string) || 30;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const sessions = await prisma.salesSession.findMany({
    where: { companyId, startedAt: { gte: startDate } },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      company: { select: { name: true } }
    },
    orderBy: { startedAt: 'desc' }
  });

  if (format === 'csv') {
    const csv = [
      'Date,User,Company,Outcome,Score',
      ...sessions.map(s => {
        const userName = s.user ? `${s.user.firstName} ${s.user.lastName}` : s.userName || 'Unknown';
        return `${s.startedAt.toISOString()},${userName},${s.company?.name || ''},${s.outcome},${s.score || ''}`;
      })
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=analytics-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } else {
    res.json(sessions);
  }
}));

export default router;
