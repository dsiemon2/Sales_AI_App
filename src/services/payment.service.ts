// ===========================================
// Unified Payment Service
// Coordinates between Stripe, PayPal, Square, Braintree, and Authorize.net
// ===========================================

import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';
import * as stripeService from './stripe.service';
import * as paypalService from './paypal.service';
import * as squareService from './square.service';
import * as braintreeService from './braintree.service';
import * as authorizeService from './authorize.service';

export type PaymentProvider = 'stripe' | 'paypal' | 'square' | 'braintree' | 'authorize';

export interface PaymentResult {
  success: boolean;
  provider: PaymentProvider;
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  provider: PaymentProvider;
  refundId: string;
  status: string;
  amount: number;
  error?: string;
}

// ===========================================
// CONFIGURATION HELPERS
// ===========================================

export async function getEnabledGateways(companyId: string): Promise<{
  stripe: boolean;
  paypal: boolean;
  square: boolean;
  braintree: boolean;
  authorize: boolean;
  anyEnabled: boolean;
}> {
  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  const stripe = settings?.stripeEnabled || false;
  const paypal = settings?.paypalEnabled || false;
  const square = settings?.squareEnabled || false;
  const braintree = settings?.braintreeEnabled || false;
  const authorize = settings?.authorizeEnabled || false;

  return {
    stripe,
    paypal,
    square,
    braintree,
    authorize,
    anyEnabled: stripe || paypal || square || braintree || authorize
  };
}

export async function getDefaultGateway(companyId: string): Promise<PaymentProvider | null> {
  const gateways = await getEnabledGateways(companyId);

  // Return first enabled gateway (priority: Stripe > PayPal > Braintree > Square > Authorize.net)
  if (gateways.stripe) return 'stripe';
  if (gateways.paypal) return 'paypal';
  if (gateways.braintree) return 'braintree';
  if (gateways.square) return 'square';
  if (gateways.authorize) return 'authorize';

  return null;
}

// ===========================================
// PAYMENT PROCESSING
// ===========================================

