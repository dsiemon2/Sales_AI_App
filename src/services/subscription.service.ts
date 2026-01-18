// ===========================================
// Subscription Service - Feature Limit Enforcement
// ===========================================

import prisma from '../config/database';
import { logInfo, logAudit } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { TIER_LIMITS, SUBSCRIPTION_TIERS, SubscriptionTier, PRICING } from '../config/constants';

// Get tier limits for a subscription tier
export function getTierLimits(tier: string) {
  const validTier = tier as SubscriptionTier;
  return TIER_LIMITS[validTier] || TIER_LIMITS[SUBSCRIPTION_TIERS.STARTER];
}

// Check if a limit value means unlimited
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

// ===========================================
// USER LIMIT CHECKS
// ===========================================

// Get current user count for a company
export async function getUserCount(companyId: string): Promise<number> {
  return prisma.user.count({
    where: {
      companyId,
      isActive: true
    }
  });
}

// Check if company can add more users
export async function canAddUser(companyId: string, tier: string): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  message?: string;
}> {
  const limits = getTierLimits(tier);
  const currentCount = await getUserCount(companyId);

  if (isUnlimited(limits.users)) {
    return { allowed: true, currentCount, limit: -1 };
  }

  const allowed = currentCount < limits.users;
  return {
    allowed,
    currentCount,
    limit: limits.users,
    message: allowed
      ? undefined
      : `User limit reached (${currentCount}/${limits.users}). Upgrade to add more users.`
  };
}

// Enforce user limit - throws error if limit reached
export async function enforceUserLimit(companyId: string, tier: string): Promise<void> {
  const result = await canAddUser(companyId, tier);
  if (!result.allowed) {
    throw new AppError(result.message!, 403);
  }
}

// ===========================================
// INDUSTRY LIMIT CHECKS
// ===========================================

// In this SaaS model, each Company belongs to ONE industry (Company.industryId).
// The "industry limit" in tiers refers to how many industries a parent account
// could potentially manage, but practically each company is one industry.
// For now, this returns 1 as each company has exactly one industry.

// Get current industry count for a company (always 1 in this model)
export async function getIndustryCount(companyId: string): Promise<number> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { industryId: true }
  });
  return company?.industryId ? 1 : 0;
}

// Check if company can add products in more industries
// In this model, a company is locked to one industry, so this always returns allowed
export async function canAddIndustry(companyId: string, tier: string, _newIndustryId?: string): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  message?: string;
}> {
  const limits = getTierLimits(tier);
  const currentCount = await getIndustryCount(companyId);

  // A company belongs to exactly one industry, so they're always within limit
  // unless we implement multi-industry companies in the future
  return {
    allowed: true,
    currentCount,
    limit: isUnlimited(limits.industries) ? -1 : limits.industries,
    message: undefined
  };
}

// Enforce industry limit - throws error if limit reached
export async function enforceIndustryLimit(companyId: string, tier: string, newIndustryId?: string): Promise<void> {
  const result = await canAddIndustry(companyId, tier, newIndustryId);
  if (!result.allowed) {
    throw new AppError(result.message!, 403);
  }
}

// ===========================================
// SESSION QUOTA CHECKS
// ===========================================

// Get current month session count for a company
export async function getMonthlySessionCount(companyId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return prisma.salesSession.count({
    where: {
      companyId,
      createdAt: { gte: startOfMonth }
    }
  });
}

// Check if company can create more sessions this month
export async function canCreateSession(companyId: string, tier: string): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  message?: string;
}> {
  const limits = getTierLimits(tier);

  if (isUnlimited(limits.sessionsPerMonth)) {
    return { allowed: true, currentCount: 0, limit: -1 };
  }

  const currentCount = await getMonthlySessionCount(companyId);
  const allowed = currentCount < limits.sessionsPerMonth;

  return {
    allowed,
    currentCount,
    limit: limits.sessionsPerMonth,
    message: allowed
      ? undefined
      : `Monthly session limit reached (${currentCount}/${limits.sessionsPerMonth}). Upgrade for more sessions.`
  };
}

// Enforce session limit - throws error if limit reached
export async function enforceSessionLimit(companyId: string, tier: string): Promise<void> {
  const result = await canCreateSession(companyId, tier);
  if (!result.allowed) {
    throw new AppError(result.message!, 403);
  }
}

// ===========================================
// FEATURE ACCESS CHECKS
// ===========================================

// Check if tier has API access
export function hasApiAccess(tier: string): boolean {
  const limits = getTierLimits(tier);
  return limits.apiAccess;
}

// Check if tier has voice enabled
export function hasVoiceAccess(tier: string): boolean {
  const limits = getTierLimits(tier);
  return limits.voiceEnabled;
}

// Check if tier has priority support
export function hasPrioritySupport(tier: string): boolean {
  const limits = getTierLimits(tier);
  return limits.prioritySupport;
}

// Check if tier has full analytics (Professional+)
export function hasFullAnalytics(tier: string): boolean {
  return tier !== SUBSCRIPTION_TIERS.STARTER;
}

