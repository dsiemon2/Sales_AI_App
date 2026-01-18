import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../../middleware/errorHandler';
import { authRateLimiter, passwordResetRateLimiter } from '../../middleware/rateLimiter';
import { optionalAuth } from '../../middleware/auth';
import * as authService from '../../services/auth.service';
import { Role } from '../../config/constants';
import prisma from '../../config/database';
import crypto from 'crypto';

const router = Router();

// Login page (frontend users - redirects to chat)
router.get('/login', optionalAuth, (req, res) => {
  const basePath = process.env.BASE_PATH || '';

  if (req.user) {
    return res.redirect(`${basePath}/chat`);
  }

  res.render('auth/login', {
    title: 'Login',
    redirect: req.query.redirect || `${basePath}/chat`,
    error: req.query.error,
    success: req.query.reset === 'success' ? 'Password reset successful. Please login.' : undefined,
    basePath
  });
});

// Helper to check if request wants JSON response
const wantsJson = (req: any) => {
  return req.is('application/json') || req.get('X-Requested-With') === 'XMLHttpRequest';
};

// Login handler
router.post('/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (wantsJson(req)) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      const basePath = process.env.BASE_PATH || '';
      return res.render('auth/login', {
        title: 'Login',
        error: errors.array()[0].msg,
        email: req.body.email,
        basePath
      });
    }

    const { email, password, remember } = req.body;
    const basePath = process.env.BASE_PATH || '';
    const redirect = req.body.redirect || `${basePath}/chat`;

    try {
      const user = await authService.loginUser(
        email,
        password,
        req.ip || 'unknown',
        req.headers['user-agent'] || 'unknown'
      );

      // Set session
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.role = user.role;
      req.session.companyId = user.companyId || undefined;
      req.session.isAuthenticated = true;

      // Extend session if "remember me" is checked
      if (remember) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      }

      if (wantsJson(req)) {
        return res.json({ success: true, redirect });
      }

      res.redirect(redirect);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';

      if (wantsJson(req)) {
        return res.status(401).json({ success: false, error: message });
      }

      res.render('auth/login', {
        title: 'Login',
        error: message,
        email,
        redirect,
        basePath
      });
    }
  })
);

// Logout
router.get('/logout', (req, res) => {
  const basePath = process.env.BASE_PATH || '';
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.redirect(`${basePath}/auth/login`);
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Trial code activation
router.post('/trial',
  authRateLimiter,
  [
    body('trialCode').notEmpty().trim().withMessage('Trial code is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    const basePath = process.env.BASE_PATH || '';

    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Login',
        error: errors.array()[0].msg,
        redirect: `${basePath}/chat`,
        basePath
      });
    }

    const { trialCode } = req.body;

    try {
      // Find the trial code
      const trial = await prisma.trialCode.findUnique({
        where: { code: trialCode.toUpperCase() }
      });

      if (!trial) {
        return res.render('auth/login', {
          title: 'Login',
          error: 'Invalid trial code',
          redirect: `${basePath}/chat`,
          basePath
        });
      }

      // Check if code is active
      if (!trial.isActive) {
        return res.render('auth/login', {
          title: 'Login',
          error: 'This trial code is no longer active',
          redirect: `${basePath}/chat`,
          basePath
        });
      }

      // Check if code has reached max uses
      if (trial.usedCount >= trial.maxUses) {
        return res.render('auth/login', {
          title: 'Login',
          error: 'This trial code has reached its usage limit',
          redirect: `${basePath}/chat`,
          basePath
        });
      }

      // Check if code has expired
      if (trial.expiresAt && new Date() > trial.expiresAt) {
        return res.render('auth/login', {
          title: 'Login',
          error: 'This trial code has expired',
          redirect: `${basePath}/chat`,
          basePath
        });
      }

      // Increment usage count
      await prisma.trialCode.update({
        where: { id: trial.id },
        data: { usedCount: { increment: 1 } }
      });

      // Store trial info in session and redirect to registration
      req.session.trialCode = trial.code;
      req.session.trialDays = trial.daysValid;
      req.session.trialIndustryId = trial.industryId || undefined;

      res.redirect(`${basePath}/auth/register?trial=true`);
    } catch (error) {
      console.error('Trial code activation error:', error);
      res.render('auth/login', {
        title: 'Login',
        error: 'Failed to activate trial code. Please try again.',
        redirect: `${basePath}/chat`,
        basePath
      });
    }
  })
);

// Registration page (frontend users)
router.get('/register', optionalAuth, (req, res) => {
  const basePath = process.env.BASE_PATH || '';
  if (req.user) {
    return res.redirect(`${basePath}/chat`);
  }

  res.render('auth/register', {
    title: 'Create Account'
  });
});

// Registration handler
router.post('/register',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
    body('firstName').notEmpty().trim().withMessage('First name is required'),
    body('lastName').notEmpty().trim().withMessage('Last name is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.accepts('json')) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      return res.render('auth/register', {
        title: 'Create Account',
        errors: errors.array(),
        formData: req.body
      });
    }

    const { email, password, firstName, lastName, phone } = req.body;

    try {
      const user = await authService.registerUser(
        { email, password, firstName, lastName, phone },
        req.ip || 'unknown'
      );

      // Auto-login after registration
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.role = user.role as Role;
      req.session.isAuthenticated = true;

      const basePath = process.env.BASE_PATH || '';
      if (req.accepts('json')) {
        return res.json({ success: true, redirect: `${basePath}/chat` });
      }

      res.redirect(`${basePath}/chat?welcome=true`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';

      if (req.accepts('json')) {
        return res.status(400).json({ success: false, error: message });
      }

      res.render('auth/register', {
        title: 'Create Account',
        error: message,
        formData: req.body
      });
    }
  })
);

// Forgot password page
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Forgot Password'
  });
});

// Forgot password handler
router.post('/forgot-password',
  passwordResetRateLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.accepts('json')) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      return res.render('auth/forgot-password', {
        title: 'Forgot Password',
        error: errors.array()[0].msg
      });
    }

    const { email } = req.body;

    // Build base URL for email links
    const protocol = req.protocol;
    const host = req.get('host');
    const basePath = res.locals.basePath || process.env.BASE_PATH || '/ApexSales';
    const baseUrl = `${protocol}://${host}${basePath}`;

    await authService.requestPasswordReset(email, req.ip || 'unknown', baseUrl);

    if (req.accepts('json')) {
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent' });
    }

    res.render('auth/forgot-password', {
      title: 'Forgot Password',
      success: true
    });
  })
);

// Reset password page
router.get('/reset-password/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  res.render('auth/reset-password', {
    title: 'Reset Password',
    token
  });
}));

// Reset password handler
router.post('/reset-password/:token',
  [
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match')
  ],
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      if (req.accepts('json')) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      return res.render('auth/reset-password', {
        title: 'Reset Password',
        token,
        error: errors.array()[0].msg
      });
    }

    const { password } = req.body;

    try {
      await authService.resetPassword(token, password, req.ip || 'unknown');

      const basePath = process.env.BASE_PATH || '';
      if (req.accepts('json')) {
        return res.json({ success: true, redirect: `${basePath}/auth/login?reset=success` });
      }

      res.redirect(`${basePath}/auth/login?reset=success`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reset failed';

      if (req.accepts('json')) {
        return res.status(400).json({ success: false, error: message });
      }

      res.render('auth/reset-password', {
        title: 'Reset Password',
        token,
        error: message
      });
    }
  })
);

export default router;
