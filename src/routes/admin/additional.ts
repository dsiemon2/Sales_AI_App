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

// Greeting page - GET
router.get('/greeting', requirePermission('VIEW_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  let aiConfig = null;
  if (companyId) {
    aiConfig = await prisma.aIConfig.findUnique({
      where: { companyId }
    });
  }

  res.render('admin/greeting/index', {
    title: 'Greeting Configuration',
    active: 'greeting',
    aiConfig
  });
}));

// Greeting page - POST (save)
router.post('/greeting', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  if (!companyId) {
    res.status(400).json({ error: 'No company selected' });
    return;
  }
  const { greeting, systemPrompt, voiceId, language, responseStyle, verbosity } = req.body;

  const aiConfig = await prisma.aIConfig.upsert({
    where: { companyId },
    create: {
      companyId,
      greeting: greeting || '',
      systemPrompt: systemPrompt || '',
      voiceId: voiceId || 'alloy',
      language: language || 'en',
      responseStyle: responseStyle || 'professional',
      verbosity: verbosity || 'balanced'
    },
    update: {
      greeting,
      systemPrompt,
      voiceId,
      language,
      responseStyle,
      verbosity
    }
  });

  if (req.accepts('json')) {
    res.json({ success: true, aiConfig });
    return;
  }
  res.redirect(res.locals.basePath + '/admin/greeting?saved=true');
}));

// Voices page
router.get('/voices', requirePermission('VIEW_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const languages = await prisma.language.findMany({ orderBy: { name: 'asc' } });
  res.render('admin/voices/index', {
    title: 'Voices & Languages',
    active: 'voices',
    languages,
    tenant: req.tenant
  });
}));

// Knowledge Base - List all articles
router.get('/knowledge-base', requirePermission('VIEW_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const category = req.query.category as string;
  const search = req.query.search as string;

  let articles: any[] = [];
  let categories: string[] = [];

  if (companyId) {
    const where: Record<string, unknown> = { companyId };
    if (category && category !== 'all') {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    articles = await prisma.knowledgeArticle.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }]
    });

    // Get unique categories
    const allArticles = await prisma.knowledgeArticle.findMany({
      where: { companyId },
      select: { category: true },
      distinct: ['category']
    });
    categories = allArticles.map(a => a.category);
  }

  res.render('admin/knowledge-base/index', {
    title: 'Knowledge Base',
    active: 'knowledge-base',
    articles,
    categories,
    filters: { category, search }
  });
}));

// Knowledge Base - Create article
router.post('/knowledge-base', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  if (!companyId) {
    res.status(400).json({ error: 'No company selected' });
    return;
  }
  const { title, content, category, tags, isActive, sortOrder } = req.body;

  const article = await prisma.knowledgeArticle.create({
    data: {
      companyId,
      title,
      content,
      category: category || 'general',
      tags: tags ? JSON.parse(tags) : [],
      isActive: isActive === 'on' || isActive === true,
      sortOrder: parseInt(sortOrder) || 0
    }
  });

  if (req.accepts('json')) {
    res.json({ success: true, article });
    return;
  }
  res.redirect(res.locals.basePath + '/admin/knowledge-base');
}));

// Knowledge Base - Edit page
router.get('/knowledge-base/:id/edit', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { id } = req.params;

  const where: Record<string, unknown> = { id };
  if (companyId) {
    where.companyId = companyId;
  }

  const article = await prisma.knowledgeArticle.findFirst({ where });

  if (!article) {
    res.status(404).render('error', {
      title: 'Not Found',
      message: 'Article not found',
      statusCode: 404
    });
    return;
  }

  // Get unique categories
  let categories: string[] = [];
  if (companyId) {
    const allArticles = await prisma.knowledgeArticle.findMany({
      where: { companyId },
      select: { category: true },
      distinct: ['category']
    });
    categories = allArticles.map(a => a.category);
  }

  res.render('admin/knowledge-base/edit', {
    title: 'Edit Article',
    active: 'knowledge-base',
    article,
    categories
  });
}));

