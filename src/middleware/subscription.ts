// ===========================================
// Subscription Middleware - Feature Enforcement
// ===========================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import {
  hasApiAccess,
  hasVoiceAccess,
  hasFullAnalytics,
  hasCustomBranding,
  canAddUser,
  canAddIndustry,
  canCreateSession,
  getUsageSummary,
  getTierLimits,
  isUnlimited
} from '../services/subscription.service';
import { SUBSCRIPTION_TIERS } from '../config/constants';

// Require API access (Professional+)
export const requireApiAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tier = req.tenant?.subscriptionTier || req.user?.company?.subscriptionTier || SUBSCRIPTION_TIERS.STARTER;

    if (!hasApiAccess(tier)) {
      if (req.accepts('json')) {
        return res.status(403).json({
          error: 'API access requires Professional plan or higher',
          upgradeRequired: true,
          requiredTier: SUBSCRIPTION_TIERS.PROFESSIONAL
        });
      }
      throw new AppError('API access requires Professional plan or higher. Please upgrade your subscription.', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Require voice access (Business+)
export const requireVoiceAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tier = req.tenant?.subscriptionTier || req.user?.company?.subscriptionTier || SUBSCRIPTION_TIERS.STARTER;

    if (!hasVoiceAccess(tier)) {
      if (req.accepts('json')) {
        return res.status(403).json({
          error: 'Voice training requires Business plan or higher',
          upgradeRequired: true,
          requiredTier: SUBSCRIPTION_TIERS.BUSINESS
        });
      }
      throw new AppError('Voice training requires Business plan or higher. Please upgrade your subscription.', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Require full analytics (Professional+)
export const requireFullAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tier = req.tenant?.subscriptionTier || req.user?.company?.subscriptionTier || SUBSCRIPTION_TIERS.STARTER;

    if (!hasFullAnalytics(tier)) {
      if (req.accepts('json')) {
        return res.status(403).json({
          error: 'Full analytics requires Professional plan or higher',
          upgradeRequired: true,
          requiredTier: SUBSCRIPTION_TIERS.PROFESSIONAL
        });
      }
      throw new AppError('Full analytics requires Professional plan or higher. Please upgrade your subscription.', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Require custom branding (Business+)
export const requireCustomBranding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tier = req.tenant?.subscriptionTier || req.user?.company?.subscriptionTier || SUBSCRIPTION_TIERS.STARTER;

    if (!hasCustomBranding(tier)) {
      if (req.accepts('json')) {
        return res.status(403).json({
          error: 'Custom branding requires Business plan or higher',
          upgradeRequired: true,
          requiredTier: SUBSCRIPTION_TIERS.BUSINESS
        });
      }
      throw new AppError('Custom branding requires Business plan or higher. Please upgrade your subscription.', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Check user limit before creating new user
export const checkUserLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.tenant?.id || req.user?.companyId;
    const tier = req.tenant?.subscriptionTier || req.user?.company?.subscriptionTier || SUBSCRIPTION_TIERS.STARTER;

    if (!companyId) {
      return next();
    }

    const result = await canAddUser(companyId, tier);

    if (!result.allowed) {
      if (req.accepts('json')) {
        return res.status(403).json({
          error: result.message,
          upgradeRequired: true,
          currentCount: result.currentCount,
          limit: result.limit
        });
      }
      throw new AppError(result.message!, 403);
    }

    // Attach usage info to request for UI display
    res.locals.userLimit = {
      current: result.currentCount,
      limit: result.limit,
      unlimited: isUnlimited(result.limit)
    };

    next();
  } catch (error) {
    next(error);
  }
};

// Check industry limit before adding product to new industry
export const checkIndustryLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.tenant?.id || req.user?.companyId;
    const tier = req.tenant?.subscriptionTier || req.user?.company?.subscriptionTier || SUBSCRIPTION_TIERS.STARTER;
    const newIndustryId = req.body?.industryId;

    if (!companyId) {
      return next();
    }

    const result = await canAddIndustry(companyId, tier, newIndustryId);

    if (!result.allowed) {
      if (req.accepts('json')) {
        return res.status(403).json({
          error: result.message,
          upgradeRequired: true,
          currentCount: result.currentCount,
          limit: result.limit
        });
      }
      throw new AppError(result.message!, 403);
    }

    res.locals.industryLimit = {
      current: result.currentCount,
      limit: result.limit,
      unlimited: isUnlimited(result.limit)
    };

    next();
  } catch (error) {
    next(error);
  }
};

// Check session limit before creating new session
export const checkSessionLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.tenant?.id || req.user?.companyId;
    const tier = req.tenant?.subscriptionTier || req.user?.company?.subscriptionTier || SUBSCRIPTION_TIERS.STARTER;

    if (!companyId) {
      return next();
    }

    const result = await canCreateSession(companyId, tier);

    if (!result.allowed) {
      if (req.accepts('json')) {
        return res.status(403).json({
          error: result.message,
          upgradeRequired: true,
          currentCount: result.currentCount,
          limit: result.limit
        });
      }
      throw new AppError(result.message!, 403);
    }

    res.locals.sessionLimit = {
      current: result.currentCount,
      limit: result.limit,
      unlimited: isUnlimited(result.limit)
    };

    next();
  } catch (error) {
    next(error);
  }
};

// Load subscription limits for display in templates
export const loadSubscriptionLimits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.tenant?.id || req.user?.companyId;
    const tier = req.tenant?.subscriptionTier || req.user?.company?.subscriptionTier || SUBSCRIPTION_TIERS.STARTER;

    if (companyId) {
      const usage = await getUsageSummary(companyId, tier);
      res.locals.subscriptionUsage = usage;
      res.locals.tierLimits = getTierLimits(tier);
    }

    // Make tier info available in templates
    res.locals.subscriptionTier = tier;
    res.locals.tierFeatures = {
      apiAccess: hasApiAccess(tier),
      voiceEnabled: hasVoiceAccess(tier),
      fullAnalytics: hasFullAnalytics(tier),
      customBranding: hasCustomBranding(tier)
    };

    next();
  } catch (error) {
    next(error);
  }
};

// Feature check helper for templates - returns true if feature is available
export function checkFeature(tier: string, feature: 'api' | 'voice' | 'analytics' | 'branding'): boolean {
  switch (feature) {
    case 'api':
      return hasApiAccess(tier);
    case 'voice':
      return hasVoiceAccess(tier);
    case 'analytics':
      return hasFullAnalytics(tier);
    case 'branding':
      return hasCustomBranding(tier);
    default:
      return false;
  }
}
