// ===========================================
// Authorize.net Payment Service
// ===========================================

import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';

// Import Authorize.net SDK
const AuthorizeNet = require('authorizenet');
const ApiContracts = AuthorizeNet.APIContracts;
const ApiControllers = AuthorizeNet.APIControllers;
const Constants = AuthorizeNet.Constants;

// Get Authorize.net configuration from database
async function getAuthorizeConfig(companyId: string) {
  const settings = await prisma.companyPaymentSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.authorizeEnabled || !settings.authorizeApiLoginId || !settings.authorizeTransactionKey) {
    throw new Error('Authorize.net is not configured for this company');
  }

  return {
    apiLoginId: settings.authorizeApiLoginId,
    transactionKey: settings.authorizeTransactionKey,
    testMode: settings.authorizeTestMode
  };
}

// Create merchant authentication
async function getMerchantAuthentication(companyId: string) {
  const config = await getAuthorizeConfig(companyId);

  const merchantAuth = new ApiContracts.MerchantAuthenticationType();
  merchantAuth.setName(config.apiLoginId);
  merchantAuth.setTransactionKey(config.transactionKey);

  return { merchantAuth, testMode: config.testMode };
}

// Execute controller as promise
function executeController(ctrl: unknown, testMode: boolean): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (testMode) {
      (ctrl as { setEnvironment: (env: unknown) => void }).setEnvironment(Constants.endpoint.sandbox);
    }

    (ctrl as { execute: (callback: () => void) => void }).execute(() => {
      const response = (ctrl as { getResponse: () => unknown }).getResponse();
      if (response) {
        resolve(response);
      } else {
        reject(new Error('No response from Authorize.net'));
      }
    });
  });
}

// ===========================================
// CHARGE CREDIT CARD
// ===========================================

export async function chargeCard(
  companyId: string,
  amount: number, // in dollars
  cardNumber: string,
  expirationDate: string, // MMYY format
  cardCode: string,
  options?: {
    customerEmail?: string;
    customerName?: string;
    orderId?: string;
    description?: string;
    invoiceNumber?: string;
  }
): Promise<{
  transactionId: string;
  authCode: string;
  status: string;
  message: string;
}> {
  const { merchantAuth, testMode } = await getMerchantAuthentication(companyId);

  // Credit card
  const creditCard = new ApiContracts.CreditCardType();
  creditCard.setCardNumber(cardNumber);
  creditCard.setExpirationDate(expirationDate);
  creditCard.setCardCode(cardCode);

  const paymentType = new ApiContracts.PaymentType();
  paymentType.setCreditCard(creditCard);

  // Order
  const orderDetails = new ApiContracts.OrderType();
  if (options?.invoiceNumber) orderDetails.setInvoiceNumber(options.invoiceNumber);
  if (options?.description) orderDetails.setDescription(options.description);

  // Customer
  if (options?.customerEmail) {
    const customer = new ApiContracts.CustomerDataType();
    customer.setEmail(options.customerEmail);
  }

  // Transaction request
  const transactionRequest = new ApiContracts.TransactionRequestType();
  transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
  transactionRequest.setPayment(paymentType);
  transactionRequest.setAmount(amount.toFixed(2));
  transactionRequest.setOrder(orderDetails);

  const createRequest = new ApiContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
  const response = await executeController(ctrl, testMode) as {
    getTransactionResponse: () => {
      getTransId: () => string;
      getAuthCode: () => string;
      getResponseCode: () => string;
      getMessages: () => { getMessage: () => Array<{ getDescription: () => string }> };
      getErrors: () => { getError: () => Array<{ getErrorText: () => string }> } | null;
    } | null;
    getMessages: () => {
      getResultCode: () => string;
      getMessage: () => Array<{ getText: () => string }>;
    };
  };

  const transactionResponse = response.getTransactionResponse();

  if (transactionResponse && transactionResponse.getResponseCode() === '1') {
    const transactionId = transactionResponse.getTransId();
    const authCode = transactionResponse.getAuthCode();

    logInfo('Authorize.net charge successful', {
      companyId,
      transactionId,
      amount
    });

    // Record the transaction
    await recordTransaction(companyId, {
      externalId: transactionId,
      amount: amount * 100, // Convert to cents for consistency
      currency: 'USD',
      status: 'succeeded',
      type: 'payment'
    });

    return {
      transactionId,
      authCode,
      status: 'succeeded',
      message: transactionResponse.getMessages()?.getMessage()?.[0]?.getDescription() || 'Transaction approved'
    };
  } else {
    const errorMessage = transactionResponse?.getErrors()?.getError()?.[0]?.getErrorText() ||
      response.getMessages()?.getMessage()?.[0]?.getText() ||
      'Transaction failed';

    logError('Authorize.net charge failed', new Error(errorMessage));

    return {
      transactionId: '',
      authCode: '',
      status: 'failed',
      message: errorMessage
    };
  }
}