export async function processPayment(
  companyId: string,
  provider: PaymentProvider,
  amount: number, // in cents
  currency: string = 'USD',
  options: {
    sourceId?: string; // Card token/nonce
    customerId?: string;
    customerEmail?: string;
    customerName?: string;
    description?: string;
    metadata?: Record<string, string>;
    // Square-specific
    locationId?: string;
    // PayPal-specific
    returnUrl?: string;
    cancelUrl?: string;
    items?: Array<{ name: string; quantity: number; unitAmount: number }>;
  }
): Promise<PaymentResult> {
  try {
    switch (provider) {
      case 'stripe': {
        const paymentIntent = await stripeService.createPaymentIntent(
          companyId,
          amount,
          currency,
          options.customerId,
          options.metadata
        );

        return {
          success: true,
          provider: 'stripe',
          transactionId: paymentIntent.id,
          status: paymentIntent.status,
          amount,
          currency,
          metadata: { clientSecret: paymentIntent.client_secret }
        };
      }

      case 'paypal': {
        if (!options.returnUrl || !options.cancelUrl) {
          throw new Error('PayPal requires returnUrl and cancelUrl');
        }

        const items = options.items || [{
          name: options.description || 'Payment',
          quantity: 1,
          unitAmount: amount / 100 // Convert cents to dollars
        }];

        const order = await paypalService.createOrder(
          companyId,
          items,
          options.returnUrl,
          options.cancelUrl,
          options.metadata
        );

        return {
          success: true,
          provider: 'paypal',
          transactionId: order.orderId,
          status: order.status,
          amount,
          currency,
          metadata: { approvalUrl: order.approvalUrl }
        };
      }

      case 'square': {
        if (!options.sourceId || !options.locationId) {
          throw new Error('Square requires sourceId (card nonce) and locationId');
        }

        const payment = await squareService.createPayment(
          companyId,
          options.sourceId,
          amount,
          currency,
          options.locationId,
          options.customerId,
          options.description,
          options.metadata
        );

        return {
          success: true,
          provider: 'square',
          transactionId: payment.paymentId,
          status: payment.status,
          amount,
          currency,
          metadata: { receiptUrl: payment.receiptUrl }
        };
      }

      case 'braintree': {
        if (!options.sourceId) {
          throw new Error('Braintree requires sourceId (payment method nonce)');
        }

        const transaction = await braintreeService.createTransaction(
          companyId,
          amount / 100, // Convert cents to dollars for Braintree
          options.sourceId,
          {
            customerId: options.customerId,
            orderId: options.metadata?.orderId as string,
            submitForSettlement: true
          }
        );

        return {
          success: true,
          provider: 'braintree',
          transactionId: transaction.id,
          status: transaction.status,
          amount,
          currency,
          metadata: { processorResponseCode: transaction.processorResponseCode }
        };
      }

      case 'authorize': {
        if (!options.sourceId) {
          throw new Error('Authorize.net requires card information');
        }

        // Parse card info from sourceId (format: cardNumber|expDate|cvv)
        const [cardNumber, expirationDate, cardCode] = options.sourceId.split('|');

        const result = await authorizeService.chargeCard(
          companyId,
          {
            cardNumber,
            expirationDate,
            cardCode
          },
          amount / 100, // Convert cents to dollars
          {
            email: options.customerEmail,
            description: options.description,
            invoiceNumber: options.metadata?.invoiceNumber as string
          }
        );

        return {
          success: true,
          provider: 'authorize',
          transactionId: result.transactionId,
          status: 'succeeded',
          amount,
          currency,
          metadata: { authCode: result.authCode, avsResultCode: result.avsResultCode }
        };
      }

      default:
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  } catch (error) {
    const err = error as Error;
    logError(`Payment processing failed (${provider})`, err);

    return {
      success: false,
      provider,
      transactionId: '',
      status: 'failed',
      amount,
      currency,
      error: err.message
    };
  }
}

// ===========================================
// CAPTURE PAYMENT (for PayPal)
// ===========================================

export async function capturePayment(
  companyId: string,
  provider: PaymentProvider,
  transactionId: string
): Promise<PaymentResult> {
  try {
    switch (provider) {
      case 'stripe': {
        // Stripe payments are captured automatically with payment intents
        const paymentIntent = await stripeService.getPaymentIntent(companyId, transactionId);
        return {
          success: paymentIntent.status === 'succeeded',
          provider: 'stripe',
          transactionId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency
        };
      }

      case 'paypal': {
        const capture = await paypalService.captureOrder(companyId, transactionId);
        return {
          success: capture.status === 'COMPLETED',
          provider: 'paypal',
          transactionId: capture.transactionId,
          status: capture.status,
          amount: capture.amount,
          currency: capture.currency
        };
      }

      case 'square': {
        // Square payments are captured immediately
        const payment = await squareService.getPayment(companyId, transactionId);
        return {
          success: payment.status === 'COMPLETED',
          provider: 'square',
          transactionId: payment.paymentId,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency
        };
      }

      case 'braintree': {
        // Braintree - submit for settlement if not already
        const transaction = await braintreeService.getTransaction(companyId, transactionId);
        if (transaction.status === 'authorized') {
          const settled = await braintreeService.submitForSettlement(companyId, transactionId);
          return {
            success: true,
            provider: 'braintree',
            transactionId: settled.id,
            status: settled.status,
            amount: parseFloat(settled.amount) * 100,
            currency: settled.currencyIsoCode || 'USD'
          };
        }
        return {
          success: transaction.status === 'submitted_for_settlement' || transaction.status === 'settled',
          provider: 'braintree',
          transactionId: transaction.id,
          status: transaction.status,
          amount: parseFloat(transaction.amount) * 100,
          currency: transaction.currencyIsoCode || 'USD'
        };
      }

      case 'authorize': {
        // Authorize.net - capture a previously authorized transaction
        const result = await authorizeService.captureTransaction(companyId, transactionId);
        return {
          success: true,
          provider: 'authorize',
          transactionId: result.transactionId,
          status: 'captured',
          amount: 0, // Amount not returned from capture
          currency: 'USD'
        };
      }

      default:
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  } catch (error) {
    const err = error as Error;
    logError(`Payment capture failed (${provider})`, err);

    return {
      success: false,
      provider,
      transactionId,
      status: 'failed',
      amount: 0,
      currency: 'USD',
      error: err.message
    };
  }
}

// ===========================================
// REFUNDS
// ===========================================

export async function processRefund(
  companyId: string,
  provider: PaymentProvider,
  transactionId: string,
  amount?: number, // in cents, partial refund if provided
  reason?: string
): Promise<RefundResult> {
  try {
    switch (provider) {
      case 'stripe': {
        const refund = await stripeService.createRefund(
          companyId,
          transactionId,
          amount,
          reason as 'duplicate' | 'fraudulent' | 'requested_by_customer'
        );
        return {
          success: refund.status === 'succeeded',
          provider: 'stripe',
          refundId: refund.id,
          status: refund.status || 'unknown',
          amount: refund.amount || 0
        };
      }

      case 'paypal': {
        const refund = await paypalService.refundCapture(
          companyId,
          transactionId,
          amount,
          'USD',
          reason
        );
        return {
          success: refund.status === 'COMPLETED',
          provider: 'paypal',
          refundId: refund.refundId,
          status: refund.status,
          amount: refund.amount
        };
      }

      case 'square': {
        const refund = await squareService.refundPayment(
          companyId,
          transactionId,
          amount,
          reason
        );
        return {
          success: refund.status === 'COMPLETED',
          provider: 'square',
          refundId: refund.refundId,
          status: refund.status,
          amount: refund.amount
        };
      }

      case 'braintree': {
        const transaction = await braintreeService.refundTransaction(
          companyId,
          transactionId,
          amount ? amount / 100 : undefined // Convert cents to dollars for partial refund
        );
        return {
          success: transaction.status === 'submitted_for_settlement',
          provider: 'braintree',
          refundId: transaction.id,
          status: transaction.status,
          amount: parseFloat(transaction.amount) * 100
        };
      }

      case 'authorize': {
        const result = await authorizeService.refundTransaction(
          companyId,
          transactionId,
          amount ? amount / 100 : 0 // Convert cents to dollars
        );
        return {
          success: true,
          provider: 'authorize',
          refundId: result.transactionId,
          status: 'refunded',
          amount: amount || 0
        };
      }

      default:
        throw new Error(`Unknown payment provider: ${provider}`);
    }
  } catch (error) {
    const err = error as Error;
    logError(`Refund processing failed (${provider})`, err);

    return {
      success: false,
      provider,
      refundId: '',
      status: 'failed',
      amount: 0,
      error: err.message
    };
  }
}

// ===========================================
// TEST CONNECTIONS
// ===========================================

export async function testAllConnections(companyId: string): Promise<{
  stripe: { success: boolean; message: string };
  paypal: { success: boolean; message: string };
  square: { success: boolean; message: string };
  braintree: { success: boolean; message: string };
  authorize: { success: boolean; message: string };
}> {
  const gateways = await getEnabledGateways(companyId);
  const results: {
    stripe: { success: boolean; message: string };
    paypal: { success: boolean; message: string };
    square: { success: boolean; message: string };
    braintree: { success: boolean; message: string };
    authorize: { success: boolean; message: string };
  } = {
    stripe: { success: false, message: 'Not enabled' },
    paypal: { success: false, message: 'Not enabled' },
    square: { success: false, message: 'Not enabled' },
    braintree: { success: false, message: 'Not enabled' },
    authorize: { success: false, message: 'Not enabled' }
  };

  if (gateways.stripe) {
    results.stripe = await stripeService.testStripeConnection(companyId);
  }

  if (gateways.paypal) {
    results.paypal = await paypalService.testPayPalConnection(companyId);
  }

  if (gateways.square) {
    results.square = await squareService.testSquareConnection(companyId);
  }

  if (gateways.braintree) {
    results.braintree = await braintreeService.testBraintreeConnection(companyId);
  }

  if (gateways.authorize) {
    results.authorize = await authorizeService.testAuthorizeConnection(companyId);
  }

  return results;
}

// ===========================================
// TRANSACTION QUERIES
// ===========================================

export async function getTransactions(
  companyId: string,
  options: {
    provider?: PaymentProvider;
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  transactions: Array<{
    id: string;
    externalId: string | null;
    amount: number;
    currency: string;
    status: string;
    type: string;
    customerEmail: string | null;
    createdAt: Date;
    metadata: unknown;
  }>;
  total: number;
}> {
  const where: Record<string, unknown> = { companyId };

  if (options.status) where.status = options.status;
  if (options.type) where.type = options.type;
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) (where.createdAt as Record<string, unknown>).gte = options.startDate;
    if (options.endDate) (where.createdAt as Record<string, unknown>).lte = options.endDate;
  }
  if (options.provider) {
    where.metadata = { path: ['provider'], equals: options.provider };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0
    }),
    prisma.transaction.count({ where })
  ]);

  return { transactions, total };
}