// Knowledge Base - Update article
router.put('/knowledge-base/:id', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { id } = req.params;
  const { title, content, category, tags, isActive, sortOrder } = req.body;

  const where: Record<string, unknown> = { id };
  if (companyId) {
    where.companyId = companyId;
  }

  const existing = await prisma.knowledgeArticle.findFirst({ where });

  if (!existing) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }

  const article = await prisma.knowledgeArticle.update({
    where: { id },
    data: {
      title,
      content,
      category: category || 'general',
      tags: tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [],
      isActive: isActive === 'on' || isActive === true,
      sortOrder: parseInt(sortOrder) || 0
    }
  });

  if (req.accepts('json')) {
    res.json({ success: true, article });
    return;
  }
  res.redirect(res.locals.basePath + '/admin/knowledge-base');
}));

// Knowledge Base - Delete article
router.delete('/knowledge-base/:id', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { id } = req.params;

  const where: Record<string, unknown> = { id };
  if (companyId) {
    where.companyId = companyId;
  }

  const existing = await prisma.knowledgeArticle.findFirst({ where });

  if (!existing) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }

  await prisma.knowledgeArticle.delete({ where: { id } });

  res.json({ success: true });
}));

// Knowledge Base - Toggle active status
router.patch('/knowledge-base/:id/toggle', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { id } = req.params;

  const where: Record<string, unknown> = { id };
  if (companyId) {
    where.companyId = companyId;
  }

  const article = await prisma.knowledgeArticle.findFirst({ where });

  if (!article) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }

  const updated = await prisma.knowledgeArticle.update({
    where: { id },
    data: { isActive: !article.isActive }
  });

  res.json({ success: true, isActive: updated.isActive });
}));

// AI Tools page
router.get('/ai-tools', requirePermission('VIEW_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  const userCompanyId = req.user?.companyId;

  const industryId = req.query.industryId as string;
  const filterCompanyId = req.query.companyId as string;

  // Build where clause
  const where: any = {};

  if (isSuperAdmin) {
    if (filterCompanyId) {
      where.companyId = filterCompanyId;
    } else if (industryId) {
      const companiesInIndustry = await prisma.company.findMany({
        where: { industryId },
        select: { id: true }
      });
      if (companiesInIndustry.length > 0) {
        where.companyId = { in: companiesInIndustry.map(c => c.id) };
      }
    }
  } else {
    if (userCompanyId) {
      where.companyId = userCompanyId;
    } else {
      const tenantId = getTenantId(req);
      if (tenantId) where.companyId = tenantId;
    }
  }

  const tools = await prisma.aITool.findMany({
    where,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          industry: { select: { id: true, name: true, code: true } }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  // Get industries and companies for filter dropdowns (SUPER_ADMIN only)
  let industries: any[] = [];
  let companies: any[] = [];

  if (isSuperAdmin) {
    industries = await prisma.industry.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    const companiesWhere: any = { isActive: true };
    if (industryId) companiesWhere.industryId = industryId;

    companies = await prisma.company.findMany({
      where: companiesWhere,
      include: { industry: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' }
    });
  }

  res.render('admin/ai-tools/index', {
    title: 'AI Tools',
    active: 'ai-tools',
    tools,
    industries,
    companies,
    isSuperAdmin,
    filters: { industryId, companyId: filterCompanyId },
    user: req.user,
    tenant: req.tenant
  });
}));

// AI Agents page
router.get('/ai-agents', requirePermission('VIEW_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  const userCompanyId = req.user?.companyId;

  const industryId = req.query.industryId as string;
  const filterCompanyId = req.query.companyId as string;

  // Build where clause
  const where: any = {};

  if (isSuperAdmin) {
    if (filterCompanyId) {
      where.companyId = filterCompanyId;
    } else if (industryId) {
      const companiesInIndustry = await prisma.company.findMany({
        where: { industryId },
        select: { id: true }
      });
      if (companiesInIndustry.length > 0) {
        where.companyId = { in: companiesInIndustry.map(c => c.id) };
      }
    }
  } else {
    if (userCompanyId) {
      where.companyId = userCompanyId;
    } else {
      const tenantId = getTenantId(req);
      if (tenantId) where.companyId = tenantId;
    }
  }

  const agents = await prisma.aIAgent.findMany({
    where,
    include: {
      company: {
        select: {
          id: true,
          name: true,
          industry: { select: { id: true, name: true, code: true } }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  // Get industries and companies for filter dropdowns (SUPER_ADMIN only)
  let industries: any[] = [];
  let companies: any[] = [];

  if (isSuperAdmin) {
    industries = await prisma.industry.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    const companiesWhere: any = { isActive: true };
    if (industryId) companiesWhere.industryId = industryId;

    companies = await prisma.company.findMany({
      where: companiesWhere,
      include: { industry: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'asc' }
    });
  }

  res.render('admin/ai-agents/index', {
    title: 'AI Agents',
    active: 'ai-agents',
    agents,
    industries,
    companies,
    isSuperAdmin,
    filters: { industryId, companyId: filterCompanyId },
    user: req.user,
    tenant: req.tenant
  });
}));

// Logic Rules page
router.get('/logic-rules', requirePermission('VIEW_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  res.render('admin/logic-rules/index', {
    title: 'Logic Rules',
    active: 'logic-rules'
  });
}));

// Functions page
router.get('/functions', requirePermission('VIEW_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  res.render('admin/functions/index', {
    title: 'Functions',
    active: 'functions'
  });
}));

