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

// List all products
router.get('/', requirePermission('VIEW_PRODUCTS'), asyncHandler(async (req: Request, res: Response) => {
  const tenantCompanyId = getTenantId(req);
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const category = req.query.category as string;
  const featured = req.query.featured as string;
  const industryId = req.query.industryId as string;
  const queryCompanyId = req.query.companyId as string;

  // Determine effective companyId for filtering
  const effectiveCompanyId = isSuperAdmin ? (queryCompanyId || null) : tenantCompanyId;

  const where: any = {};
  if (effectiveCompanyId) where.companyId = effectiveCompanyId;
  if (category) where.category = category;
  if (featured === 'true') where.featured = true;

  // If industry filter is set, get companies in that industry and filter by them
  if (isSuperAdmin && industryId && !queryCompanyId) {
    const industryCompanies = await prisma.company.findMany({
      where: { industryId },
      select: { id: true }
    });
    where.companyId = { in: industryCompanies.map(c => c.id) };
  }

  const catWhere: any = effectiveCompanyId ? { companyId: effectiveCompanyId } : {};
  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { company: { include: { industry: true } } },
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: catWhere,
      select: { category: true },
      distinct: ['category']
    })
  ]);

  // Fetch industries and companies for SUPER_ADMIN filter
  const industries = isSuperAdmin ? await prisma.industry.findMany({ orderBy: { name: 'asc' } }) : [];
  const companies = isSuperAdmin ? await prisma.company.findMany({
    include: { industry: true },
    orderBy: { name: 'asc' }
  }) : [];

  res.render('admin/products/index', {
    title: 'Products',
    products,
    categories: categories.map(c => c.category).filter(Boolean),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    filters: { category, featured, industryId, companyId: queryCompanyId },
    industries,
    companies,
    isSuperAdmin,
    user: req.user,
    tenant: req.tenant
  });
}));

// Create product form
router.get('/new', requirePermission('MANAGE_PRODUCTS'), asyncHandler(async (req: Request, res: Response) => {
  res.render('admin/products/form', {
    title: 'New Product',
    product: null,
    user: req.user
  });
}));

// Edit product form
router.get('/:id/edit', requirePermission('MANAGE_PRODUCTS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const productWhere: any = { id: req.params.id };
  if (companyId) productWhere.companyId = companyId;
  const product = await prisma.product.findFirst({
    where: productWhere
  });

  if (!product) {
    return res.status(404).render('error', { title: 'Not Found', message: 'Product not found', statusCode: 404 });
  }

  res.render('admin/products/form', {
    title: `Edit ${product.name}`,
    product,
    user: req.user
  });
}));

// Create product
router.post('/', requirePermission('MANAGE_PRODUCTS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, sku, category, tagline, description, basePrice, features, benefits, featured } = req.body;

  if (!companyId) {
    res.status(400).json({ error: 'Company context required to create product' });
    return;
  }

  const product = await prisma.product.create({
    data: {
      companyId: companyId!,
      name,
      sku,
      category,
      tagline,
      description,
      basePrice: parseFloat(basePrice) || 0,
      features: features ? features.split('\n').filter(Boolean) : [],
      benefits: benefits ? benefits.split('\n').filter(Boolean) : [],
      featured: featured === 'on',
      isActive: true
    }
  });

  logger.info(`Product created: ${product.name}`, { userId: req.user?.id, productId: product.id });
  res.redirect('/admin/products');
}));

// Update product
router.put('/:id', requirePermission('MANAGE_PRODUCTS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const { name, sku, category, tagline, description, basePrice, features, benefits, featured, isActive } = req.body;

  const productWhere: any = { id: req.params.id };
  if (companyId) productWhere.companyId = companyId;
  const product = await prisma.product.findFirst({
    where: productWhere
  });

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  await prisma.product.update({
    where: { id: req.params.id },
    data: {
      name,
      sku,
      category,
      tagline,
      description,
      basePrice: parseFloat(basePrice) || 0,
      features: features ? features.split('\n').filter(Boolean) : [],
      benefits: benefits ? benefits.split('\n').filter(Boolean) : [],
      featured: featured === 'on' || featured === true,
      isActive: isActive === 'on' || isActive === true
    }
  });

  logger.info(`Product updated: ${name}`, { userId: req.user?.id, productId: req.params.id });
  res.json({ success: true });
}));

// Delete product
router.delete('/:id', requirePermission('MANAGE_PRODUCTS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const productWhere: any = { id: req.params.id };
  if (companyId) productWhere.companyId = companyId;

  const product = await prisma.product.findFirst({
    where: productWhere
  });

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  await prisma.product.delete({ where: { id: req.params.id } });
  logger.info(`Product deleted: ${product.name}`, { userId: req.user?.id });
  res.json({ success: true });
}));

// API: Search products
router.get('/api/search', requirePermission('VIEW_PRODUCTS'), asyncHandler(async (req: Request, res: Response) => {
  const companyId = getTenantId(req);
  const query = req.query.q as string;

  const where: any = {
    isActive: true,
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { sku: { contains: query, mode: 'insensitive' } },
      { category: { contains: query, mode: 'insensitive' } }
    ]
  };
  if (companyId) where.companyId = companyId;

  const products = await prisma.product.findMany({
    where,
    take: 10
  });

  res.json(products);
}));

export default router;
