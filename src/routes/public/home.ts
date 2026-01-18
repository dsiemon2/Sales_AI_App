import { Router } from 'express';
import prisma from '../../config/database';
import { asyncHandler } from '../../middleware/errorHandler';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { INDUSTRIES, INDUSTRY_COLORS, PRICING, SUBSCRIPTION_TIERS, TIER_LIMITS } from '../../config/constants';
import { hasVoiceAccess, hasFullAnalytics, getUsageSummary } from '../../services/subscription.service';

const router = Router();

// Landing page
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  // Get active industries for the carousel
  const industries = await prisma.industry.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    take: 10
  });

  res.render('public/home', {
    title: 'AI Sales Training Platform',
    industries,
    pricing: {
      starter: { monthly: PRICING[SUBSCRIPTION_TIERS.STARTER].monthly / 100, annual: PRICING[SUBSCRIPTION_TIERS.STARTER].annual / 100 },
      professional: { monthly: PRICING[SUBSCRIPTION_TIERS.PROFESSIONAL].monthly / 100, annual: PRICING[SUBSCRIPTION_TIERS.PROFESSIONAL].annual / 100 },
      business: { monthly: PRICING[SUBSCRIPTION_TIERS.BUSINESS].monthly / 100, annual: PRICING[SUBSCRIPTION_TIERS.BUSINESS].annual / 100 }
    }
  });
}));

// Features page
router.get('/features', optionalAuth, asyncHandler(async (req, res) => {
  // Get all industries for the template showcase
  const industries = await prisma.industry.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  });

  res.render('public/features', {
    title: 'Features - AI Sales Training',
    industries
  });
}));

// Pricing page
router.get('/pricing', optionalAuth, asyncHandler(async (req, res) => {
  res.render('public/pricing', {
    title: 'Pricing - AI Sales Training',
    pricing: {
      starter: { monthly: PRICING[SUBSCRIPTION_TIERS.STARTER].monthly / 100, annual: PRICING[SUBSCRIPTION_TIERS.STARTER].annual / 100 },
      professional: { monthly: PRICING[SUBSCRIPTION_TIERS.PROFESSIONAL].monthly / 100, annual: PRICING[SUBSCRIPTION_TIERS.PROFESSIONAL].annual / 100 },
      business: { monthly: PRICING[SUBSCRIPTION_TIERS.BUSINESS].monthly / 100, annual: PRICING[SUBSCRIPTION_TIERS.BUSINESS].annual / 100 }
    }
  });
}));

// Demo page (public - no login required)
router.get('/demo', optionalAuth, asyncHandler(async (req, res) => {
  // Get industries for demo selector
  const industries = await prisma.industry.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  });

  res.render('public/demo', {
    title: 'Try Demo - AI Sales Training',
    industries
  });
}));

// Chat page (requires login - this is the main training interface)
router.get('/chat', requireAuth, asyncHandler(async (req, res) => {
  // Get user's company and industry info
  const user = req.user!;
  const tier = user.company?.subscriptionTier || SUBSCRIPTION_TIERS.STARTER;

  // Get company's industry for customized training
  let industry = null;
  if (user.company?.industryId) {
    industry = await prisma.industry.findUnique({
      where: { id: user.company.industryId }
    });
  }

  // Get AI configuration
  const aiConfig = user.companyId ? await prisma.aIConfig.findFirst({
    where: { companyId: user.companyId }
  }) : null;

  // Check subscription features
  const voiceEnabled = hasVoiceAccess(tier);
  const tierLimits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];

  // Get usage summary if user has a company
  const usageSummary = user.companyId ? await getUsageSummary(user.companyId, tier) : null;

  res.render('public/chat', {
    title: 'Sales Training - AI Chat',
    user,
    industry,
    aiConfig,
    greeting: aiConfig?.greeting || 'Hello! Ready to practice your sales skills?',
    voiceEnabled,
    subscriptionTier: tier,
    tierLimits,
    usageSummary
  });
}));

// Industry-specific landing pages
router.get('/industries/:code', optionalAuth, asyncHandler(async (req, res) => {
  const { code } = req.params;

  const industry = await prisma.industry.findUnique({
    where: { code }
  });

  if (!industry) {
    return res.status(404).render('error', {
      title: 'Industry Not Found',
      message: 'The requested industry page was not found.',
      statusCode: 404
    });
  }

  const colors = INDUSTRY_COLORS[code as keyof typeof INDUSTRY_COLORS] || INDUSTRY_COLORS.pen;

  res.render('public/industries/template', {
    title: `${industry.name} - AI Sales Training`,
    industry,
    colors
  });
}));

// About page
router.get('/about', optionalAuth, (req, res) => {
  res.render('public/about', {
    title: 'About Us - AI Sales Training'
  });
});

// Contact page
router.get('/contact', optionalAuth, (req, res) => {
  res.render('public/contact', {
    title: 'Contact Us - AI Sales Training'
  });
});

// Terms of Service
router.get('/terms', (req, res) => {
  res.render('public/terms', {
    title: 'Terms of Service'
  });
});

// Privacy Policy
router.get('/privacy', (req, res) => {
  res.render('public/privacy', {
    title: 'Privacy Policy'
  });
});

export default router;
