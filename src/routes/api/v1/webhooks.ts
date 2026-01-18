// ===========================================
// Payment Webhook Routes
// ===========================================

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database';
import { logInfo, logError } from '../../../utils/logger';
import * as stripeService from '../../../services/stripe.service';
import * as paypalService from '../../../services/paypal.service';
import * as squareService from '../../../services/square.service';

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

// ===========================================
// STRIPE WEBHOOKS
// ===========================================

router.post('/stripe/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  try {
    // Get company's webhook secret
    const settings = await prisma.companyPaymentSettings.findUnique({
      where: { companyId }
    });

    if (!settings?.stripeEnabled) {
      res.status(404).json({ error: 'Stripe not enabled for this company' });
      return;
    }

    // Get webhook secret from environment or settings
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    if (!webhookSecret) {
      logError('Stripe webhook secret not configured', new Error('Missing webhook secret'));
      res.status(500).json({ error: 'Webhook secret not configured' });
      return;
    }

    // Verify and construct event
    const event = stripeService.constructWebhookEvent(
      req.body,
      signature,
      webhookSecret
    );

    logInfo('Stripe webhook received', {
      companyId,
      eventType: event.type,
      eventId: event.id
    });

    // Handle the event
    await stripeService.handleWebhookEvent(companyId, event);

    res.json({ received: true });
  } catch (error) {
    const err = error as Error;
    logError('Stripe webhook error', err);
    res.status(400).json({ error: err.message });
  }
}));

// ===========================================
// PAYPAL WEBHOOKS
// ===========================================

router.post('/paypal/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const eventType = req.body.event_type;
  const resource = req.body.resource;

  try {
    // Verify company has PayPal enabled
    const settings = await prisma.companyPaymentSettings.findUnique({
      where: { companyId }
    });

    if (!settings?.paypalEnabled) {
      res.status(404).json({ error: 'PayPal not enabled for this company' });
      return;
    }

    logInfo('PayPal webhook received', {
      companyId,
      eventType,
      resourceType: resource?.type
    });

    // Verify webhook signature (if configured)
    const webhookId = req.headers['paypal-transmission-id'] as string;
    const isValid = await paypalService.verifyWebhookSignature(
      companyId,
      req.headers as Record<string, string>,
      JSON.stringify(req.body),
      webhookId
    );

    if (!isValid) {
      logError('PayPal webhook signature verification failed', new Error('Invalid signature'));
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    // Handle the event
    await paypalService.handlePayPalWebhook(companyId, eventType, resource);

    res.json({ received: true });
  } catch (error) {
    const err = error as Error;
    logError('PayPal webhook error', err);
    res.status(400).json({ error: err.message });
  }
}));

// ===========================================
// SQUARE WEBHOOKS
// ===========================================

router.post('/square/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const eventType = req.body.type;
  const data = req.body.data;

  try {
    // Verify company has Square enabled
    const settings = await prisma.companyPaymentSettings.findUnique({
      where: { companyId }
    });

    if (!settings?.squareEnabled) {
      res.status(404).json({ error: 'Square not enabled for this company' });
      return;
    }

    logInfo('Square webhook received', {
      companyId,
      eventType,
      eventId: req.body.event_id
    });

    // Square webhook signature verification
    const signature = req.headers['x-square-signature'] as string;
    if (!signature) {
      // For now, log but don't reject - implement proper verification in production
      logInfo('Square webhook received without signature', { companyId });
    }

    // Handle the event
    await squareService.handleSquareWebhook(companyId, eventType, data);

    res.json({ received: true });
  } catch (error) {
    const err = error as Error;
    logError('Square webhook error', err);
    res.status(400).json({ error: err.message });
  }
}));

// ===========================================
// WEBHOOK STATUS / TEST ENDPOINTS
// ===========================================

router.get('/status/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.params;

  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  res.json({
    stripe: {
      enabled: settings?.stripeEnabled || false,
      webhookUrl: `/api/v1/webhooks/stripe/${companyId}`
    },
    paypal: {
      enabled: settings?.paypalEnabled || false,
      webhookUrl: `/api/v1/webhooks/paypal/${companyId}`
    },
    square: {
      enabled: settings?.squareEnabled || false,
      webhookUrl: `/api/v1/webhooks/square/${companyId}`
    }
  });
}));

export default router;