// SMS Settings page
router.get('/sms-settings', requirePermission('VIEW_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  let smsSettings = null;
  if (companyId) {
    smsSettings = await prisma.smsSettings.findUnique({
      where: { companyId }
    });
  }

  // Check if env variables are configured
  const envConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );

  res.render('admin/sms-settings/index', {
    title: 'SMS Settings',
    active: 'sms-settings',
    smsSettings,
    envConfigured
  });
}));

// Save SMS settings
router.post('/sms-settings', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  if (!companyId) {
    res.status(400).json({ error: 'Company ID required' });
    return;
  }

  const {
    provider,
    fromNumber,
    accountSid,
    authToken,
    welcomeTemplate,
    completeTemplate,
    followupTemplate,
    autoWelcome,
    autoComplete,
    autoFollowup
  } = req.body;

  const settings = await prisma.smsSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      provider: provider || 'twilio',
      fromNumber,
      accountSid,
      authToken,
      welcomeTemplate,
      completeTemplate,
      followupTemplate,
      autoWelcome: autoWelcome === true || autoWelcome === 'true',
      autoComplete: autoComplete === true || autoComplete === 'true',
      autoFollowup: autoFollowup === true || autoFollowup === 'true'
    },
    update: {
      provider: provider || 'twilio',
      fromNumber,
      accountSid,
      authToken,
      welcomeTemplate,
      completeTemplate,
      followupTemplate,
      autoWelcome: autoWelcome === true || autoWelcome === 'true',
      autoComplete: autoComplete === true || autoComplete === 'true',
      autoFollowup: autoFollowup === true || autoFollowup === 'true'
    }
  });

  res.json({ success: true, settings });
}));

// Test SMS configuration
router.post('/sms-settings/test', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  if (!companyId) {
    res.status(400).json({ error: 'Company ID required' });
    return;
  }

  const { testNumber } = req.body;
  if (!testNumber) {
    res.status(400).json({ error: 'Test phone number required' });
    return;
  }

  const { testSmsConfig } = await import('../services/sms.service');
  const result = await testSmsConfig(companyId, testNumber);

  res.json(result);
}));