// ===========================================
// AUTHORIZE ONLY (no capture)
// ===========================================

export async function authorizeCard(
  companyId: string,
  amount: number,
  cardNumber: string,
  expirationDate: string,
  cardCode: string,
  options?: {
    customerEmail?: string;
    description?: string;
  }
): Promise<{
  transactionId: string;
  authCode: string;
  status: string;
  message: string;
}> {
  const { merchantAuth, testMode } = await getMerchantAuthentication(companyId);

  const creditCard = new ApiContracts.CreditCardType();
  creditCard.setCardNumber(cardNumber);
  creditCard.setExpirationDate(expirationDate);
  creditCard.setCardCode(cardCode);

  const paymentType = new ApiContracts.PaymentType();
  paymentType.setCreditCard(creditCard);

  const transactionRequest = new ApiContracts.TransactionRequestType();
  transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHONLYTRANSACTION);
  transactionRequest.setPayment(paymentType);
  transactionRequest.setAmount(amount.toFixed(2));

  const createRequest = new ApiContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
  const response = await executeController(ctrl, testMode) as {
    getTransactionResponse: () => {
      getTransId: () => string;
      getAuthCode: () => string;
      getResponseCode: () => string;
      getMessages: () => { getMessage: () => Array<{ getDescription: () => string }> };
      getErrors: () => { getError: () => Array<{ getErrorText: () => string }> } | null;
    } | null;
    getMessages: () => {
      getResultCode: () => string;
      getMessage: () => Array<{ getText: () => string }>;
    };
  };

  const transactionResponse = response.getTransactionResponse();

  if (transactionResponse && transactionResponse.getResponseCode() === '1') {
    logInfo('Authorize.net auth successful', {
      companyId,
      transactionId: transactionResponse.getTransId(),
      amount
    });

    return {
      transactionId: transactionResponse.getTransId(),
      authCode: transactionResponse.getAuthCode(),
      status: 'authorized',
      message: 'Authorization successful'
    };
  } else {
    const errorMessage = transactionResponse?.getErrors()?.getError()?.[0]?.getErrorText() ||
      'Authorization failed';

    return {
      transactionId: '',
      authCode: '',
      status: 'failed',
      message: errorMessage
    };
  }
}

// ===========================================
// CAPTURE PREVIOUSLY AUTHORIZED TRANSACTION
// ===========================================

export async function captureTransaction(
  companyId: string,
  transactionId: string,
  amount?: number
): Promise<{
  transactionId: string;
  status: string;
  message: string;
}> {
  const { merchantAuth, testMode } = await getMerchantAuthentication(companyId);

  const transactionRequest = new ApiContracts.TransactionRequestType();
  transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.PRIORAUTHCAPTURETRANSACTION);
  transactionRequest.setRefTransId(transactionId);
  if (amount) {
    transactionRequest.setAmount(amount.toFixed(2));
  }

  const createRequest = new ApiContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
  const response = await executeController(ctrl, testMode) as {
    getTransactionResponse: () => {
      getTransId: () => string;
      getResponseCode: () => string;
      getErrors: () => { getError: () => Array<{ getErrorText: () => string }> } | null;
    } | null;
    getMessages: () => {
      getMessage: () => Array<{ getText: () => string }>;
    };
  };

  const transactionResponse = response.getTransactionResponse();

  if (transactionResponse && transactionResponse.getResponseCode() === '1') {
    logInfo('Authorize.net capture successful', { companyId, transactionId });

    // Record the capture
    await recordTransaction(companyId, {
      externalId: transactionResponse.getTransId(),
      amount: (amount || 0) * 100,
      currency: 'USD',
      status: 'succeeded',
      type: 'capture'
    });

    return {
      transactionId: transactionResponse.getTransId(),
      status: 'captured',
      message: 'Capture successful'
    };
  } else {
    const errorMessage = transactionResponse?.getErrors()?.getError()?.[0]?.getErrorText() ||
      'Capture failed';

    return {
      transactionId: '',
      status: 'failed',
      message: errorMessage
    };
  }
}

// ===========================================
// REFUND TRANSACTION
// ===========================================

