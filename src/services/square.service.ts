// ===========================================
// Square Payment Service
// ===========================================

import { Client, Environment, ApiError } from 'square';
import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Get Square client for a company
async function getSquareClient(companyId: string): Promise<Client> {
  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.squareEnabled || !settings.squareAccessToken) {
    throw new Error('Square is not configured for this company');
  }

  return new Client({
    accessToken: settings.squareAccessToken,
    environment: settings.squareTestMode ? Environment.Sandbox : Environment.Production
  });
}

// Get company's Square configuration
async function getSquareConfig(companyId: string) {
  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.squareEnabled) {
    throw new Error('Square is not configured for this company');
  }

  return {
    applicationId: settings.squareApplicationId,
    accessToken: settings.squareAccessToken,
    testMode: settings.squareTestMode
  };
}

// ===========================================
// LOCATION MANAGEMENT
// ===========================================

export async function listLocations(companyId: string): Promise<{
  locations: Array<{
    id: string;
    name: string;
    address?: string;
  }>;
}> {
  const client = await getSquareClient(companyId);

  const response = await client.locationsApi.listLocations();

  const locations = response.result.locations?.map(loc => ({
    id: loc.id || '',
    name: loc.name || '',
    address: loc.address?.addressLine1
  })) || [];

  return { locations };
}

// ===========================================
// PAYMENT PROCESSING
// ===========================================

export async function createPayment(
  companyId: string,
  sourceId: string, // Card nonce or customer card ID
  amount: number, // in cents
  currency: string = 'USD',
  locationId: string,
  customerId?: string,
  note?: string,
  metadata?: Record<string, string>
): Promise<{
  paymentId: string;
  status: string;
  receiptUrl?: string;
}> {
  const client = await getSquareClient(companyId);

  const response = await client.paymentsApi.createPayment({
    idempotencyKey: uuidv4(),
    sourceId,
    amountMoney: {
      amount: BigInt(amount),
      currency
    },
    locationId,
    customerId,
    note,
    referenceId: metadata ? JSON.stringify(metadata) : undefined
  });

  const payment = response.result.payment;

  logInfo('Square payment created', {
    companyId,
    paymentId: payment?.id,
    amount,
    status: payment?.status
  });

  // Record the transaction
  if (payment) {
    await recordSquareTransaction(companyId, {
      externalId: payment.id || '',
      amount: Number(payment.amountMoney?.amount || 0),
      currency: payment.amountMoney?.currency || 'USD',
      status: payment.status === 'COMPLETED' ? 'succeeded' : payment.status?.toLowerCase() || 'pending',
      receiptUrl: payment.receiptUrl
    });
  }

  return {
    paymentId: payment?.id || '',
    status: payment?.status || 'UNKNOWN',
    receiptUrl: payment?.receiptUrl
  };
}

export async function getPayment(
  companyId: string,
  paymentId: string
): Promise<{
  paymentId: string;
  status: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
}> {
  const client = await getSquareClient(companyId);

  const response = await client.paymentsApi.getPayment(paymentId);
  const payment = response.result.payment;

  return {
    paymentId: payment?.id || '',
    status: payment?.status || 'UNKNOWN',
    amount: Number(payment?.amountMoney?.amount || 0),
    currency: payment?.amountMoney?.currency || 'USD',
    receiptUrl: payment?.receiptUrl
  };
}

export async function cancelPayment(
  companyId: string,
  paymentId: string
): Promise<{
  success: boolean;
  status: string;
}> {
  const client = await getSquareClient(companyId);

  const response = await client.paymentsApi.cancelPayment(paymentId);
  const payment = response.result.payment;

  logInfo('Square payment cancelled', {
    companyId,
    paymentId,
    status: payment?.status
  });

  return {
    success: payment?.status === 'CANCELED',
    status: payment?.status || 'UNKNOWN'
  };
}

// ===========================================
// REFUNDS
// ===========================================

export async function refundPayment(
  companyId: string,
  paymentId: string,
  amount?: number, // in cents, partial refund if provided
  reason?: string
): Promise<{
  refundId: string;
  status: string;
  amount: number;
}> {
  const client = await getSquareClient(companyId);

  // Get the original payment to determine amount if not provided
  let refundAmount = amount;
  if (!refundAmount) {
    const paymentResponse = await client.paymentsApi.getPayment(paymentId);
    refundAmount = Number(paymentResponse.result.payment?.amountMoney?.amount || 0);
  }

  const response = await client.refundsApi.refundPayment({
    idempotencyKey: uuidv4(),
    paymentId,
    amountMoney: {
      amount: BigInt(refundAmount),
      currency: 'USD'
    },
    reason
  });

  const refund = response.result.refund;

  logInfo('Square refund created', {
    companyId,
    refundId: refund?.id,
    paymentId,
    amount: refundAmount
  });

  // Record the refund transaction
  if (refund) {
    await recordSquareTransaction(companyId, {
      externalId: refund.id || '',
      amount: Number(refund.amountMoney?.amount || 0),
      currency: refund.amountMoney?.currency || 'USD',
      status: 'refunded',
      type: 'refund'
    });
  }

  return {
    refundId: refund?.id || '',
    status: refund?.status || 'UNKNOWN',
    amount: Number(refund?.amountMoney?.amount || 0)
  };
}

// ===========================================
// CUSTOMER MANAGEMENT
// ===========================================

export async function createCustomer(
  companyId: string,
  email: string,
  givenName?: string,
  familyName?: string,
  phoneNumber?: string
): Promise<{
  customerId: string;
}> {
  const client = await getSquareClient(companyId);

  const response = await client.customersApi.createCustomer({
    idempotencyKey: uuidv4(),
    emailAddress: email,
    givenName,
    familyName,
    phoneNumber
  });

  const customer = response.result.customer;

  logInfo('Square customer created', {
    companyId,
    customerId: customer?.id,
    email
  });

  return {
    customerId: customer?.id || ''
  };
}

