import crypto from 'crypto';
import prisma from '../config/database';
import { logActivity, logError } from '../utils/logger';

// Webhook event types
export const WEBHOOK_EVENTS = {
  // Session events
  SESSION_STARTED: 'session.started',
  SESSION_COMPLETED: 'session.completed',
  SESSION_ABANDONED: 'session.abandoned',

  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',

  // Payment events
  PAYMENT_RECEIVED: 'payment.received',
  PAYMENT_FAILED: 'payment.failed',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',

  // Company events
  COMPANY_CREATED: 'company.created',
  COMPANY_UPDATED: 'company.updated',

  // Training events
  TRAINING_MILESTONE: 'training.milestone',
  CERTIFICATION_EARNED: 'certification.earned',
} as const;

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];

interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  companyId: string;
  data: Record<string, unknown>;
}

interface DeliveryResult {
  success: boolean;
  webhookId: string;
  statusCode?: number;
  error?: string;
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

/**
 * Dispatch an event to all registered webhooks for a company
 */
export async function dispatchWebhookEvent(
  companyId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  try {
    // Find all active webhooks for this company that subscribe to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        companyId,
        isActive: true,
      },
    });

    // Filter webhooks that subscribe to this event
    const subscribedWebhooks = webhooks.filter((webhook) => {
      const events = webhook.events as string[];
      return events.includes(eventType) || events.includes('*');
    });

    if (subscribedWebhooks.length === 0) {
      return results;
    }

    // Create the payload
    const payload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      companyId,
      data,
    };

    // Dispatch to each webhook
    const deliveryPromises = subscribedWebhooks.map((webhook) =>
      deliverWebhook(webhook, payload)
    );

    const deliveryResults = await Promise.allSettled(deliveryPromises);

    deliveryResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          webhookId: subscribedWebhooks[index].id,
          error: result.reason?.message || 'Unknown error',
        });
      }
    });

    logActivity('WEBHOOK_EVENT_DISPATCHED', {
      companyId,
      eventType,
      webhookCount: subscribedWebhooks.length,
      successCount: results.filter((r) => r.success).length,
    });

    return results;
  } catch (error) {
    logError('WEBHOOK_DISPATCH_ERROR', error as Error, {
      companyId,
      eventType,
    });
    return results;
  }
}

/**
 * Deliver a webhook payload to a single endpoint
 */
async function deliverWebhook(
  webhook: {
    id: string;
    url: string;
    secret: string | null;
    headers: unknown;
    failCount: number;
  },
  payload: WebhookPayload
): Promise<DeliveryResult> {
  const payloadString = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': payload.timestamp,
    'X-Webhook-ID': webhook.id,
  };

  // Add HMAC signature if secret is configured
  if (webhook.secret) {
    const signature = generateSignature(payloadString, webhook.secret);
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  // Add custom headers
  const customHeaders = webhook.headers as Record<string, string>;
  if (customHeaders && typeof customHeaders === 'object') {
    Object.assign(headers, customHeaders);
  }

  let statusCode: number | undefined;
  let responseText: string | undefined;
  let error: string | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    statusCode = response.status;
    responseText = await response.text().catch(() => '');

    const success = statusCode >= 200 && statusCode < 300;

    // Record the delivery attempt
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType: payload.event,
        payload: payload as unknown as Record<string, unknown>,
        statusCode,
        response: responseText?.substring(0, 1000), // Limit response size
        deliveredAt: success ? new Date() : null,
      },
    });

    // Update webhook status
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggered: new Date(),
        failCount: success ? 0 : webhook.failCount + 1,
      },
    });

    if (!success) {
      error = `HTTP ${statusCode}: ${responseText?.substring(0, 200)}`;
    }

    return {
      success,
      webhookId: webhook.id,
      statusCode,
      error,
    };
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';

    // Record failed delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType: payload.event,
        payload: payload as unknown as Record<string, unknown>,
        statusCode: null,
        error,
      },
    });

    // Update fail count
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        failCount: webhook.failCount + 1,
      },
    });

    return {
      success: false,
      webhookId: webhook.id,
      statusCode,
      error,
    };
  }
}

/**
 * Retry failed webhook deliveries
 */
