import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database';
import { requireAuthOrToken } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/rbac';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuthOrToken);

// GET all industries
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const industries = await prisma.industry.findMany({
    include: { _count: { select: { companies: true } } },
    orderBy: { sortOrder: 'asc' }
  });
  res.json(industries);
}));

// GET single industry
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const industry = await prisma.industry.findUnique({
    where: { id },
    include: {
      _count: { select: { companies: true } },
      companies: { select: { id: true, name: true, isActive: true } }
    }
  });

  if (!industry) {
    res.status(404).json({ error: 'Industry not found' });
    return;
  }

  res.json(industry);
}));

// POST create industry (SUPER_ADMIN only)
router.post('/', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { name, code, description, icon, colorPrimary, colorSecondary, sortOrder, isActive } = req.body;

  if (!name || !code) {
    res.status(400).json({ error: 'Name and code are required' });
    return;
  }

  // Check if code already exists
  const existing = await prisma.industry.findUnique({ where: { code } });
  if (existing) {
    res.status(400).json({ error: 'Industry code already exists' });
    return;
  }

  const industry = await prisma.industry.create({
    data: {
      name,
      code: code.toLowerCase(),
      description: description || null,
      icon: icon || 'bi bi-briefcase',
      colorPrimary: colorPrimary || '#2563eb',
      colorSecondary: colorSecondary || '#1d4ed8',
      sortOrder: sortOrder || 0,
      isActive: isActive !== false
    }
  });

  res.status(201).json(industry);
}));

// PUT update industry (SUPER_ADMIN only)
router.put('/:id', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, code, description, icon, colorPrimary, colorSecondary, sortOrder, isActive } = req.body;

  const existing = await prisma.industry.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Industry not found' });
    return;
  }

  // Check if new code conflicts with another industry
  if (code && code !== existing.code) {
    const codeConflict = await prisma.industry.findUnique({ where: { code } });
    if (codeConflict) {
      res.status(400).json({ error: 'Industry code already exists' });
      return;
    }
  }

  const industry = await prisma.industry.update({
    where: { id },
    data: {
      name: name || existing.name,
      code: code ? code.toLowerCase() : existing.code,
      description: description !== undefined ? description : existing.description,
      icon: icon || existing.icon,
      colorPrimary: colorPrimary || existing.colorPrimary,
      colorSecondary: colorSecondary || existing.colorSecondary,
      sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
      isActive: isActive !== undefined ? isActive : existing.isActive
    }
  });

  res.json(industry);
}));

// DELETE industry (SUPER_ADMIN only)
router.delete('/:id', requirePermission('MANAGE_PLATFORM'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.industry.findUnique({
    where: { id },
    include: { _count: { select: { companies: true } } }
  });

  if (!existing) {
    res.status(404).json({ error: 'Industry not found' });
    return;
  }

  if (existing._count.companies > 0) {
    res.status(400).json({ error: 'Cannot delete industry with existing companies' });
    return;
  }

  await prisma.industry.delete({ where: { id } });
  res.json({ success: true });
}));

export default router;