export async function refundTransaction(
  companyId: string,
  transactionId: string,
  amount: number,
  cardNumber: string // Last 4 digits
): Promise<{
  refundId: string;
  status: string;
  message: string;
}> {
  const { merchantAuth, testMode } = await getMerchantAuthentication(companyId);

  // For refunds, only last 4 digits of card needed
  const creditCard = new ApiContracts.CreditCardType();
  creditCard.setCardNumber(cardNumber);
  creditCard.setExpirationDate('XXXX'); // Dummy value for refunds

  const paymentType = new ApiContracts.PaymentType();
  paymentType.setCreditCard(creditCard);

  const transactionRequest = new ApiContracts.TransactionRequestType();
  transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.REFUNDTRANSACTION);
  transactionRequest.setPayment(paymentType);
  transactionRequest.setAmount(amount.toFixed(2));
  transactionRequest.setRefTransId(transactionId);

  const createRequest = new ApiContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
  const response = await executeController(ctrl, testMode) as {
    getTransactionResponse: () => {
      getTransId: () => string;
      getResponseCode: () => string;
      getErrors: () => { getError: () => Array<{ getErrorText: () => string }> } | null;
    } | null;
    getMessages: () => {
      getMessage: () => Array<{ getText: () => string }>;
    };
  };

  const transactionResponse = response.getTransactionResponse();

  if (transactionResponse && transactionResponse.getResponseCode() === '1') {
    const refundId = transactionResponse.getTransId();

    logInfo('Authorize.net refund successful', {
      companyId,
      refundId,
      originalTransactionId: transactionId,
      amount
    });

    // Record the refund
    await recordTransaction(companyId, {
      externalId: refundId,
      amount: amount * 100,
      currency: 'USD',
      status: 'refunded',
      type: 'refund'
    });

    return {
      refundId,
      status: 'refunded',
      message: 'Refund successful'
    };
  } else {
    const errorMessage = transactionResponse?.getErrors()?.getError()?.[0]?.getErrorText() ||
      'Refund failed';

    return {
      refundId: '',
      status: 'failed',
      message: errorMessage
    };
  }
}

// ===========================================
// VOID TRANSACTION
// ===========================================

export async function voidTransaction(
  companyId: string,
  transactionId: string
): Promise<{
  status: string;
  message: string;
}> {
  const { merchantAuth, testMode } = await getMerchantAuthentication(companyId);

  const transactionRequest = new ApiContracts.TransactionRequestType();
  transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.VOIDTRANSACTION);
  transactionRequest.setRefTransId(transactionId);

  const createRequest = new ApiContracts.CreateTransactionRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setTransactionRequest(transactionRequest);

  const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
  const response = await executeController(ctrl, testMode) as {
    getTransactionResponse: () => {
      getResponseCode: () => string;
      getErrors: () => { getError: () => Array<{ getErrorText: () => string }> } | null;
    } | null;
    getMessages: () => {
      getMessage: () => Array<{ getText: () => string }>;
    };
  };

  const transactionResponse = response.getTransactionResponse();

  if (transactionResponse && transactionResponse.getResponseCode() === '1') {
    logInfo('Authorize.net void successful', { companyId, transactionId });

    return {
      status: 'voided',
      message: 'Transaction voided successfully'
    };
  } else {
    const errorMessage = transactionResponse?.getErrors()?.getError()?.[0]?.getErrorText() ||
      'Void failed';

    return {
      status: 'failed',
      message: errorMessage
    };
  }
}

// ===========================================
// GET TRANSACTION DETAILS
// ===========================================

export async function getTransactionDetails(
  companyId: string,
  transactionId: string
): Promise<{
  transactionId: string;
  status: string;
  amount: number;
  submitTimeLocal: string;
  cardNumber?: string;
  cardType?: string;
} | null> {
  const { merchantAuth, testMode } = await getMerchantAuthentication(companyId);

  const getRequest = new ApiContracts.GetTransactionDetailsRequest();
  getRequest.setMerchantAuthentication(merchantAuth);
  getRequest.setTransId(transactionId);

  const ctrl = new ApiControllers.GetTransactionDetailsController(getRequest.getJSON());
  const response = await executeController(ctrl, testMode) as {
    getTransaction: () => {
      getTransId: () => string;
      getTransactionStatus: () => string;
      getSettleAmount: () => string;
      getSubmitTimeLocal: () => string;
      getPayment: () => {
        getCreditCard: () => {
          getCardNumber: () => string;
          getCardType: () => string;
        };
      };
    } | null;
    getMessages: () => {
      getResultCode: () => string;
    };
  };

  if (response.getMessages().getResultCode() === 'Ok') {
    const transaction = response.getTransaction();
    if (transaction) {
      return {
        transactionId: transaction.getTransId(),
        status: transaction.getTransactionStatus(),
        amount: parseFloat(transaction.getSettleAmount()) * 100,
        submitTimeLocal: transaction.getSubmitTimeLocal(),
        cardNumber: transaction.getPayment()?.getCreditCard()?.getCardNumber(),
        cardType: transaction.getPayment()?.getCreditCard()?.getCardType()
      };
    }
  }

  return null;
}

// ===========================================
// CUSTOMER PROFILES (CIM)
// ===========================================

