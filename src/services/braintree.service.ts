// ===========================================
// Braintree Payment Service
// ===========================================

import braintree from 'braintree';
import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';

// Get Braintree configuration from database
async function getBraintreeConfig(companyId: string) {
  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.braintreeEnabled || !settings.braintreeMerchantId || !settings.braintreePublicKey || !settings.braintreePrivateKey) {
    throw new Error('Braintree is not configured for this company');
  }

  return {
    merchantId: settings.braintreeMerchantId,
    publicKey: settings.braintreePublicKey,
    privateKey: settings.braintreePrivateKey,
    testMode: settings.braintreeTestMode
  };
}

// Get Braintree gateway instance
async function getBraintreeGateway(companyId: string): Promise<braintree.BraintreeGateway> {
  const config = await getBraintreeConfig(companyId);

  return new braintree.BraintreeGateway({
    environment: config.testMode ? braintree.Environment.Sandbox : braintree.Environment.Production,
    merchantId: config.merchantId,
    publicKey: config.publicKey,
    privateKey: config.privateKey
  });
}

// ===========================================
// CLIENT TOKEN
// ===========================================

export async function generateClientToken(
  companyId: string,
  customerId?: string
): Promise<string> {
  const gateway = await getBraintreeGateway(companyId);

  const options: braintree.ClientTokenRequest = {};
  if (customerId) {
    options.customerId = customerId;
  }

  const result = await gateway.clientToken.generate(options);

  if (!result.clientToken) {
    throw new Error('Failed to generate client token');
  }

  logInfo('Braintree client token generated', { companyId, customerId });
  return result.clientToken;
}

// ===========================================
// CUSTOMER MANAGEMENT
// ===========================================

export async function createCustomer(
  companyId: string,
  email: string,
  firstName?: string,
  lastName?: string
): Promise<braintree.Customer> {
  const gateway = await getBraintreeGateway(companyId);

  const result = await gateway.customer.create({
    email,
    firstName,
    lastName
  });

  if (!result.success || !result.customer) {
    throw new Error(result.message || 'Failed to create customer');
  }

  logInfo('Braintree customer created', { companyId, customerId: result.customer.id, email });
  return result.customer;
}

export async function getCustomer(
  companyId: string,
  customerId: string
): Promise<braintree.Customer | null> {
  const gateway = await getBraintreeGateway(companyId);

  try {
    return await gateway.customer.find(customerId);
  } catch (error) {
    logError('Failed to find Braintree customer', error as Error);
    return null;
  }
}

export async function updateCustomer(
  companyId: string,
  customerId: string,
  data: { email?: string; firstName?: string; lastName?: string }
): Promise<braintree.Customer> {
  const gateway = await getBraintreeGateway(companyId);

  const result = await gateway.customer.update(customerId, data);

  if (!result.success || !result.customer) {
    throw new Error(result.message || 'Failed to update customer');
  }

  return result.customer;
}

export async function deleteCustomer(
  companyId: string,
  customerId: string
): Promise<void> {
  const gateway = await getBraintreeGateway(companyId);
  await gateway.customer.delete(customerId);
  logInfo('Braintree customer deleted', { companyId, customerId });
}

// ===========================================
// TRANSACTIONS
// ===========================================

export async function createTransaction(
  companyId: string,
  amount: number, // in dollars
  paymentMethodNonce: string,
  options?: {
    customerId?: string;
    orderId?: string;
    deviceData?: string;
    submitForSettlement?: boolean;
  }
): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway(companyId);

  const transactionRequest: braintree.TransactionRequest = {
    amount: amount.toFixed(2),
    paymentMethodNonce,
    options: {
      submitForSettlement: options?.submitForSettlement ?? true
    }
  };

  if (options?.customerId) {
    transactionRequest.customerId = options.customerId;
  }
  if (options?.orderId) {
    transactionRequest.orderId = options.orderId;
  }
  if (options?.deviceData) {
    transactionRequest.deviceData = options.deviceData;
  }

  const result = await gateway.transaction.sale(transactionRequest);

  if (!result.success || !result.transaction) {
    throw new Error(result.message || 'Transaction failed');
  }

  logInfo('Braintree transaction created', {
    companyId,
    transactionId: result.transaction.id,
    amount,
    status: result.transaction.status
  });

  // Record the transaction
  await recordTransaction(companyId, {
    externalId: result.transaction.id,
    amount: parseFloat(result.transaction.amount) * 100, // Convert to cents
    currency: result.transaction.currencyIsoCode || 'USD',
    status: result.transaction.status === 'submitted_for_settlement' ? 'pending' :
            result.transaction.status === 'settled' ? 'succeeded' : result.transaction.status,
    type: 'payment'
  });

  return result.transaction;
}