// Webhooks page - list all webhooks
router.get('/webhooks', requirePermission('VIEW_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  let webhooks: any[] = [];
  if (companyId) {
    webhooks = await prisma.webhook.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  res.render('admin/webhooks/index', {
    title: 'Webhooks',
    active: 'webhooks',
    webhooks,
    eventTypes: [
      'session.started', 'session.completed', 'session.abandoned',
      'user.created', 'user.updated', 'user.deleted', 'user.login',
      'payment.received', 'payment.failed',
      'subscription.created', 'subscription.updated', 'subscription.cancelled',
      'company.created', 'company.updated',
      'training.milestone', 'certification.earned'
    ]
  });
}));

// Create webhook
router.post('/webhooks', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  if (!companyId) {
    res.status(400).json({ error: 'Company ID required' });
    return;
  }

  const { name, url, events, secret, headers } = req.body;

  const webhook = await prisma.webhook.create({
    data: {
      companyId,
      name,
      url,
      events: typeof events === 'string' ? JSON.parse(events) : events,
      secret: secret || null,
      headers: headers ? (typeof headers === 'string' ? JSON.parse(headers) : headers) : {},
      isActive: true
    }
  });

  res.json({ success: true, webhook });
}));

// Update webhook
router.put('/webhooks/:id', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, url, events, secret, headers, isActive } = req.body;

  const webhook = await prisma.webhook.update({
    where: { id },
    data: {
      name,
      url,
      events: typeof events === 'string' ? JSON.parse(events) : events,
      secret: secret || null,
      headers: headers ? (typeof headers === 'string' ? JSON.parse(headers) : headers) : {},
      isActive: isActive !== false
    }
  });

  res.json({ success: true, webhook });
}));

// Delete webhook
router.delete('/webhooks/:id', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.webhook.delete({ where: { id } });

  res.json({ success: true });
}));

// Test webhook
router.post('/webhooks/:id/test', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { testWebhook } = await import('../services/webhook-dispatcher.service');

  const result = await testWebhook(id);

  res.json(result);
}));

// Get webhook deliveries
router.get('/webhooks/:id/deliveries', requirePermission('VIEW_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit = '20', offset = '0' } = req.query;

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId: id },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string),
    skip: parseInt(offset as string)
  });

  const total = await prisma.webhookDelivery.count({ where: { webhookId: id } });

  res.json({ deliveries, total });
}));

// MS Teams page
router.get('/ms-teams', requirePermission('VIEW_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  res.render('admin/ms-teams/index', {
    title: 'MS Teams Integration',
    active: 'ms-teams'
  });
}));

// Payment Configurations page - Gateway setup (Stripe, PayPal, Square, etc.)
router.get('/payment-configurations', requirePermission('VIEW_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  // Get payment settings for the company
  let paymentSettings = null;
  if (companyId) {
    paymentSettings = await prisma.companyPaymentSettings.findUnique({
      where: { companyId }
    });
  }

  res.render('admin/payment-configurations/index', {
    title: 'Payment Gateway Configuration',
    active: 'payment-configurations',
    paymentSettings
  });
}));