export async function getCustomer(
  companyId: string,
  customerId: string
): Promise<{
  customerId: string;
  email?: string;
  name?: string;
} | null> {
  const client = await getSquareClient(companyId);

  try {
    const response = await client.customersApi.retrieveCustomer(customerId);
    const customer = response.result.customer;

    return {
      customerId: customer?.id || '',
      email: customer?.emailAddress,
      name: [customer?.givenName, customer?.familyName].filter(Boolean).join(' ')
    };
  } catch (error) {
    logError('Failed to retrieve Square customer', error as Error);
    return null;
  }
}

// ===========================================
// CARD ON FILE
// ===========================================

export async function createCard(
  companyId: string,
  customerId: string,
  sourceId: string, // Card nonce
  cardholderName?: string
): Promise<{
  cardId: string;
  last4: string;
  cardBrand: string;
}> {
  const client = await getSquareClient(companyId);

  const response = await client.cardsApi.createCard({
    idempotencyKey: uuidv4(),
    sourceId,
    card: {
      customerId,
      cardholderName
    }
  });

  const card = response.result.card;

  logInfo('Square card created', {
    companyId,
    customerId,
    cardId: card?.id
  });

  return {
    cardId: card?.id || '',
    last4: card?.last4 || '',
    cardBrand: card?.cardBrand || ''
  };
}

// ===========================================
// CHECKOUT LINKS
// ===========================================

export async function createCheckoutLink(
  companyId: string,
  locationId: string,
  items: Array<{
    name: string;
    quantity: number;
    basePriceMoney: { amount: number; currency: string };
  }>,
  redirectUrl?: string
): Promise<{
  checkoutId: string;
  checkoutUrl: string;
}> {
  const client = await getSquareClient(companyId);

  const response = await client.checkoutApi.createPaymentLink({
    idempotencyKey: uuidv4(),
    quickPay: {
      name: items[0]?.name || 'Order',
      priceMoney: {
        amount: BigInt(items.reduce((sum, item) => sum + item.basePriceMoney.amount * item.quantity, 0)),
        currency: items[0]?.basePriceMoney.currency || 'USD'
      },
      locationId
    },
    checkoutOptions: {
      redirectUrl
    }
  });

  const link = response.result.paymentLink;

  logInfo('Square checkout link created', {
    companyId,
    checkoutId: link?.id
  });

  return {
    checkoutId: link?.id || '',
    checkoutUrl: link?.url || ''
  };
}

// ===========================================
// TRANSACTION RECORDING
// ===========================================

async function recordSquareTransaction(
  companyId: string,
  data: {
    externalId: string;
    amount: number;
    currency: string;
    status: string;
    type?: string;
    receiptUrl?: string;
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
      metadata: {
        provider: 'square',
        receiptUrl: data.receiptUrl,
        ...data.metadata
      }
    }
  });

  logInfo('Square transaction recorded', {
    companyId,
    externalId: data.externalId,
    status: data.status
  });
}

// ===========================================
// WEBHOOK HANDLING
// ===========================================

export async function handleSquareWebhook(
  companyId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  const dataObj = data.object as Record<string, unknown> | undefined;

  switch (eventType) {
    case 'payment.completed': {
      const payment = dataObj?.payment as Record<string, unknown> | undefined;
      if (payment) {
        const amountMoney = payment.amount_money as { amount: number; currency: string };
        await recordSquareTransaction(companyId, {
          externalId: payment.id as string,
          amount: amountMoney?.amount || 0,
          currency: amountMoney?.currency || 'USD',
          status: 'succeeded',
          type: 'payment'
        });
      }
      break;
    }
    case 'payment.failed': {
      const payment = dataObj?.payment as Record<string, unknown> | undefined;
      if (payment) {
        const amountMoney = payment.amount_money as { amount: number; currency: string };
        await recordSquareTransaction(companyId, {
          externalId: payment.id as string,
          amount: amountMoney?.amount || 0,
          currency: amountMoney?.currency || 'USD',
          status: 'failed',
          type: 'payment'
        });
      }
      break;
    }
    case 'refund.created':
    case 'refund.updated': {
      const refund = dataObj?.refund as Record<string, unknown> | undefined;
      if (refund) {
        const amountMoney = refund.amount_money as { amount: number; currency: string };
        await recordSquareTransaction(companyId, {
          externalId: refund.id as string,
          amount: amountMoney?.amount || 0,
          currency: amountMoney?.currency || 'USD',
          status: 'refunded',
          type: 'refund'
        });
      }
      break;
    }
    default:
      logInfo('Unhandled Square webhook event', { eventType });
  }
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testSquareConnection(companyId: string): Promise<{
  success: boolean;
  message: string;
  locations?: Array<{ id: string; name: string }>;
  testMode?: boolean;
}> {
  try {
    const config = await getSquareConfig(companyId);
    const client = await getSquareClient(companyId);

    // Test the connection by listing locations
    const response = await client.locationsApi.listLocations();
    const locations = response.result.locations?.map(loc => ({
      id: loc.id || '',
      name: loc.name || ''
    })) || [];

    return {
      success: true,
      message: `Square ${config.testMode ? 'Sandbox' : 'Production'} connection successful. Found ${locations.length} location(s).`,
      locations,
      testMode: config.testMode
    };
  } catch (error) {
    const err = error as Error;
    let message = err.message;

    if (error instanceof ApiError) {
      message = error.errors?.map(e => e.detail).join(', ') || message;
    }

    return {
      success: false,
      message: `Square connection failed: ${message}`
    };
  }
}