export async function createCustomerProfile(
  companyId: string,
  email: string,
  description?: string
): Promise<{
  customerProfileId: string;
}> {
  const { merchantAuth, testMode } = await getMerchantAuthentication(companyId);

  const customerProfile = new ApiContracts.CustomerProfileType();
  customerProfile.setEmail(email);
  if (description) customerProfile.setDescription(description);

  const createRequest = new ApiContracts.CreateCustomerProfileRequest();
  createRequest.setMerchantAuthentication(merchantAuth);
  createRequest.setProfile(customerProfile);

  const ctrl = new ApiControllers.CreateCustomerProfileController(createRequest.getJSON());
  const response = await executeController(ctrl, testMode) as {
    getCustomerProfileId: () => string;
    getMessages: () => {
      getResultCode: () => string;
      getMessage: () => Array<{ getText: () => string }>;
    };
  };

  if (response.getMessages().getResultCode() === 'Ok') {
    const profileId = response.getCustomerProfileId();
    logInfo('Authorize.net customer profile created', { companyId, profileId, email });

    return {
      customerProfileId: profileId
    };
  } else {
    throw new Error(response.getMessages().getMessage()[0].getText());
  }
}

export async function deleteCustomerProfile(
  companyId: string,
  customerProfileId: string
): Promise<void> {
  const { merchantAuth, testMode } = await getMerchantAuthentication(companyId);

  const deleteRequest = new ApiContracts.DeleteCustomerProfileRequest();
  deleteRequest.setMerchantAuthentication(merchantAuth);
  deleteRequest.setCustomerProfileId(customerProfileId);

  const ctrl = new ApiControllers.DeleteCustomerProfileController(deleteRequest.getJSON());
  await executeController(ctrl, testMode);

  logInfo('Authorize.net customer profile deleted', { companyId, customerProfileId });
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
        metadata: { provider: 'authorize' }
      }
    });
    logInfo('Authorize.net transaction recorded', { companyId, externalId: data.externalId, status: data.status });
  } catch (error) {
    logError('Failed to record Authorize.net transaction', error as Error);
  }
}

// ===========================================
// WEBHOOK HANDLING
// ===========================================

export async function handleWebhookEvent(
  companyId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ handled: boolean; type: string }> {
  logInfo('Authorize.net webhook received', { companyId, eventType });

  switch (eventType) {
    case 'net.authorize.payment.authcapture.created':
    case 'net.authorize.payment.capture.created': {
      const transId = payload.transId as string;
      const amount = parseFloat(payload.amount as string) * 100;

      await recordTransaction(companyId, {
        externalId: transId,
        amount,
        currency: 'USD',
        status: 'succeeded',
        type: 'payment'
      });
      return { handled: true, type: eventType };
    }

    case 'net.authorize.payment.refund.created': {
      const transId = payload.transId as string;
      const amount = parseFloat(payload.amount as string) * 100;

      await recordTransaction(companyId, {
        externalId: transId,
        amount,
        currency: 'USD',
        status: 'refunded',
        type: 'refund'
      });
      return { handled: true, type: eventType };
    }

    case 'net.authorize.payment.void.created': {
      logInfo('Authorize.net transaction voided', { companyId, transId: payload.transId });
      return { handled: true, type: eventType };
    }

    case 'net.authorize.payment.fraud.declined': {
      const transId = payload.transId as string;
      logInfo('Authorize.net fraud decline', { companyId, transId });
      return { handled: true, type: eventType };
    }

    default:
      logInfo('Unhandled Authorize.net webhook event', { companyId, eventType });
      return { handled: false, type: eventType };
  }
}

// ===========================================
// TEST CONNECTION
// ===========================================

export async function testAuthorizeConnection(companyId: string): Promise<{
  success: boolean;
  message: string;
  testMode?: boolean;
}> {
  try {
    const { merchantAuth, testMode } = await getMerchantAuthentication(companyId);

    const getRequest = new ApiContracts.GetMerchantDetailsRequest();
    getRequest.setMerchantAuthentication(merchantAuth);

    const ctrl = new ApiControllers.GetMerchantDetailsController(getRequest.getJSON());
    const response = await executeController(ctrl, testMode) as {
      getMessages: () => {
        getResultCode: () => string;
        getMessage: () => Array<{ getText: () => string }>;
      };
      getMerchantName?: () => string;
    };

    if (response.getMessages().getResultCode() === 'Ok') {
      const merchantName = response.getMerchantName?.() || 'Unknown';

      return {
        success: true,
        message: `Connected to Authorize.net${testMode ? ' (Sandbox)' : ''}: ${merchantName}`,
        testMode
      };
    } else {
      return {
        success: false,
        message: `Authorize.net connection failed: ${response.getMessages().getMessage()[0].getText()}`
      };
    }
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `Authorize.net connection failed: ${err.message}`
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
    return settings?.authorizeEnabled || false;
  } catch {
    return false;
  }
}