// Save payment configuration for a specific provider
router.post('/payment-configurations/save', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  if (!companyId) {
    res.status(400).json({ error: 'Company context required' });
    return;
  }

  const { provider, publicKey, secretKey, merchantId, webhookSecret, testMode, achEnabled } = req.body;

  if (!provider || !publicKey) {
    res.status(400).json({ error: 'Provider and public key are required' });
    return;
  }

  // Build the update object based on provider
  const updateData: Record<string, unknown> = {};

  switch (provider) {
    case 'stripe':
      updateData.stripePublishableKey = publicKey;
      if (secretKey) updateData.stripeSecretKey = secretKey;
      if (webhookSecret) updateData.stripeWebhookSecret = webhookSecret;
      updateData.stripeAchEnabled = achEnabled === true;
      updateData.stripeTestMode = testMode !== false;
      break;
    case 'braintree':
      updateData.braintreePublicKey = publicKey;
      if (secretKey) updateData.braintreePrivateKey = secretKey;
      if (merchantId) updateData.braintreeMerchantId = merchantId;
      updateData.braintreeTestMode = testMode !== false;
      break;
    case 'square':
      updateData.squareApplicationId = publicKey;
      if (secretKey) updateData.squareAccessToken = secretKey;
      if (merchantId) updateData.squareLocationId = merchantId;
      updateData.squareTestMode = testMode !== false;
      break;
    case 'authorize':
      updateData.authorizeApiLoginId = publicKey;
      if (secretKey) updateData.authorizeTransactionKey = secretKey;
      updateData.authorizeTestMode = testMode !== false;
      break;
    default:
      res.status(400).json({ error: 'Invalid provider' });
      return;
  }

  await prisma.companyPaymentSettings.upsert({
    where: { companyId },
    update: updateData,
    create: {
      companyId,
      ...updateData
    }
  });

  res.json({ success: true });
}));

// Test payment provider connection
router.post('/payment-configurations/test', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  if (!companyId) {
    res.status(400).json({ error: 'Company context required' });
    return;
  }

  const { provider } = req.body;

  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  if (!settings) {
    res.status(400).json({ success: false, error: 'No payment settings configured' });
    return;
  }

  // Simple validation test (in production, would make API call)
  let hasKeys = false;
  switch (provider) {
    case 'stripe':
      hasKeys = !!(settings.stripePublishableKey && settings.stripeSecretKey);
      break;
    case 'braintree':
      hasKeys = !!(settings.braintreePublicKey && settings.braintreePrivateKey && settings.braintreeMerchantId);
      break;
    case 'square':
      hasKeys = !!(settings.squareApplicationId && settings.squareAccessToken);
      break;
    case 'authorize':
      hasKeys = !!(settings.authorizeApiLoginId && settings.authorizeTransactionKey);
      break;
  }

  if (hasKeys) {
    res.json({ success: true, message: 'Connection test successful!' });
  } else {
    res.json({ success: false, error: 'Missing required API keys' });
  }
}));

// Enable a payment provider (disables others)
router.post('/payment-configurations/enable', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  if (!companyId) {
    res.status(400).json({ error: 'Company context required' });
    return;
  }

  const { provider } = req.body;

  // Disable all providers first, then enable the selected one
  const updateData: Record<string, unknown> = {
    enabled: true,
    stripeEnabled: false,
    braintreeEnabled: false,
    squareEnabled: false,
    authorizeEnabled: false
  };

  switch (provider) {
    case 'stripe':
      updateData.stripeEnabled = true;
      break;
    case 'braintree':
      updateData.braintreeEnabled = true;
      break;
    case 'square':
      updateData.squareEnabled = true;
      break;
    case 'authorize':
      updateData.authorizeEnabled = true;
      break;
    default:
      res.status(400).json({ error: 'Invalid provider' });
      return;
  }

  await prisma.companyPaymentSettings.update({
    where: { companyId },
    data: updateData
  });

  res.json({ success: true });
}));

// Disable a payment provider
router.post('/payment-configurations/disable', requirePermission('MANAGE_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  if (!companyId) {
    res.status(400).json({ error: 'Company context required' });
    return;
  }

  const { provider } = req.body;

  const updateData: Record<string, unknown> = { enabled: false };

  switch (provider) {
    case 'stripe':
      updateData.stripeEnabled = false;
      break;
    case 'braintree':
      updateData.braintreeEnabled = false;
      break;
    case 'square':
      updateData.squareEnabled = false;
      break;
    case 'authorize':
      updateData.authorizeEnabled = false;
      break;
    default:
      res.status(400).json({ error: 'Invalid provider' });
      return;
  }

  await prisma.companyPaymentSettings.update({
    where: { companyId },
    data: updateData
  });

  res.json({ success: true });
}));

