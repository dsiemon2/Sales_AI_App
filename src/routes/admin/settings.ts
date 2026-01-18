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

// Settings page
router.get('/', requirePermission('VIEW_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  // Load site info (platform-level)
  const siteInfo = await prisma.siteInfo.findUnique({ where: { id: 'default' } });

  // Load email settings
  const emailSettings = await prisma.emailSettings.findUnique({ where: { id: 'default' } });

  // Load security settings
  const securitySettings = await prisma.securitySettings.findUnique({ where: { id: 'default' } });

  // Load notification settings
  const notificationSettings = await prisma.notificationSettings.findUnique({ where: { id: 'default' } });

  // Load industries and their brandings for SUPER_ADMIN
  let industries: any[] = [];
  let brandings: any[] = [];

  if (isSuperAdmin) {
    industries = await prisma.industry.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    brandings = await prisma.industryBranding.findMany();
  }

  res.render('admin/settings/index', {
    title: 'Settings',
    siteInfo,
    emailSettings,
    securitySettings,
    notificationSettings,
    industries,
    brandings,
    isSuperAdmin,
    user: req.user
  });
}));

// Update site info (SUPER_ADMIN only)
router.put('/site-info', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { siteName, tagline, description, supportEmail, supportPhone, websiteUrl, timezone, address } = req.body;

  await prisma.siteInfo.upsert({
    where: { id: 'default' },
    update: { siteName, tagline, description, supportEmail, supportPhone, websiteUrl, timezone, address },
    create: { id: 'default', siteName, tagline, description, supportEmail, supportPhone, websiteUrl, timezone, address }
  });

  logger.info('Site info updated', { userId: req.user?.id });
  res.json({ success: true });
}));

// Update industry branding (SUPER_ADMIN only)
router.put('/branding', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { industryId, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headingFont, bodyFont, customCss } = req.body;

  if (!industryId) {
    res.status(400).json({ error: 'Industry ID required' });
    return;
  }

  await prisma.industryBranding.upsert({
    where: { industryId },
    update: { logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headingFont, bodyFont, customCss },
    create: { industryId, logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headingFont, bodyFont, customCss }
  });

  logger.info('Industry branding updated', { userId: req.user?.id, industryId });
  res.json({ success: true });
}));

// Update email settings (SUPER_ADMIN only)
router.put('/email', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const {
    smtpHost, smtpPort, smtpEncryption, smtpUsername, smtpPassword,
    fromEmail, fromName,
    welcomeEmailEnabled, passwordResetEnabled, sessionSummaryEnabled, weeklyReportEnabled
  } = req.body;

  const updateData: any = {
    smtpHost,
    smtpPort: smtpPort ? parseInt(smtpPort) : 587,
    smtpEncryption,
    smtpUsername,
    fromEmail,
    fromName,
    welcomeEmailEnabled: welcomeEmailEnabled === true || welcomeEmailEnabled === 'true',
    passwordResetEnabled: passwordResetEnabled === true || passwordResetEnabled === 'true',
    sessionSummaryEnabled: sessionSummaryEnabled === true || sessionSummaryEnabled === 'true',
    weeklyReportEnabled: weeklyReportEnabled === true || weeklyReportEnabled === 'true'
  };

  // Only update password if provided
  if (smtpPassword && smtpPassword.trim()) {
    updateData.smtpPassword = smtpPassword;
  }

  await prisma.emailSettings.upsert({
    where: { id: 'default' },
    update: updateData,
    create: { id: 'default', ...updateData }
  });

  logger.info('Email settings updated', { userId: req.user?.id });
  res.json({ success: true });
}));

// Update security settings (SUPER_ADMIN only)
router.put('/security', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const {
    twoFactorEnabled, oauthEnabled, sessionTimeout, maxLoginAttempts,
    minPasswordLength, passwordExpiryDays, requireUppercase, requireNumber, requireSpecialChar,
    ipWhitelistEnabled, allowedIps
  } = req.body;

  await prisma.securitySettings.upsert({
    where: { id: 'default' },
    update: {
      twoFactorEnabled: twoFactorEnabled === true || twoFactorEnabled === 'true',
      oauthEnabled: oauthEnabled === true || oauthEnabled === 'true',
      sessionTimeout: sessionTimeout ? parseInt(sessionTimeout) : 30,
      maxLoginAttempts: maxLoginAttempts ? parseInt(maxLoginAttempts) : 5,
      minPasswordLength: minPasswordLength ? parseInt(minPasswordLength) : 8,
      passwordExpiryDays: passwordExpiryDays ? parseInt(passwordExpiryDays) : 0,
      requireUppercase: requireUppercase === true || requireUppercase === 'true',
      requireNumber: requireNumber === true || requireNumber === 'true',
      requireSpecialChar: requireSpecialChar === true || requireSpecialChar === 'true',
      ipWhitelistEnabled: ipWhitelistEnabled === true || ipWhitelistEnabled === 'true',
      allowedIps: allowedIps || ''
    },
    create: {
      id: 'default',
      twoFactorEnabled: twoFactorEnabled === true || twoFactorEnabled === 'true',
      oauthEnabled: oauthEnabled === true || oauthEnabled === 'true',
      sessionTimeout: sessionTimeout ? parseInt(sessionTimeout) : 30,
      maxLoginAttempts: maxLoginAttempts ? parseInt(maxLoginAttempts) : 5,
      minPasswordLength: minPasswordLength ? parseInt(minPasswordLength) : 8,
      passwordExpiryDays: passwordExpiryDays ? parseInt(passwordExpiryDays) : 0,
      requireUppercase: requireUppercase === true || requireUppercase === 'true',
      requireNumber: requireNumber === true || requireNumber === 'true',
      requireSpecialChar: requireSpecialChar === true || requireSpecialChar === 'true',
      ipWhitelistEnabled: ipWhitelistEnabled === true || ipWhitelistEnabled === 'true',
      allowedIps: allowedIps || ''
    }
  });

  logger.info('Security settings updated', { userId: req.user?.id });
  res.json({ success: true });
}));

// Update notification settings (SUPER_ADMIN only)
router.put('/notifications', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const settings: any = {};

  // Convert all checkbox values to booleans
  const booleanFields = [
    'emailNotifications', 'smsNotifications', 'pushNotifications',
    'notifyNewUser', 'notifyNewCompany', 'notifyPayment', 'notifyError',
    'notifySessionComplete', 'notifyAchievement', 'notifyWeeklyReport', 'notifyReminder'
  ];

  booleanFields.forEach(field => {
    if (req.body[field] !== undefined) {
      settings[field] = req.body[field] === true || req.body[field] === 'true';
    }
  });

  await prisma.notificationSettings.upsert({
    where: { id: 'default' },
    update: settings,
    create: { id: 'default', ...settings }
  });

  logger.info('Notification settings updated', { userId: req.user?.id });
  res.json({ success: true });
}));

// Test email
router.post('/test-email', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email address required' });
    return;
  }

  // For now, just log and return success
  // In production, this would send an actual test email
  logger.info('Test email requested', { userId: req.user?.id, targetEmail: email });
  res.json({ success: true, message: 'Test email would be sent to ' + email });
}));

// Get languages
router.get('/languages', requirePermission('VIEW_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const languages = await prisma.language.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(languages);
}));

export default router;
