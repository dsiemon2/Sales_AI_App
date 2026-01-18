import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';
import { logSecurity } from '../utils/logger';
import { ROLES, Role, ROLE_HIERARCHY } from '../config/constants';
import { validateApiToken } from '../services/api-token.service';

// Extend Express Session
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    companyId?: string;
    role?: Role;
    email?: string;
    isAuthenticated?: boolean;
    demoId?: string;
    trialCode?: string;
    trialDays?: number;
    trialIndustryId?: string;
  }
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: Role;
        companyId: string | null;
        company?: {
          id: string;
          name: string;
          industryId: string;
          subscriptionTier: string;
          subscriptionStatus: string;
        };
      };
    }
  }
}

// Authentication middleware - requires user to be logged in
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session?.isAuthenticated || !req.session?.userId) {
      // Check for API token in header
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const validation = await validateApiToken(token);

        if (validation.valid && validation.company) {
          // Get a user from this company to set as the request user (preferably admin)
          const companyUser = await prisma.user.findFirst({
            where: {
              companyId: validation.companyId,
              isActive: true
            },
            orderBy: {
              role: 'desc' // Get highest role user
            }
          });

          if (companyUser) {
            req.user = {
              id: companyUser.id,
              email: companyUser.email,
              firstName: companyUser.firstName,
              lastName: companyUser.lastName,
              role: companyUser.role as Role,
              companyId: companyUser.companyId,
              company: validation.company
            };
            res.locals.user = req.user;
            res.locals.apiToken = true;
            return next();
          }
        }

        // Invalid token
        logSecurity('API_AUTH_FAILED', {
          ipAddress: req.ip || 'unknown',
          riskLevel: 'medium'
        });
        throw new AppError(validation.error || 'Invalid API token', 401);
      }

      // Redirect to login for browser requests
      if (req.accepts('html')) {
        const basePath = process.env.BASE_PATH || '';
        // Include basePath in the redirect parameter
        const redirectUrl = req.originalUrl.startsWith(basePath) ? req.originalUrl : `${basePath}${req.originalUrl}`;
        return res.redirect(`${basePath}/auth/login?redirect=${encodeURIComponent(redirectUrl)}`);
      }

      throw new AppError('Unauthorized', 401);
    }

    // Load user from database
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            industryId: true,
            subscriptionTier: true,
            subscriptionStatus: true
          }
        }
      }
    });

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      throw new AppError('User not found or inactive', 401);
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as Role,
      companyId: user.companyId,
      company: user.company || undefined
    };

    // Make user available in templates
    res.locals.user = req.user;

    next();
  } catch (error) {
    next(error);
  }
};

// Require specific role(s)
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401));
    }

    // Super admin has access to everything
    if (req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    // Check if user has required role
    if (!allowedRoles.includes(req.user.role)) {
      logSecurity('PERMISSION_DENIED', {
        userId: req.user.id,
        ipAddress: req.ip || 'unknown',
        riskLevel: 'medium'
      });

      if (req.accepts('html')) {
        return res.status(403).render('error', {
          title: 'Access Denied',
          message: 'You do not have permission to access this resource.',
          statusCode: 403
        });
      }

      return next(new AppError('Access denied', 403));
    }

    next();
  };
};

// Require minimum role level
export const requireMinRole = (minRole: Role) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401));
    }

    const userLevel = ROLE_HIERARCHY[req.user.role];
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel < requiredLevel) {
      logSecurity('PERMISSION_DENIED', {
        userId: req.user.id,
        ipAddress: req.ip || 'unknown',
        riskLevel: 'medium'
      });

      if (req.accepts('html')) {
        return res.status(403).render('error', {
          title: 'Access Denied',
          message: 'You do not have permission to access this resource.',
          statusCode: 403
        });
      }

      return next(new AppError('Access denied', 403));
    }

    next();
  };
};

// Require same company or super admin
export const requireSameCompany = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Unauthorized', 401));
  }

  // Super admin can access any company
  if (req.user.role === ROLES.SUPER_ADMIN) {
    return next();
  }

  // Get company ID from params or body
  const targetCompanyId = req.params.companyId || req.body?.companyId;

  if (targetCompanyId && targetCompanyId !== req.user.companyId) {
    logSecurity('PERMISSION_DENIED', {
      userId: req.user.id,
      ipAddress: req.ip || 'unknown',
      riskLevel: 'high'
    });

    return next(new AppError('Access denied', 403));
  }

  next();
};

// Optional authentication - doesn't require login but loads user if available
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.session?.isAuthenticated && req.session?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              industryId: true,
              subscriptionTier: true,
              subscriptionStatus: true
            }
          }
        }
      });

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as Role,
          companyId: user.companyId,
          company: user.company || undefined
        };
        res.locals.user = req.user;
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
};

// Admin token authentication (for quick access like other Docker projects)
export const requireAdminToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.query.token || req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN || 'admin';
  const basePath = process.env.BASE_PATH || '';

  if (token !== expectedToken) {
    if (req.accepts('html')) {
      return res.redirect(`${basePath}/admin/login`);
    }
    return next(new AppError('Invalid admin token', 401));
  }

  // For token auth, pass token to views
  res.locals.token = token;
  next();
};

// Combined auth: accepts either session auth OR token auth
export const requireAuthOrToken = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.query.token || req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN || 'admin';
  const basePath = process.env.BASE_PATH || '';

  // If valid token provided, allow access as super admin
  if (token === expectedToken) {
    // Load super admin user for token auth
    const superAdmin = await prisma.user.findFirst({
      where: { role: ROLES.SUPER_ADMIN },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            industryId: true,
            subscriptionTier: true,
            subscriptionStatus: true
          }
        }
      }
    });

    if (superAdmin) {
      req.user = {
        id: superAdmin.id,
        email: superAdmin.email,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
        role: superAdmin.role as Role,
        companyId: superAdmin.companyId,
        company: superAdmin.company || undefined
      };
      res.locals.user = req.user;
      res.locals.token = token;
      return next();
    }
  }

  // Fall back to session auth
  if (req.session?.isAuthenticated && req.session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            industryId: true,
            subscriptionTier: true,
            subscriptionStatus: true
          }
        }
      }
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as Role,
        companyId: user.companyId,
        company: user.company || undefined
      };
      res.locals.user = req.user;
      return next();
    }
  }

  // No valid auth - redirect to appropriate login page
  if (req.accepts('html')) {
    // Determine the full redirect URL
    const redirectUrl = req.originalUrl.startsWith(basePath) ? req.originalUrl : `${basePath}${req.originalUrl}`;

    // Check if this is an admin route - redirect to admin login
    const isAdminRoute = req.originalUrl.includes('/admin') || req.path.includes('/admin');
    const loginPath = isAdminRoute ? `${basePath}/admin/login` : `${basePath}/auth/login`;

    return res.redirect(`${loginPath}?redirect=${encodeURIComponent(redirectUrl)}`);
  }
  return next(new AppError('Unauthorized', 401));
};
