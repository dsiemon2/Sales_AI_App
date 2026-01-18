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

// AI Config page
router.get('/', requirePermission('VIEW_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  // For SUPER_ADMIN without company context, show all or empty state
  const configWhere = companyId ? { companyId } : undefined;
  const listWhere = companyId ? { companyId } : {};

  const [aiConfig, aiAgents, aiTools, appConfig] = await Promise.all([
    configWhere ? prisma.aIConfig.findUnique({ where: configWhere }) : null,
    prisma.aIAgent.findMany({ where: listWhere, orderBy: { name: 'asc' } }),
    prisma.aITool.findMany({ where: listWhere, orderBy: { name: 'asc' } }),
    configWhere ? prisma.appConfig.findUnique({ where: configWhere }) : null
  ]);

  res.render('admin/ai-config/index', {
    title: 'AI Configuration',
    aiConfig,
    aiAgents,
    aiTools,
    appConfig,
    user: req.user
  });
}));

// Update AI config
router.put('/config', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const {
    model, temperature, maxTokens, topP,
    systemPrompt, greeting, voiceId, language, responseStyle, verbosity
  } = req.body;

  if (!companyId) {
    res.status(400).json({ error: 'Company context required to update AI config' });
    return;
  }

  await prisma.aIConfig.upsert({
    where: { companyId },
    update: {
      model,
      temperature: parseFloat(temperature) || 0.7,
      maxTokens: parseInt(maxTokens) || 1000,
      topP: parseFloat(topP) || 1.0,
      systemPrompt,
      greeting,
      voiceId,
      language,
      responseStyle,
      verbosity
    },
    create: {
      companyId,
      model: model || 'gpt-4',
      temperature: parseFloat(temperature) || 0.7,
      maxTokens: parseInt(maxTokens) || 1000,
      topP: parseFloat(topP) || 1.0,
      systemPrompt: systemPrompt || '',
      greeting: greeting || '',
      voiceId: voiceId || 'alloy',
      language: language || 'en',
      responseStyle: responseStyle || 'professional',
      verbosity: verbosity || 'balanced'
    }
  });

  logger.info('AI config updated', { userId: req.user?.id, companyId });
  res.json({ success: true });
}));

// AI Agents CRUD
router.post('/agents', requirePermission('MANAGE_AI_AGENTS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, description, type, persona, instructions, isDefault } = req.body;

  if (!companyId) {
    res.status(400).json({ error: 'Company context required to create AI agent' });
    return;
  }

  const agent = await prisma.aIAgent.create({
    data: {
      companyId,
      name,
      description,
      type: type || 'sales',
      persona,
      instructions,
      isActive: true,
      isDefault: isDefault === true || isDefault === 'on'
    }
  });

  logger.info(`AI Agent created: ${name}`, { userId: req.user?.id, agentId: agent.id });
  res.json({ success: true, agent });
}));

router.put('/agents/:id', requirePermission('MANAGE_AI_AGENTS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, description, type, persona, instructions, isActive, isDefault } = req.body;

  const agentWhere: any = { id: req.params.id };
  if (companyId) agentWhere.companyId = companyId;
  const agent = await prisma.aIAgent.findFirst({
    where: agentWhere
  });

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  await prisma.aIAgent.update({
    where: { id: req.params.id },
    data: {
      name,
      description,
      type,
      persona,
      instructions,
      isActive: isActive === true || isActive === 'on',
      isDefault: isDefault === true || isDefault === 'on'
    }
  });

  logger.info(`AI Agent updated: ${name}`, { userId: req.user?.id, agentId: req.params.id });
  res.json({ success: true });
}));

router.delete('/agents/:id', requirePermission('MANAGE_AI_AGENTS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  const agentWhere: any = { id: req.params.id };
  if (companyId) agentWhere.companyId = companyId;
  const agent = await prisma.aIAgent.findFirst({
    where: agentWhere
  });

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  await prisma.aIAgent.delete({ where: { id: req.params.id } });
  logger.info(`AI Agent deleted: ${agent.name}`, { userId: req.user?.id });
  res.json({ success: true });
}));

// AI Tools CRUD
router.post('/tools', requirePermission('MANAGE_AI_TOOLS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, description, functionName, parameters } = req.body;

  if (!companyId) {
    res.status(400).json({ error: 'Company context required to create AI tool' });
    return;
  }

  const tool = await prisma.aITool.create({
    data: {
      companyId,
      name,
      description,
      functionName,
      parameters: parameters ? (typeof parameters === 'string' ? JSON.parse(parameters) : parameters) : {},
      isActive: true
    }
  });

  logger.info(`AI Tool created: ${name}`, { userId: req.user?.id, toolId: tool.id });
  res.json({ success: true, tool });
}));

router.put('/tools/:id', requirePermission('MANAGE_AI_TOOLS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, description, functionName, parameters, isActive } = req.body;

  const toolWhere: any = { id: req.params.id };
  if (companyId) toolWhere.companyId = companyId;
  const tool = await prisma.aITool.findFirst({
    where: toolWhere
  });

  if (!tool) {
    res.status(404).json({ error: 'Tool not found' });
    return;
  }

  await prisma.aITool.update({
    where: { id: req.params.id },
    data: {
      name,
      description,
      functionName,
      parameters: parameters ? (typeof parameters === 'string' ? JSON.parse(parameters) : parameters) : {},
      isActive: isActive === true || isActive === 'on'
    }
  });

  logger.info(`AI Tool updated: ${name}`, { userId: req.user?.id, toolId: req.params.id });
  res.json({ success: true });
}));

router.delete('/tools/:id', requirePermission('MANAGE_AI_TOOLS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);

  const toolWhere: any = { id: req.params.id };
  if (companyId) toolWhere.companyId = companyId;
  const tool = await prisma.aITool.findFirst({
    where: toolWhere
  });

  if (!tool) {
    res.status(404).json({ error: 'Tool not found' });
    return;
  }

  await prisma.aITool.delete({ where: { id: req.params.id } });
  logger.info(`AI Tool deleted: ${tool.name}`, { userId: req.user?.id });
  res.json({ success: true });
}));

export default router;
