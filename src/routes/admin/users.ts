import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { requireAuthOrToken } from '../../middleware/auth';
import { loadTenant, getTenantId } from '../../middleware/tenant';
import { requirePermission } from '../../middleware/rbac';
import { checkUserLimit, loadSubscriptionLimits } from '../../middleware/subscription';
import { hashPassword } from '../../services/auth.service';
import { canAddUser } from '../../services/subscription.service';
import logger from '../../utils/logger';
import { ROLES } from '../../config/constants';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuthOrToken);
router.use(loadTenant);
router.use(loadSubscriptionLimits);

// List users
router.get('/', requirePermission('VIEW_USERS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const tier = req.tenant?.subscriptionTier || 'starter';
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const role = req.query.role as string;
  const status = req.query.status as string;

  // Build where clause - SUPER_ADMIN sees all if no company selected
  const where: any = {};
  if (companyId) where.companyId = companyId;
  if (role) where.role = role;
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { sessions: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.user.count({ where })
  ]);

  // Get available roles based on current user's role
  const availableRoles = getManageableRoles(req.user?.role || 'TRAINEE');

  // Get user limit info for the UI
  const userLimitInfo = companyId ? await canAddUser(companyId, tier) : null;

  res.render('admin/users/index', {
    title: 'Users',
    users,
    roles: availableRoles,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    filters: { role, status },
    user: req.user,
    userLimit: userLimitInfo
  });
}));

// Create user - with subscription limit check
router.post('/', requirePermission('MANAGE_USERS'), checkUserLimit, asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const tier = req.tenant?.subscriptionTier || 'starter';
  const { email, password, firstName, lastName, role } = req.body;

  if (!companyId) {
    res.status(400).json({ error: 'Company context required to create user' });
    return;
  }

  // Double-check user limit (in case of race condition)
  const limitCheck = await canAddUser(companyId, tier);
  if (!limitCheck.allowed) {
    res.status(403).json({
      error: limitCheck.message,
      upgradeRequired: true,
      currentCount: limitCheck.currentCount,
      limit: limitCheck.limit
    });
    return;
  }

  // Validate role assignment
  const availableRoles = getManageableRoles(req.user?.role || 'TRAINEE');
  if (!availableRoles.includes(role)) {
    res.status(403).json({ error: 'Cannot assign this role' });
    return;
  }

  // Check if email exists
  const existing = await prisma.user.findFirst({
    where: { email, companyId }
  });

  if (existing) {
    res.status(400).json({ error: 'Email already exists in this company' });
    return;
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      companyId,
      isActive: true,
      emailVerified: true // Admin-created users are auto-verified
    }
  });

  logger.info(`User created: ${email}`, { userId: req.user?.id, newUserId: user.id });
  res.json({ success: true, user: { id: user.id, email: user.email } });
}));

// Update user
router.put('/:id', requirePermission('MANAGE_USERS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { firstName, lastName, role, isActive } = req.body;

  const userWhere: any = { id: req.params.id };
  if (companyId) userWhere.companyId = companyId;
  const user = await prisma.user.findFirst({
    where: userWhere
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Validate role assignment
  if (role) {
    const availableRoles = getManageableRoles(req.user?.role || 'TRAINEE');
    if (!availableRoles.includes(role)) {
      res.status(403).json({ error: 'Cannot assign this role' });
      return;
    }
  }

  await prisma.user.update({
    where: { id: req.params.id },
    data: {
      firstName,
      lastName,
      role: role || user.role,
      isActive: isActive === true || isActive === 'on'
    }
  });

  logger.info(`User updated: ${user.email}`, { userId: req.user?.id, updatedUserId: req.params.id });
  res.json({ success: true });
}));

// Reset user password
router.post('/:id/reset-password', requirePermission('MANAGE_USERS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { newPassword } = req.body;

  const userWhere: any = { id: req.params.id };
  if (companyId) userWhere.companyId = companyId;
  const user = await prisma.user.findFirst({
    where: userWhere
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: req.params.id },
    data: { password: hashedPassword }
  });

  logger.info(`Password reset for user: ${user.email}`, { userId: req.user?.id, resetUserId: req.params.id });
  res.json({ success: true });
}));

// Delete user
router.delete('/:id', requirePermission('MANAGE_USERS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  const userWhere: any = { id: req.params.id };
  if (companyId) userWhere.companyId = companyId;
  const user = await prisma.user.findFirst({
    where: userWhere
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Prevent self-deletion
  if (user.id === req.user?.id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }

  await prisma.user.delete({ where: { id: req.params.id } });
  logger.info(`User deleted: ${user.email}`, { userId: req.user?.id, deletedUserId: req.params.id });
  res.json({ success: true });
}));

// Helper: Get roles a user can manage
function getManageableRoles(currentRole: string): string[] {
  const roleHierarchy: string[] = [
    ROLES.SUPER_ADMIN,
    ROLES.COMPANY_ADMIN,
    ROLES.MANAGER,
    ROLES.SUPERVISOR,
    ROLES.TRAINEE
  ];

  const currentIndex = roleHierarchy.indexOf(currentRole);
  if (currentIndex === -1) return [ROLES.TRAINEE];

  // Can only create users of lower roles
  return roleHierarchy.slice(currentIndex + 1);
}

export default router;
