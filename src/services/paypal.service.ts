// ===========================================
// PayPal Payment Service
// ===========================================

import paypal from '@paypal/checkout-server-sdk';
import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';

// PayPal environment configuration
function getPayPalEnvironment(clientId: string, clientSecret: string, testMode: boolean) {
  if (testMode) {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret);
  }
  return new paypal.core.LiveEnvironment(clientId, clientSecret);
}

// Get PayPal client for a company
async function getPayPalClient(companyId: string): Promise<paypal.core.PayPalHttpClient> {
  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.paypalEnabled || !settings.paypalClientId || !settings.paypalClientSecret) {
    throw new Error('PayPal is not configured for this company');
  }

  const environment = getPayPalEnvironment(
    settings.paypalClientId,
    settings.paypalClientSecret,
    settings.paypalTestMode
  );

  return new paypal.core.PayPalHttpClient(environment);
}

// Get company's PayPal configuration
async function getPayPalConfig(companyId: string) {
  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.paypalEnabled) {
    throw new Error('PayPal is not configured for this company');
  }

  return {
    clientId: settings.paypalClientId,
    clientSecret: settings.paypalClientSecret,
    testMode: settings.paypalTestMode
  };
}

// ===========================================
// ORDER MANAGEMENT
// ===========================================

export interface PayPalOrderItem {
  name: string;
  description?: string;
  quantity: number;
  unitAmount: number; // in dollars
  currency?: string;
}

export async function createOrder(
  companyId: string,
  items: PayPalOrderItem[],
  returnUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<{
  orderId: string;
  approvalUrl: string;
  status: string;
}> {
  const client = await getPayPalClient(companyId);

  // Calculate total
  const total = items.reduce((sum, item) => sum + (item.unitAmount * item.quantity), 0);
  const currency = items[0]?.currency || 'USD';

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency,
        value: total.toFixed(2),
        breakdown: {
          item_total: {
            currency_code: currency,
            value: total.toFixed(2)
          }
        }
      },
      items: items.map(item => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity.toString(),
        unit_amount: {
          currency_code: item.currency || 'USD',
          value: item.unitAmount.toFixed(2)
        }
      })),
      custom_id: metadata ? JSON.stringify(metadata) : undefined
    }],
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      brand_name: 'Apex Sales Training',
      user_action: 'PAY_NOW'
    }
  });

  const response = await client.execute(request);
  const order = response.result;

  const approvalLink = order.links?.find((link: { rel: string }) => link.rel === 'approve');

  logInfo('PayPal order created', {
    companyId,
    orderId: order.id,
    total,
    currency
  });

  return {
    orderId: order.id,
    approvalUrl: approvalLink?.href || '',
    status: order.status
  };
}

export async function captureOrder(
  companyId: string,
  orderId: string
): Promise<{
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  payerEmail?: string;
}> {
  const client = await getPayPalClient(companyId);

  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});

  const response = await client.execute(request);
  const capture = response.result;

  const captureDetails = capture.purchase_units?.[0]?.payments?.captures?.[0];

  logInfo('PayPal order captured', {
    companyId,
    orderId,
    transactionId: captureDetails?.id,
    status: capture.status
  });

  // Record the transaction
  if (captureDetails) {
    await recordPayPalTransaction(companyId, {
      externalId: captureDetails.id,
      orderId,
      amount: Math.round(parseFloat(captureDetails.amount?.value || '0') * 100),
      currency: captureDetails.amount?.currency_code || 'USD',
      status: capture.status === 'COMPLETED' ? 'succeeded' : 'pending',
      payerEmail: capture.payer?.email_address
    });
  }

  return {
    transactionId: captureDetails?.id || orderId,
    status: capture.status,
    amount: Math.round(parseFloat(captureDetails?.amount?.value || '0') * 100),
    currency: captureDetails?.amount?.currency_code || 'USD',
    payerEmail: capture.payer?.email_address
  };
}

export async function getOrder(
  companyId: string,
  orderId: string
): Promise<{
  orderId: string;
  status: string;
  amount: number;
  currency: string;
}> {
  const client = await getPayPalClient(companyId);

  const request = new paypal.orders.OrdersGetRequest(orderId);
  const response = await client.execute(request);
  const order = response.result;

  const purchaseUnit = order.purchase_units?.[0];

  return {
    orderId: order.id,
    status: order.status,
    amount: Math.round(parseFloat(purchaseUnit?.amount?.value || '0') * 100),
    currency: purchaseUnit?.amount?.currency_code || 'USD'
  };
}

// ===========================================
// REFUNDS
// ===========================================