export async function getTransactionStats(
  companyId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalRevenue: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  refundedAmount: number;
  byProvider: {
    stripe: number;
    paypal: number;
    square: number;
    braintree: number;
    authorize: number;
    other: number;
  };
}> {
  const where: Record<string, unknown> = { companyId };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, unknown>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, unknown>).lte = endDate;
  }

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      amount: true,
      status: true,
      type: true,
      metadata: true
    }
  });

  let totalRevenue = 0;
  let successfulTransactions = 0;
  let failedTransactions = 0;
  let refundedAmount = 0;
  const byProvider = { stripe: 0, paypal: 0, square: 0, braintree: 0, authorize: 0, other: 0 };

  for (const tx of transactions) {
    const metadata = tx.metadata as Record<string, unknown>;
    const provider = (metadata?.provider as string) || 'other';

    if (tx.status === 'succeeded' && tx.type === 'payment') {
      totalRevenue += tx.amount;
      successfulTransactions++;
    }
    if (tx.status === 'failed') {
      failedTransactions++;
    }
    if (tx.type === 'refund') {
      refundedAmount += tx.amount;
    }

    if (provider in byProvider) {
      byProvider[provider as keyof typeof byProvider] += tx.amount;
    } else {
      byProvider.other += tx.amount;
    }
  }

  return {
    totalRevenue,
    totalTransactions: transactions.length,
    successfulTransactions,
    failedTransactions,
    refundedAmount,
    byProvider
  };
}

// ===========================================
// WEBHOOK ROUTING
// ===========================================

export async function handleWebhook(
  companyId: string,
  provider: PaymentProvider,
  eventType: string,
  payload: unknown
): Promise<void> {
  logInfo('Processing payment webhook', { companyId, provider, eventType });

  switch (provider) {
    case 'stripe':
      // Stripe webhooks are handled with event objects
      // The actual handling is in stripe.service.ts handleWebhookEvent
      break;
    case 'paypal':
      await paypalService.handlePayPalWebhook(companyId, eventType, payload as Record<string, unknown>);
      break;
    case 'square':
      await squareService.handleSquareWebhook(companyId, eventType, payload as Record<string, unknown>);
      break;
    case 'braintree':
      // Braintree webhooks require signature and payload
      // Handled separately via braintreeService.handleWebhookEvent
      logInfo('Braintree webhook received', { companyId, eventType });
      break;
    case 'authorize':
      // Authorize.net webhooks handled via authorizeService.handleWebhookEvent
      await authorizeService.handleWebhookEvent(companyId, eventType, payload as Record<string, unknown>);
      break;
  }
}