// Check if tier has custom branding (Business+)
export function hasCustomBranding(tier: string): boolean {
  return tier === SUBSCRIPTION_TIERS.BUSINESS || tier === SUBSCRIPTION_TIERS.ENTERPRISE;
}

// Enforce API access - throws error if not allowed
export function enforceApiAccess(tier: string): void {
  if (!hasApiAccess(tier)) {
    throw new AppError('API access requires Professional plan or higher. Please upgrade your subscription.', 403);
  }
}

// Enforce voice access - throws error if not allowed
export function enforceVoiceAccess(tier: string): void {
  if (!hasVoiceAccess(tier)) {
    throw new AppError('Voice training requires Business plan or higher. Please upgrade your subscription.', 403);
  }
}

// ===========================================
// SUBSCRIPTION STATUS CHECKS
// ===========================================

// Check if subscription is active
export function isSubscriptionActive(status: string): boolean {
  return status === 'active' || status === 'trial';
}

// Check if trial is still valid
export function isTrialValid(trialEndsAt: Date | null): boolean {
  if (!trialEndsAt) return false;
  return new Date() < trialEndsAt;
}

// ===========================================
// USAGE SUMMARY
// ===========================================

// Get complete usage summary for a company
export async function getUsageSummary(companyId: string, tier: string): Promise<{
  users: { current: number; limit: number; percentage: number };
  industries: { current: number; limit: number; percentage: number };
  sessions: { current: number; limit: number; percentage: number };
  features: {
    apiAccess: boolean;
    voiceEnabled: boolean;
    prioritySupport: boolean;
    fullAnalytics: boolean;
    customBranding: boolean;
  };
}> {
  const limits = getTierLimits(tier);

  const [userCount, industryCount, sessionCount] = await Promise.all([
    getUserCount(companyId),
    getIndustryCount(companyId),
    getMonthlySessionCount(companyId)
  ]);

  const calcPercentage = (current: number, limit: number): number => {
    if (isUnlimited(limit)) return 0;
    return Math.round((current / limit) * 100);
  };

  return {
    users: {
      current: userCount,
      limit: limits.users,
      percentage: calcPercentage(userCount, limits.users)
    },
    industries: {
      current: industryCount,
      limit: limits.industries,
      percentage: calcPercentage(industryCount, limits.industries)
    },
    sessions: {
      current: sessionCount,
      limit: limits.sessionsPerMonth,
      percentage: calcPercentage(sessionCount, limits.sessionsPerMonth)
    },
    features: {
      apiAccess: hasApiAccess(tier),
      voiceEnabled: hasVoiceAccess(tier),
      prioritySupport: hasPrioritySupport(tier),
      fullAnalytics: hasFullAnalytics(tier),
      customBranding: hasCustomBranding(tier)
    }
  };
}

// ===========================================
// UPGRADE RECOMMENDATIONS
// ===========================================

// Get recommended upgrade tier based on usage
export function getUpgradeRecommendation(
  currentTier: string,
  usage: { users: number; industries: number; sessions: number }
): {
  recommendedTier: string | null;
  reasons: string[];
} {
  const limits = getTierLimits(currentTier);
  const reasons: string[] = [];

  // Already on enterprise
  if (currentTier === SUBSCRIPTION_TIERS.ENTERPRISE) {
    return { recommendedTier: null, reasons: [] };
  }

  // Check what limits are being approached
  if (!isUnlimited(limits.users) && usage.users >= limits.users * 0.8) {
    reasons.push('Approaching user limit');
  }
  if (!isUnlimited(limits.industries) && usage.industries >= limits.industries * 0.8) {
    reasons.push('Approaching industry limit');
  }
  if (!isUnlimited(limits.sessionsPerMonth) && usage.sessions >= limits.sessionsPerMonth * 0.8) {
    reasons.push('Approaching monthly session limit');
  }

  if (reasons.length === 0) {
    return { recommendedTier: null, reasons: [] };
  }

  // Recommend next tier up
  const tierOrder = [
    SUBSCRIPTION_TIERS.STARTER,
    SUBSCRIPTION_TIERS.PROFESSIONAL,
    SUBSCRIPTION_TIERS.BUSINESS,
    SUBSCRIPTION_TIERS.ENTERPRISE
  ];
  const currentIndex = tierOrder.indexOf(currentTier as SubscriptionTier);
  const recommendedTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;

  return { recommendedTier, reasons };
}

// Get pricing for a tier
export function getTierPricing(tier: string): { monthly: number; annual: number } {
  const validTier = tier as SubscriptionTier;
  return PRICING[validTier] || PRICING[SUBSCRIPTION_TIERS.STARTER];
}

// Log subscription-related events
export async function logSubscriptionEvent(
  companyId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>,
  ipAddress: string
): Promise<void> {
  logInfo(`Subscription event: ${action}`, { companyId, userId, ...details });
  logAudit('SUBSCRIPTION_CHANGE', {
    userId,
    entityType: 'Company',
    entityId: companyId,
    ipAddress,
    changes: { action, ...details }
  });
}