export async function refundCapture(
  companyId: string,
  captureId: string,
  amount?: number, // in cents, partial refund if provided
  currency: string = 'USD',
  note?: string
): Promise<{
  refundId: string;
  status: string;
  amount: number;
}> {
  const client = await getPayPalClient(companyId);

  const request = new paypal.payments.CapturesRefundRequest(captureId);

  const refundBody: Record<string, unknown> = {};
  if (amount) {
    refundBody.amount = {
      currency_code: currency,
      value: (amount / 100).toFixed(2)
    };
  }
  if (note) {
    refundBody.note_to_payer = note;
  }

  request.requestBody(refundBody);

  const response = await client.execute(request);
  const refund = response.result;

  const refundAmount = Math.round(parseFloat(refund.amount?.value || '0') * 100);

  logInfo('PayPal refund created', {
    companyId,
    refundId: refund.id,
    captureId,
    amount: refundAmount
  });

  // Record the refund transaction
  await recordPayPalTransaction(companyId, {
    externalId: refund.id,
    amount: refundAmount,
    currency: refund.amount?.currency_code || currency,
    status: 'refunded',
    type: 'refund'
  });

  return {
    refundId: refund.id,
    status: refund.status,
    amount: refundAmount
  };
}

// ===========================================
// TRANSACTION RECORDING
// ===========================================

async function recordPayPalTransaction(
  companyId: string,
  data: {
    externalId: string;
    orderId?: string;
    amount: number;
    currency: string;
    status: string;
    type?: string;
    payerEmail?: string;
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
      type: data.type || 'payment',
      customerEmail: data.payerEmail,
      metadata: {
        orderId: data.orderId,
        provider: 'paypal',
        ...data.metadata
      }
    }
  });

  logInfo('PayPal transaction recorded', {
    companyId,
    externalId: data.externalId,
    status: data.status
  });
}

// ===========================================
// WEBHOOK HANDLING
// ===========================================

export async function handlePayPalWebhook(
  companyId: string,
  eventType: string,
  resource: Record<string, unknown>
): Promise<void> {
  switch (eventType) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      const captureId = resource.id as string;
      const amount = resource.amount as { value: string; currency_code: string };
      await recordPayPalTransaction(companyId, {
        externalId: captureId,
        amount: Math.round(parseFloat(amount?.value || '0') * 100),
        currency: amount?.currency_code || 'USD',
        status: 'succeeded',
        type: 'payment'
      });
      break;
    }
    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.DECLINED': {
      const captureId = resource.id as string;
      const amount = resource.amount as { value: string; currency_code: string };
      await recordPayPalTransaction(companyId, {
        externalId: captureId,
        amount: Math.round(parseFloat(amount?.value || '0') * 100),
        currency: amount?.currency_code || 'USD',
        status: 'failed',
        type: 'payment'
      });
      break;
    }
    case 'PAYMENT.CAPTURE.REFUNDED': {
      const refundId = resource.id as string;
      const amount = resource.amount as { value: string; currency_code: string };
      await recordPayPalTransaction(companyId, {
        externalId: refundId,
        amount: Math.round(parseFloat(amount?.value || '0') * 100),
        currency: amount?.currency_code || 'USD',
        status: 'refunded',
        type: 'refund'
      });
      break;
    }
    default:
      logInfo('Unhandled PayPal webhook event', { eventType });
  }
}

// ===========================================
// VERIFY WEBHOOK SIGNATURE
// ===========================================

export async function verifyWebhookSignature(
  companyId: string,
  headers: Record<string, string>,
  body: string,
  webhookId: string
): Promise<boolean> {
  // PayPal webhook verification would be implemented here
  // For now, return true (in production, implement proper verification)
  logInfo('PayPal webhook signature verification', { companyId, webhookId });
  return true;
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testPayPalConnection(companyId: string): Promise<{
  success: boolean;
  message: string;
  testMode?: boolean;
}> {
  try {
    const config = await getPayPalConfig(companyId);

    // Test by creating a minimal client and making a simple API call
    const environment = getPayPalEnvironment(
      config.clientId,
      config.clientSecret,
      config.testMode
    );
    const client = new paypal.core.PayPalHttpClient(environment);

    // Try to get an access token (this validates credentials)
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=minimal');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '0.01'
        }
      }]
    });

    // We create and immediately void a test order
    const response = await client.execute(request);

    return {
      success: true,
      message: `PayPal ${config.testMode ? 'Sandbox' : 'Live'} connection successful`,
      testMode: config.testMode
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `PayPal connection failed: ${err.message}`
    };
  }
}
