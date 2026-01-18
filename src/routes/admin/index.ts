import { Router } from 'express';
import loginRoutes from './login';
import dashboardRoutes from './dashboard';
import sessionsRoutes from './sessions';
import productsRoutes from './products';
import techniquesRoutes from './techniques';
import discoveryRoutes from './discovery';
import objectionsRoutes from './objections';
import closingsRoutes from './closings';
import settingsRoutes from './settings';
import aiConfigRoutes from './ai-config';
import analyticsRoutes from './analytics';
import usersRoutes from './users';
import trialCodesRoutes from './trial-codes';
import additionalRoutes from './additional';

const router = Router();

// Login route - NO auth required (must be first)
router.use('/', loginRoutes);

// Dashboard and other routes (require auth)
router.use('/', dashboardRoutes);
router.use('/sessions', sessionsRoutes);
router.use('/products', productsRoutes);
router.use('/techniques', techniquesRoutes);
router.use('/discovery', discoveryRoutes);
router.use('/objections', objectionsRoutes);
router.use('/closings', closingsRoutes);
router.use('/settings', settingsRoutes);
router.use('/ai-config', aiConfigRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/users', usersRoutes);
router.use('/trial-codes', trialCodesRoutes);
router.use('/', additionalRoutes);

export default router;
