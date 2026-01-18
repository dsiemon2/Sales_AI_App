// ===========================================
// Stripe Payment Service
// ===========================================

import Stripe from 'stripe';
import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';

// Initialize Stripe client (will be configured per-company)
function getStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16'
  });
}

// Get company's Stripe configuration
async function getStripeConfig(companyId: string) {
  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.stripeEnabled || !settings.stripeSecretKey) {
    throw new Error('Stripe is not configured for this company');
  }

  return {
    secretKey: settings.stripeSecretKey,
    publishableKey: settings.stripePublishableKey,
    testMode: settings.stripeTestMode
  };
}

// ===========================================
// CUSTOMER MANAGEMENT
// ===========================================

export async function createStripeCustomer(
  companyId: string,
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { companyId, ...metadata }
  });

  logInfo('Stripe customer created', { companyId, customerId: customer.id, email });
  return customer;
}

export async function getStripeCustomer(
  companyId: string,
  customerId: string
): Promise<Stripe.Customer | null> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer as Stripe.Customer;
  } catch (error) {
    logError('Failed to retrieve Stripe customer', error as Error);
    return null;
  }
}

// ===========================================
// PAYMENT INTENTS
// ===========================================

export async function createPaymentIntent(
  companyId: string,
  amount: number, // in cents
  currency: string = 'usd',
  customerId?: string,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    metadata: { companyId, ...metadata },
    automatic_payment_methods: { enabled: true }
  });

  logInfo('Stripe payment intent created', {
    companyId,
    paymentIntentId: paymentIntent.id,
    amount,
    currency
  });

  return paymentIntent;
}

export async function confirmPaymentIntent(
  companyId: string,
  paymentIntentId: string,
  paymentMethodId: string
): Promise<Stripe.PaymentIntent> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId
  });

  logInfo('Stripe payment intent confirmed', {
    companyId,
    paymentIntentId,
    status: paymentIntent.status
  });

  return paymentIntent;
}

export async function getPaymentIntent(
  companyId: string,
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  return stripe.paymentIntents.retrieve(paymentIntentId);
}

// ===========================================
// SUBSCRIPTIONS
// ===========================================

export async function createSubscription(
  companyId: string,
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Subscription> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: { companyId, ...metadata },
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent']
  });

  logInfo('Stripe subscription created', {
    companyId,
    subscriptionId: subscription.id,
    customerId,
    priceId
  });

  return subscription;
}

export async function cancelSubscription(
  companyId: string,
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  let subscription: Stripe.Subscription;

  if (immediately) {
    subscription = await stripe.subscriptions.cancel(subscriptionId);
  } else {
    subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
  }

  logInfo('Stripe subscription cancelled', {
    companyId,
    subscriptionId,
    immediately
  });

  return subscription;
}

export async function getSubscription(
  companyId: string,
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  return stripe.subscriptions.retrieve(subscriptionId);
}

// ===========================================
// REFUNDS
// ===========================================

export async function createRefund(
  companyId: string,
  paymentIntentId: string,
  amount?: number, // in cents, partial refund if provided
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<Stripe.Refund> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount,
    reason
  });

  logInfo('Stripe refund created', {
    companyId,
    refundId: refund.id,
    paymentIntentId,
    amount
  });

  return refund;
}

// ===========================================
// CHECKOUT SESSIONS
// ===========================================

export async function createCheckoutSession(
  companyId: string,
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
  successUrl: string,
  cancelUrl: string,
  customerId?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Checkout.Session> {
  const config = await getStripeConfig(companyId);
  const stripe = getStripeClient(config.secretKey);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer: customerId,
    metadata: { companyId, ...metadata }
  });

  logInfo('Stripe checkout session created', {
    companyId,
    sessionId: session.id
  });

  return session;
}

// ===========================================
// WEBHOOK HANDLING
// ===========================================

export function constructWebhookEvent(
  payload: Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export async function handleWebhookEvent(
  companyId: string,
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await recordTransaction(companyId, {
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'succeeded',
        type: 'payment',
        customerEmail: paymentIntent.receipt_email || undefined,
        metadata: paymentIntent.metadata as Record<string, unknown>
      });
      break;
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await recordTransaction(companyId, {
        externalId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'failed',
        type: 'payment',
        metadata: paymentIntent.metadata as Record<string, unknown>
      });
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      await recordTransaction(companyId, {
        externalId: charge.id,
        amount: charge.amount_refunded,
        currency: charge.currency,
        status: 'refunded',
        type: 'refund',
        metadata: charge.metadata as Record<string, unknown>
      });
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      logInfo('Subscription event received', {
        companyId,
        subscriptionId: subscription.id,
        status: subscription.status,
        eventType: event.type
      });
      break;
    }
    default:
      logInfo('Unhandled Stripe webhook event', { type: event.type });
  }
}

// ===========================================
// TRANSACTION RECORDING
// ===========================================

async function recordTransaction(
  companyId: string,
  data: {
    externalId: string;
    amount: number;
    currency: string;
    status: string;
    type: string;
    customerEmail?: string;
    customerName?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await prisma.transaction.create({
    data: {
      companyId,
      externalId: data.externalId,
      amount: data.amount,
      currency: data.currency.toUpperCase(),
      status: data.status,
      type: data.type,
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      sessionId: data.sessionId,
      metadata: (data.metadata || {}) as Record<string, string>
    }
  });

  logInfo('Transaction recorded', { companyId, externalId: data.externalId, status: data.status });
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testStripeConnection(companyId: string): Promise<{
  success: boolean;
  message: string;
  accountId?: string;
}> {
  try {
    const config = await getStripeConfig(companyId);
    const stripe = getStripeClient(config.secretKey);

    // Test the connection by retrieving account info
    const account = await stripe.accounts.retrieve();

    return {
      success: true,
      message: `Connected to Stripe account: ${account.email || account.id}`,
      accountId: account.id
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `Stripe connection failed: ${err.message}`
    };
  }
}