export async function getTransaction(
  companyId: string,
  transactionId: string
): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway(companyId);
  return gateway.transaction.find(transactionId);
}

export async function voidTransaction(
  companyId: string,
  transactionId: string
): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway(companyId);

  const result = await gateway.transaction.void(transactionId);

  if (!result.success || !result.transaction) {
    throw new Error(result.message || 'Failed to void transaction');
  }

  logInfo('Braintree transaction voided', { companyId, transactionId });
  return result.transaction;
}

export async function submitForSettlement(
  companyId: string,
  transactionId: string,
  amount?: number
): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway(companyId);

  const result = await gateway.transaction.submitForSettlement(
    transactionId,
    amount?.toFixed(2)
  );

  if (!result.success || !result.transaction) {
    throw new Error(result.message || 'Failed to submit for settlement');
  }

  logInfo('Braintree transaction submitted for settlement', { companyId, transactionId });
  return result.transaction;
}

// ===========================================
// REFUNDS
// ===========================================

export async function refundTransaction(
  companyId: string,
  transactionId: string,
  amount?: number // in dollars, partial refund if provided
): Promise<braintree.Transaction> {
  const gateway = await getBraintreeGateway(companyId);

  const result = await gateway.transaction.refund(
    transactionId,
    amount?.toFixed(2)
  );

  if (!result.success || !result.transaction) {
    throw new Error(result.message || 'Refund failed');
  }

  const refundAmount = parseFloat(result.transaction.amount) * 100;

  logInfo('Braintree refund created', {
    companyId,
    transactionId,
    refundId: result.transaction.id,
    amount: refundAmount
  });

  // Record the refund
  await recordTransaction(companyId, {
    externalId: result.transaction.id,
    amount: refundAmount,
    currency: result.transaction.currencyIsoCode || 'USD',
    status: 'refunded',
    type: 'refund'
  });

  return result.transaction;
}

// ===========================================
// SUBSCRIPTIONS
// ===========================================

export async function createSubscription(
  companyId: string,
  paymentMethodToken: string,
  planId: string,
  options?: {
    price?: number;
    firstBillingDate?: Date;
  }
): Promise<braintree.Subscription> {
  const gateway = await getBraintreeGateway(companyId);

  const subscriptionRequest: braintree.SubscriptionRequest = {
    paymentMethodToken,
    planId
  };

  if (options?.price) {
    subscriptionRequest.price = options.price.toFixed(2);
  }
  if (options?.firstBillingDate) {
    subscriptionRequest.firstBillingDate = options.firstBillingDate;
  }

  const result = await gateway.subscription.create(subscriptionRequest);

  if (!result.success || !result.subscription) {
    throw new Error(result.message || 'Failed to create subscription');
  }

  logInfo('Braintree subscription created', {
    companyId,
    subscriptionId: result.subscription.id,
    planId
  });

  return result.subscription;
}

export async function getSubscription(
  companyId: string,
  subscriptionId: string
): Promise<braintree.Subscription> {
  const gateway = await getBraintreeGateway(companyId);
  return gateway.subscription.find(subscriptionId);
}

export async function updateSubscription(
  companyId: string,
  subscriptionId: string,
  data: { price?: number; planId?: string }
): Promise<braintree.Subscription> {
  const gateway = await getBraintreeGateway(companyId);

  const updateRequest: braintree.SubscriptionRequest = {};
  if (data.price) {
    updateRequest.price = data.price.toFixed(2);
  }
  if (data.planId) {
    updateRequest.planId = data.planId;
  }

  const result = await gateway.subscription.update(subscriptionId, updateRequest);

  if (!result.success || !result.subscription) {
    throw new Error(result.message || 'Failed to update subscription');
  }

  return result.subscription;
}

