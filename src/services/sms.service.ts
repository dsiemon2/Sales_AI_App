import prisma from '../config/database';
import { logActivity, logError } from '../utils/logger';

// SMS provider types
type SmsProvider = 'twilio' | 'vonage' | 'messagebird';

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SmsConfig {
  provider: SmsProvider;
  fromNumber: string;
  accountSid?: string;
  authToken?: string;
  apiKey?: string;
}

/**
 * Get SMS settings for a company, falling back to environment variables
 */
async function getSmsConfig(companyId: string): Promise<SmsConfig | null> {
  // Try to get company-specific settings
  const settings = await prisma.smsSettings.findUnique({
    where: { companyId }
  });

  if (settings && settings.accountSid && settings.authToken && settings.fromNumber) {
    return {
      provider: settings.provider as SmsProvider,
      fromNumber: settings.fromNumber,
      accountSid: settings.accountSid,
      authToken: settings.authToken
    };
  }

  // Fall back to environment variables
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioToken && twilioNumber) {
    return {
      provider: 'twilio',
      fromNumber: twilioNumber,
      accountSid: twilioSid,
      authToken: twilioToken
    };
  }

  return null;
}

/**
 * Send SMS using Twilio
 */
async function sendTwilioSms(
  config: SmsConfig,
  to: string,
  body: string
): Promise<SmsResult> {
  try {
    // Using native fetch with Twilio REST API
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;

    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: to,
        From: config.fromNumber,
        Body: body
      }).toString()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return {
      success: true,
      messageId: data.sid
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send an SMS message
 */
export async function sendSms(
  companyId: string,
  to: string,
  message: string
): Promise<SmsResult> {
  try {
    const config = await getSmsConfig(companyId);

    if (!config) {
      return {
        success: false,
        error: 'SMS not configured for this company'
      };
    }

    // Normalize phone number
    const normalizedTo = normalizePhoneNumber(to);
    if (!normalizedTo) {
      return {
        success: false,
        error: 'Invalid phone number'
      };
    }

    let result: SmsResult;

    switch (config.provider) {
      case 'twilio':
        result = await sendTwilioSms(config, normalizedTo, message);
        break;
      case 'vonage':
        // Vonage/Nexmo implementation placeholder
        result = { success: false, error: 'Vonage provider not yet implemented' };
        break;
      case 'messagebird':
        // MessageBird implementation placeholder
        result = { success: false, error: 'MessageBird provider not yet implemented' };
        break;
      default:
        result = { success: false, error: 'Unknown SMS provider' };
    }

    if (result.success) {
      logActivity('SMS_SENT', {
        companyId,
        to: normalizedTo.substring(0, 6) + '****', // Mask number
        provider: config.provider,
        messageId: result.messageId
      });
    } else {
      logError('SMS_SEND_FAILED', new Error(result.error || 'Unknown error'), {
        companyId,
        provider: config.provider
      });
    }

    return result;
  } catch (error) {
    logError('SMS_SERVICE_ERROR', error as Error, { companyId });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send welcome SMS when user starts a training session
 */
export async function sendWelcomeSms(
  companyId: string,
  phoneNumber: string,
  firstName: string
): Promise<SmsResult> {
  const settings = await prisma.smsSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.autoWelcome || !settings.welcomeTemplate) {
    return { success: false, error: 'Welcome SMS not configured' };
  }

  const message = interpolateTemplate(settings.welcomeTemplate, {
    firstName,
    companyName: await getCompanyName(companyId)
  });

  return sendSms(companyId, phoneNumber, message);
}

/**
 * Send completion SMS when user finishes a training session
 */
export async function sendCompletionSms(
  companyId: string,
  phoneNumber: string,
  firstName: string,
  sessionData: {
    duration: number;
    score?: number;
  }
): Promise<SmsResult> {
  const settings = await prisma.smsSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.autoComplete || !settings.completeTemplate) {
    return { success: false, error: 'Completion SMS not configured' };
  }

  const message = interpolateTemplate(settings.completeTemplate, {
    firstName,
    companyName: await getCompanyName(companyId),
    duration: Math.round(sessionData.duration / 60), // Convert to minutes
    score: sessionData.score?.toString() || 'N/A'
  });

  return sendSms(companyId, phoneNumber, message);
}

/**
 * Send follow-up SMS after a delay
 */
export async function sendFollowupSms(
  companyId: string,
  phoneNumber: string,
  firstName: string
): Promise<SmsResult> {
  const settings = await prisma.smsSettings.findUnique({
    where: { companyId }
  });

  if (!settings?.autoFollowup || !settings.followupTemplate) {
    return { success: false, error: 'Follow-up SMS not configured' };
  }

  const message = interpolateTemplate(settings.followupTemplate, {
    firstName,
    companyName: await getCompanyName(companyId)
  });

  return sendSms(companyId, phoneNumber, message);
}

/**
 * Test SMS configuration by sending a test message
 */
export async function testSmsConfig(companyId: string, testNumber: string): Promise<SmsResult> {
  const message = 'This is a test message from Apex Sales AI. If you received this, your SMS configuration is working correctly!';
  return sendSms(companyId, testNumber, message);
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string | null {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If no + prefix, assume US number and add +1
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    } else {
      // Try to handle other formats
      cleaned = '+' + cleaned;
    }
  }

  // Validate: should be between 10 and 15 digits after +
  const digits = cleaned.substring(1);
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return cleaned;
}

/**
 * Interpolate template variables
 */
function interpolateTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return result;
}

/**
 * Get company name for template interpolation
 */
async function getCompanyName(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true }
  });
  return company?.name || 'Apex Sales AI';
}

/**
 * Get SMS usage statistics for a company
 */
export async function getSmsStats(companyId: string): Promise<{
  configured: boolean;
  provider: string | null;
  features: {
    welcome: boolean;
    complete: boolean;
    followup: boolean;
  };
}> {
  const settings = await prisma.smsSettings.findUnique({
    where: { companyId }
  });

  const envConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );

  return {
    configured: !!(settings?.accountSid && settings?.authToken) || envConfigured,
    provider: settings?.provider || (envConfigured ? 'twilio' : null),
    features: {
      welcome: !!settings?.autoWelcome,
      complete: !!settings?.autoComplete,
      followup: !!settings?.autoFollowup
    }
  };
}