// Payments/Transactions page - View payment history
router.get('/payments', requirePermission('VIEW_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const type = req.query.type as string;

  // Build where clause
  const where: any = {};
  if (companyId && !isSuperAdmin) where.companyId = companyId;
  if (status) where.status = status;
  if (type) where.type = type;

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.transaction.count({ where })
  ]);

  // Calculate totals
  const totals = await prisma.transaction.aggregate({
    where: { ...where, status: 'succeeded' },
    _sum: { amount: true },
    _count: true
  });

  res.render('admin/payments/index', {
    title: 'Payment Transactions',
    active: 'payments',
    transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    filters: { status, type },
    totals: {
      amount: totals._sum.amount || 0,
      count: totals._count || 0
    },
    isSuperAdmin
  });
}));

// Companies page (SUPER_ADMIN only)
router.get('/companies', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const companies = await prisma.company.findMany({
    include: { industry: true, _count: { select: { users: true } } },
    orderBy: { name: 'asc' }
  });
  res.render('admin/companies/index', {
    title: 'Companies',
    active: 'companies',
    companies
  });
}));

// Industries page (SUPER_ADMIN only)
router.get('/industries', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const industries = await prisma.industry.findMany({
    include: { _count: { select: { companies: true } } },
    orderBy: { sortOrder: 'asc' }
  });
  res.render('admin/industries/index', {
    title: 'Industries',
    active: 'industries',
    industries
  });
}));

// Features page
router.get('/features', requirePermission('VIEW_SETTINGS'), asyncHandler(async (req: Request, res: Response) => {
  // Load platform features from database, create default if not exists
  let features = await prisma.platformFeatures.findUnique({
    where: { id: 'default' }
  });

  if (!features) {
    features = await prisma.platformFeatures.create({
      data: { id: 'default' }
    });
  }

  res.render('admin/features/index', {
    title: 'Features',
    active: 'features',
    features,
    user: req.user
  });
}));

// Audit Logs page (SUPER_ADMIN only)
router.get('/audit-logs', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, firstName: true, lastName: true } } }
  });
  res.render('admin/audit-logs/index', {
    title: 'Audit Logs',
    active: 'audit-logs',
    logs
  });
}));

// Announcements page (SUPER_ADMIN only)
router.get('/announcements', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const industryId = req.query.industryId as string;

  // Build where clause
  const where: any = {};
  if (industryId && industryId !== 'all') {
    where.industryId = industryId;
  }

  const announcements = await prisma.announcement.findMany({
    where,
    include: {
      industry: { select: { id: true, name: true, code: true } }
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  });

  const industries = await prisma.industry.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  });

  // Default global settings for announcements
  const globalSettings = {
    rotationSpeed: 5000,
    animationStyle: 'fade',
    allowDismissGlobal: true
  };

  res.render('admin/announcements/index', {
    title: 'Announcements',
    active: 'announcements',
    announcements,
    industries,
    filters: { industryId },
    globalSettings,
    user: req.user
  });
}));

// Banners page (SUPER_ADMIN only)
router.get('/banners', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const industryId = req.query.industryId as string;

  // Build where clause
  const where: any = {};
  if (industryId && industryId !== 'all') {
    where.industryId = industryId;
  }

  const banners = await prisma.banner.findMany({
    where,
    include: {
      industry: { select: { id: true, name: true, code: true } }
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  });

  const industries = await prisma.industry.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  });

  // Default carousel settings for banners
  const carouselSettings = {
    autoPlay: true,
    interval: 5000,
    transition: 'fade',
    showIndicators: true,
    showControls: true
  };

  res.render('admin/banners/index', {
    title: 'Banners',
    active: 'banners',
    banners,
    industries,
    filters: { industryId },
    carouselSettings,
    user: req.user
  });
}));

export default router;
