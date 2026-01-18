import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database';
import { requireAuthOrToken } from '../../../middleware/auth';
import { loadTenant, getTenantId } from '../../../middleware/tenant';
import { requirePermission } from '../../../middleware/rbac';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuthOrToken);
router.use(loadTenant);

// GET all AI tools
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  const userCompanyId = req.user?.companyId;

  const where: any = {};

  if (!isSuperAdmin) {
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

  res.json(tools);
}));

// POST create AI tool
router.post('/', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const { name, functionName, description, parameters, companyId } = req.body;
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  const userCompanyId = req.user?.companyId;

  if (!name || !functionName) {
    res.status(400).json({ error: 'Name and function name are required' });
    return;
  }

  // Determine company ID
  let targetCompanyId = companyId;
  if (!isSuperAdmin) {
    targetCompanyId = userCompanyId || getTenantId(req);
  }

  if (!targetCompanyId) {
    res.status(400).json({ error: 'Company ID is required' });
    return;
  }

  const tool = await prisma.aITool.create({
    data: {
      name,
      functionName,
      description: description || null,
      parameters: parameters || null,
      companyId: targetCompanyId,
      isActive: true
    }
  });

  res.status(201).json(tool);
}));

// PUT update AI tool
router.put('/:id', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, functionName, description, parameters, isActive } = req.body;
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  const userCompanyId = req.user?.companyId;

  const existing = await prisma.aITool.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'AI tool not found' });
    return;
  }

  // Check permission - non-super admins can only edit their company's tools
  if (!isSuperAdmin && existing.companyId !== userCompanyId) {
    res.status(403).json({ error: 'You can only edit your own company\'s tools' });
    return;
  }

  const tool = await prisma.aITool.update({
    where: { id },
    data: {
      name: name || existing.name,
      functionName: functionName || existing.functionName,
      description: description !== undefined ? description : existing.description,
      parameters: parameters !== undefined ? parameters : existing.parameters,
      isActive: isActive !== undefined ? isActive : existing.isActive
    }
  });

  res.json(tool);
}));

// DELETE AI tool
router.delete('/:id', requirePermission('MANAGE_AI_CONFIG'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  const userCompanyId = req.user?.companyId;

  const existing = await prisma.aITool.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'AI tool not found' });
    return;
  }

  // Check permission
  if (!isSuperAdmin && existing.companyId !== userCompanyId) {
    res.status(403).json({ error: 'You can only delete your own company\'s tools' });
    return;
  }

  await prisma.aITool.delete({ where: { id } });
  res.json({ success: true });
}));

export default router;
