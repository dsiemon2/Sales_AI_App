import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';
import { ROLES } from '../config/constants';

// Extend Express Request with tenant info
declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string;
        name: string;
        slug: string;
        industryId: string;
        industryCode: string;
        subscriptionTier: string;
        subscriptionStatus: string;
        branding?: {
          logoUrl: string;
          primaryColor: string;
          secondaryColor: string;
          accentColor: string;
        };
      };
    }
  }
}

// Load tenant context from authenticated user
export const loadTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip if no user
    if (!req.user) {
      return next();
    }

    // For super admin, auto-select first available company if no tenant set
    if (req.user.role === ROLES.SUPER_ADMIN) {
      // Check if tenant already set (e.g., via switchTenant)
      if (req.tenant) {
        return next();
      }

      // Auto-select demo company or first company
      const defaultCompany = await prisma.company.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          industry: {
            select: {
              code: true,
              name: true,
              colorPrimary: true,
              colorSecondary: true,
              colorAccent: true,
              icon: true
            }
          },
          branding: {
            select: {
              logoUrl: true,
              primaryColor: true,
              secondaryColor: true,
              accentColor: true
            }
          }
        }
      });

      if (defaultCompany) {
        req.tenant = {
          id: defaultCompany.id,
          name: defaultCompany.name,
          slug: defaultCompany.slug,
          industryId: defaultCompany.industryId,
          industryCode: defaultCompany.industry.code,
          subscriptionTier: defaultCompany.subscriptionTier,
          subscriptionStatus: defaultCompany.subscriptionStatus,
          branding: defaultCompany.branding ? {
            logoUrl: defaultCompany.branding.logoUrl,
            primaryColor: defaultCompany.branding.primaryColor || defaultCompany.industry.colorPrimary,
            secondaryColor: defaultCompany.branding.secondaryColor || defaultCompany.industry.colorSecondary,
            accentColor: defaultCompany.branding.accentColor || defaultCompany.industry.colorAccent
          } : {
            logoUrl: '',
            primaryColor: defaultCompany.industry.colorPrimary,
            secondaryColor: defaultCompany.industry.colorSecondary,
            accentColor: defaultCompany.industry.colorAccent
          }
        };

        res.locals.tenant = req.tenant;
        res.locals.industry = {
          code: defaultCompany.industry.code,
          name: defaultCompany.industry.name,
          icon: defaultCompany.industry.icon
        };
      }

      return next();
    }

    // User must have a company
    if (!req.user.companyId) {
      throw new AppError('User is not associated with a company', 403);
    }

    // Load company with industry and branding
    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId },
      include: {
        industry: {
          select: {
            code: true,
            name: true,
            colorPrimary: true,
            colorSecondary: true,
            colorAccent: true,
            icon: true
          }
        },
        branding: {
          select: {
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            accentColor: true
          }
        }
      }
    });

    if (!company) {
      throw new AppError('Company not found', 404);
    }

    if (!company.isActive) {
      throw new AppError('Company account is inactive', 403);
    }

    // Check subscription status
    if (company.subscriptionStatus === 'expired' || company.subscriptionStatus === 'suspended') {
      if (req.accepts('html') && !req.path.includes('/billing')) {
        return res.redirect('/admin/billing?expired=true');
      }
      throw new AppError('Subscription expired or suspended', 403);
    }

    // Attach tenant info to request
    req.tenant = {
      id: company.id,
      name: company.name,
      slug: company.slug,
      industryId: company.industryId,
      industryCode: company.industry.code,
      subscriptionTier: company.subscriptionTier,
      subscriptionStatus: company.subscriptionStatus,
      branding: company.branding ? {
        logoUrl: company.branding.logoUrl,
        primaryColor: company.branding.primaryColor || company.industry.colorPrimary,
        secondaryColor: company.branding.secondaryColor || company.industry.colorSecondary,
        accentColor: company.branding.accentColor || company.industry.colorAccent
      } : {
        logoUrl: '',
        primaryColor: company.industry.colorPrimary,
        secondaryColor: company.industry.colorSecondary,
        accentColor: company.industry.colorAccent
      }
    };

    // Make tenant available in templates
    res.locals.tenant = req.tenant;
    res.locals.industry = {
      code: company.industry.code,
      name: company.industry.name,
      icon: company.industry.icon
    };

    next();
  } catch (error) {
    next(error);
  }
};

// Ensure all database queries are scoped to tenant
export const scopeToTenant = (req: Request, res: Response, next: NextFunction) => {
  if (!req.tenant && req.user?.role !== ROLES.SUPER_ADMIN) {
    return next(new AppError('Tenant context required', 403));
  }
  next();
};

// Allow super admin to switch tenant context
export const switchTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== ROLES.SUPER_ADMIN) {
      return next(new AppError('Only super admin can switch tenants', 403));
    }

    const companyId = req.query.companyId as string || req.body?.companyId;

    if (!companyId) {
      return next();
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        industry: {
          select: {
            code: true,
            name: true,
            colorPrimary: true,
            colorSecondary: true,
            colorAccent: true,
            icon: true
          }
        },
        branding: true
      }
    });

    if (!company) {
      throw new AppError('Company not found', 404);
    }

    req.tenant = {
      id: company.id,
      name: company.name,
      slug: company.slug,
      industryId: company.industryId,
      industryCode: company.industry.code,
      subscriptionTier: company.subscriptionTier,
      subscriptionStatus: company.subscriptionStatus,
      branding: company.branding ? {
        logoUrl: company.branding.logoUrl,
        primaryColor: company.branding.primaryColor,
        secondaryColor: company.branding.secondaryColor,
        accentColor: company.branding.accentColor
      } : undefined
    };

    res.locals.tenant = req.tenant;

    next();
  } catch (error) {
    next(error);
  }
};

// Get tenant ID helper (for database queries)
export const getTenantId = (req: Request): string | null => {
  if (req.tenant) {
    return req.tenant.id;
  }
  if (req.user?.companyId) {
    return req.user.companyId;
  }
  return null;
};