export async function cancelSubscription(
  companyId: string,
  subscriptionId: string
): Promise<braintree.Subscription> {
  const gateway = await getBraintreeGateway(companyId);

  const result = await gateway.subscription.cancel(subscriptionId);

  if (!result.success || !result.subscription) {
    throw new Error(result.message || 'Failed to cancel subscription');
  }

  logInfo('Braintree subscription cancelled', { companyId, subscriptionId });
  return result.subscription;
}

// ===========================================
// PAYMENT METHODS
// ===========================================

export async function createPaymentMethod(
  companyId: string,
  customerId: string,
  paymentMethodNonce: string,
  options?: {
    makeDefault?: boolean;
    verifyCard?: boolean;
  }
): Promise<braintree.PaymentMethod> {
  const gateway = await getBraintreeGateway(companyId);

  const result = await gateway.paymentMethod.create({
    customerId,
    paymentMethodNonce,
    options: {
      makeDefault: options?.makeDefault,
      verifyCard: options?.verifyCard
    }
  });

  if (!result.success || !result.paymentMethod) {
    throw new Error(result.message || 'Failed to create payment method');
  }

  logInfo('Braintree payment method created', {
    companyId,
    customerId,
    paymentMethodToken: result.paymentMethod.token
  });

  return result.paymentMethod;
}

export async function deletePaymentMethod(
  companyId: string,
  token: string
): Promise<void> {
  const gateway = await getBraintreeGateway(companyId);
  await gateway.paymentMethod.delete(token);
  logInfo('Braintree payment method deleted', { companyId, token });
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
  }
): Promise<void> {
  try {
    await prisma.transaction.create({
      data: {
        companyId,
        externalId: data.externalId,
        amount: data.amount,
        currency: data.currency.toUpperCase(),
        status: data.status,
        type: data.type,
        metadata: { provider: 'braintree' }
      }
    });
    logInfo('Braintree transaction recorded', { companyId, externalId: data.externalId, status: data.status });
  } catch (error) {
    logError('Failed to record Braintree transaction', error as Error);
  }
}

// ===========================================
// WEBHOOK HANDLING
// ===========================================

export async function handleWebhookEvent(
  companyId: string,
  signature: string,
  payload: string
): Promise<{ handled: boolean; type: string }> {
  const gateway = await getBraintreeGateway(companyId);

  const webhookNotification = await gateway.webhookNotification.parse(signature, payload);
  const kind = webhookNotification.kind;

  logInfo('Braintree webhook received', { companyId, kind });

  switch (kind) {
    case braintree.WebhookNotification.Kind.SubscriptionCanceled:
    case braintree.WebhookNotification.Kind.SubscriptionExpired:
    case braintree.WebhookNotification.Kind.SubscriptionChargedSuccessfully:
    case braintree.WebhookNotification.Kind.SubscriptionChargedUnsuccessfully:
      logInfo('Braintree subscription event', {
        companyId,
        kind,
        subscriptionId: webhookNotification.subscription?.id
      });
      return { handled: true, type: kind };

    case braintree.WebhookNotification.Kind.TransactionSettled:
    case braintree.WebhookNotification.Kind.TransactionSettlementDeclined:
      logInfo('Braintree transaction event', {
        companyId,
        kind,
        transactionId: webhookNotification.transaction?.id
      });
      return { handled: true, type: kind };

    default:
      logInfo('Unhandled Braintree webhook event', { companyId, kind });
      return { handled: false, type: kind };
  }
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testBraintreeConnection(companyId: string): Promise<{
  success: boolean;
  message: string;
  merchantId?: string;
  testMode?: boolean;
}> {
  try {
    const config = await getBraintreeConfig(companyId);
    const gateway = await getBraintreeGateway(companyId);

    // Test by generating a client token
    const result = await gateway.clientToken.generate({});

    if (!result.clientToken) {
      throw new Error('Failed to generate client token');
    }

    return {
      success: true,
      message: `Connected to Braintree merchant: ${config.merchantId}`,
      merchantId: config.merchantId,
      testMode: config.testMode
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `Braintree connection failed: ${err.message}`
    };
  }
}

// ===========================================
// CONFIGURATION CHECK
// ===========================================

export async function isEnabled(companyId: string): Promise<boolean> {
  try {
    const settings = await prisma.companyPaymentSettings.findUnique({
      where: { companyId }
    });
    return settings?.braintreeEnabled || false;
  } catch {
    return false;
  }
}
