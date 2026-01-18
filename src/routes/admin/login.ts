import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../../middleware/errorHandler';
import { authRateLimiter } from '../../middleware/rateLimiter';
import * as authService from '../../services/auth.service';
import { ROLES } from '../../config/constants';

const router = Router();

// Admin Login page - at /admin/login
router.get('/login', (req, res) => {
  const basePath = process.env.BASE_PATH || '';

  // If already authenticated, redirect to admin dashboard
  if (req.session?.isAuthenticated && req.session?.userId) {
    return res.redirect(`${basePath}/admin`);
  }

  res.render('admin/auth/login', {
    title: 'Admin Login',
    redirect: req.query.redirect || `${basePath}/admin`,
    error: req.query.error,
    basePath
  });
});

// Admin Login handler - POST to /admin/login
router.post('/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  asyncHandler(async (req, res) => {
    const basePath = process.env.BASE_PATH || '';

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('admin/auth/login', {
        title: 'Admin Login',
        error: errors.array()[0].msg,
        email: req.body.email,
        basePath
      });
    }

    const { email, password, remember } = req.body;
    const redirect = req.body.redirect || `${basePath}/admin`;

    try {
      const user = await authService.loginUser(
        email,
        password,
        req.ip || 'unknown',
        req.headers['user-agent'] || 'unknown'
      );

      // Verify user has admin-level role
      const adminRoles: string[] = [ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.SUPERVISOR];
      if (!adminRoles.includes(user.role)) {
        throw new Error('You do not have permission to access the admin panel');
      }

      // Set session
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.role = user.role;
      req.session.companyId = user.companyId || undefined;
      req.session.isAuthenticated = true;

      if (remember) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }

      res.redirect(redirect);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      res.render('admin/auth/login', {
        title: 'Admin Login',
        error: message,
        email,
        redirect,
        basePath
      });
    }
  })
);

// Admin Logout
router.get('/logout', (req, res) => {
  const basePath = process.env.BASE_PATH || '';
  req.session.destroy((err) => {
    res.redirect(`${basePath}/admin/login`);
  });
});

export default router;