export async function retryFailedWebhooks(maxRetries: number = 3): Promise<number> {
  try {
    // Find failed deliveries that haven't exceeded max retries
    const failedDeliveries = await prisma.webhookDelivery.findMany({
      where: {
        deliveredAt: null,
        attempts: { lt: maxRetries },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      },
      include: {
        webhook: true,
      },
      take: 100, // Process in batches
    });

    let retryCount = 0;

    for (const delivery of failedDeliveries) {
      if (!delivery.webhook.isActive) continue;

      const payload = delivery.payload as WebhookPayload;
      const payloadString = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        'X-Webhook-ID': delivery.webhook.id,
        'X-Webhook-Retry': String(delivery.attempts + 1),
      };

      if (delivery.webhook.secret) {
        const signature = generateSignature(payloadString, delivery.webhook.secret);
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const customHeaders = delivery.webhook.headers as Record<string, string>;
      if (customHeaders && typeof customHeaders === 'object') {
        Object.assign(headers, customHeaders);
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(delivery.webhook.url, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const statusCode = response.status;
        const success = statusCode >= 200 && statusCode < 300;

        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempts: delivery.attempts + 1,
            statusCode,
            deliveredAt: success ? new Date() : null,
            error: success ? null : `HTTP ${statusCode}`,
          },
        });

        if (success) {
          await prisma.webhook.update({
            where: { id: delivery.webhookId },
            data: { failCount: 0 },
          });
          retryCount++;
        }
      } catch (err) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempts: delivery.attempts + 1,
            error: err instanceof Error ? err.message : 'Unknown error',
          },
        });
      }
    }

    if (retryCount > 0) {
      logActivity('WEBHOOK_RETRY_COMPLETED', {
        retriedCount: retryCount,
        totalFailed: failedDeliveries.length,
      });
    }

    return retryCount;
  } catch (error) {
    logError('WEBHOOK_RETRY_ERROR', error as Error);
    return 0;
  }
}

/**
 * Get webhook delivery history for a company
 */
export async function getWebhookDeliveries(
  companyId: string,
  options: {
    limit?: number;
    offset?: number;
    eventType?: string;
    webhookId?: string;
    success?: boolean;
  } = {}
) {
  const { limit = 50, offset = 0, eventType, webhookId, success } = options;

  const where: Record<string, unknown> = {
    webhook: { companyId },
  };

  if (eventType) where.eventType = eventType;
  if (webhookId) where.webhookId = webhookId;
  if (success !== undefined) {
    where.deliveredAt = success ? { not: null } : null;
  }

  const [deliveries, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where,
      include: {
        webhook: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.webhookDelivery.count({ where }),
  ]);

  return { deliveries, total };
}

/**
 * Test a webhook by sending a test event
 */
export async function testWebhook(webhookId: string): Promise<DeliveryResult> {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
  });

  if (!webhook) {
    return {
      success: false,
      webhookId,
      error: 'Webhook not found',
    };
  }

  const testPayload: WebhookPayload = {
    event: 'test.ping' as WebhookEventType,
    timestamp: new Date().toISOString(),
    companyId: webhook.companyId,
    data: {
      message: 'This is a test webhook delivery',
      webhookId: webhook.id,
      webhookName: webhook.name,
    },
  };

  return deliverWebhook(
    {
      id: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      headers: webhook.headers,
      failCount: webhook.failCount,
    },
    testPayload
  );
}

/**
 * Convenience function to dispatch session completed event
 */
export async function dispatchSessionCompleted(
  companyId: string,
  sessionData: {
    sessionId: string;
    userId: string;
    duration: number;
    score?: number;
    feedback?: string;
  }
) {
  return dispatchWebhookEvent(companyId, WEBHOOK_EVENTS.SESSION_COMPLETED, sessionData);
}

/**
 * Convenience function to dispatch user created event
 */
export async function dispatchUserCreated(
  companyId: string,
  userData: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }
) {
  return dispatchWebhookEvent(companyId, WEBHOOK_EVENTS.USER_CREATED, userData);
}

/**
 * Convenience function to dispatch payment received event
 */
export async function dispatchPaymentReceived(
  companyId: string,
  paymentData: {
    paymentId: string;
    amount: number;
    currency: string;
    status: string;
  }
) {
  return dispatchWebhookEvent(companyId, WEBHOOK_EVENTS.PAYMENT_RECEIVED, paymentData);
}
