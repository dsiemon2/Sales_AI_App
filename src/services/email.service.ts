// ===========================================
// Email Service
// Handles all email notifications
// ===========================================

import nodemailer from 'nodemailer';
import { logInfo, logError } from '../utils/logger';
import prisma from '../config/database';

// Email configuration interface
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  fromName: string;
  fromEmail: string;
}

// Get email configuration from database or environment
async function getEmailConfig(): Promise<EmailConfig> {
  // Try to get from database first
  const settings = await prisma.emailSettings.findFirst();

  if (settings?.smtpHost && settings?.smtpUsername && settings?.smtpPassword) {
    return {
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpEncryption === 'ssl' || settings.smtpEncryption === 'tls',
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword
      },
      fromName: settings.fromName || 'Apex Sales Training',
      fromEmail: settings.fromEmail || 'noreply@apexsalesai.com'
    };
  }

  // Fall back to environment variables
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    fromName: process.env.EMAIL_FROM_NAME || 'Apex Sales Training',
    fromEmail: process.env.EMAIL_FROM_ADDRESS || 'noreply@apexsalesai.com'
  };
}

// Create nodemailer transporter
async function createTransporter() {
  const config = await getEmailConfig();

  if (!config.auth.user || !config.auth.pass) {
    logError('Email not configured', new Error('Missing SMTP credentials'));
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });
}

// ===========================================
// PASSWORD RESET EMAIL
// ===========================================

export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  resetToken: string,
  baseUrl: string
): Promise<boolean> {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      logInfo('Email sending skipped - not configured', { email });
      return false;
    }

    const config = await getEmailConfig();
    const resetUrl = `${baseUrl}/auth/reset-password/${resetToken}`;

    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: email,
      subject: 'Reset Your Password - Apex Sales Training',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0B1F3B, #1a365d); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #FF6A00; margin: 0;">Apex Sales Training</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #0B1F3B;">Password Reset Request</h2>

            <p>Hi ${firstName},</p>

            <p>We received a request to reset your password. Click the button below to create a new password:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #FF6A00; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>

            <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>

            <p style="color: #666; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #FF6A00;">${resetUrl}</a>
            </p>
          </div>

          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} Apex Sales Training. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Hi ${firstName},

        We received a request to reset your password for your Apex Sales Training account.

        Click this link to reset your password:
        ${resetUrl}

        This link will expire in 1 hour.

        If you didn't request this password reset, you can safely ignore this email.

        - Apex Sales Training Team
      `
    };

    await transporter.sendMail(mailOptions);
    logInfo('Password reset email sent', { email });
    return true;
  } catch (error) {
    logError('Failed to send password reset email', error as Error, { email });
    return false;
  }
}

// ===========================================
// WELCOME EMAIL
// ===========================================

export async function sendWelcomeEmail(
  email: string,
  firstName: string,
  companyName: string | null,
  baseUrl: string
): Promise<boolean> {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      logInfo('Email sending skipped - not configured', { email });
      return false;
    }

    const config = await getEmailConfig();
    const loginUrl = `${baseUrl}/auth/login`;

    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: email,
      subject: 'Welcome to Apex Sales Training!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0B1F3B, #1a365d); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #FF6A00; margin: 0;">Welcome to Apex Sales Training!</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #0B1F3B;">Hi ${firstName}!</h2>

            <p>Your account has been created successfully${companyName ? ` for <strong>${companyName}</strong>` : ''}.</p>

            <p>You now have access to AI-powered sales training that will help you:</p>

            <ul style="color: #555;">
              <li>Practice sales conversations with our AI coach</li>
              <li>Master objection handling techniques</li>
              <li>Improve your closing strategies</li>
              <li>Track your progress with detailed analytics</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: #FF6A00; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Start Training
              </a>
            </div>

            <p>Need help getting started? Check out our <a href="${baseUrl}/features" style="color: #FF6A00;">Features Guide</a>.</p>
          </div>

          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} Apex Sales Training. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Hi ${firstName}!

        Welcome to Apex Sales Training! Your account has been created successfully${companyName ? ` for ${companyName}` : ''}.

        You now have access to AI-powered sales training that will help you:
        - Practice sales conversations with our AI coach
        - Master objection handling techniques
        - Improve your closing strategies
        - Track your progress with detailed analytics

        Login here to start training: ${loginUrl}

        - Apex Sales Training Team
      `
    };

    await transporter.sendMail(mailOptions);
    logInfo('Welcome email sent', { email });
    return true;
  } catch (error) {
    logError('Failed to send welcome email', error as Error, { email });
    return false;
  }
}

// ===========================================
// SESSION SUMMARY EMAIL
// ===========================================

export async function sendSessionSummaryEmail(
  email: string,
  firstName: string,
  sessionData: {
    duration: number;
    score: number;
    strengths: string[];
    improvements: string[];
  },
  baseUrl: string
): Promise<boolean> {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      logInfo('Email sending skipped - not configured', { email });
      return false;
    }

    const config = await getEmailConfig();
    const dashboardUrl = `${baseUrl}/admin/sessions`;

    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: email,
      subject: 'Your Training Session Summary - Apex Sales Training',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0B1F3B, #1a365d); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #FF6A00; margin: 0;">Training Session Complete!</h1>
          </div>

          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #0B1F3B;">Great work, ${firstName}!</h2>

            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Session Stats</h3>
              <p><strong>Duration:</strong> ${Math.round(sessionData.duration / 60)} minutes</p>
              <p><strong>Performance Score:</strong> <span style="color: ${sessionData.score >= 70 ? '#28a745' : sessionData.score >= 50 ? '#ffc107' : '#dc3545'}; font-size: 24px; font-weight: bold;">${sessionData.score}%</span></p>
            </div>

            ${sessionData.strengths.length > 0 ? `
            <div style="background: #d4edda; padding: 15px; border-radius: 10px; margin: 15px 0;">
              <h4 style="color: #155724; margin-top: 0;">Strengths</h4>
              <ul style="margin-bottom: 0;">
                ${sessionData.strengths.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>
            ` : ''}

            ${sessionData.improvements.length > 0 ? `
            <div style="background: #fff3cd; padding: 15px; border-radius: 10px; margin: 15px 0;">
              <h4 style="color: #856404; margin-top: 0;">Areas for Improvement</h4>
              <ul style="margin-bottom: 0;">
                ${sessionData.improvements.map(i => `<li>${i}</li>`).join('')}
              </ul>
            </div>
            ` : ''}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl}" style="background: #FF6A00; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                View Full Report
              </a>
            </div>
          </div>

          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} Apex Sales Training. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Great work, ${firstName}!

        Your training session is complete.

        Session Stats:
        - Duration: ${Math.round(sessionData.duration / 60)} minutes
        - Performance Score: ${sessionData.score}%

        ${sessionData.strengths.length > 0 ? `Strengths:\n${sessionData.strengths.map(s => `- ${s}`).join('\n')}` : ''}

        ${sessionData.improvements.length > 0 ? `Areas for Improvement:\n${sessionData.improvements.map(i => `- ${i}`).join('\n')}` : ''}

        View your full report: ${dashboardUrl}

        - Apex Sales Training Team
      `
    };

    await transporter.sendMail(mailOptions);
    logInfo('Session summary email sent', { email });
    return true;
  } catch (error) {
    logError('Failed to send session summary email', error as Error, { email });
    return false;
  }
}

// ===========================================
// GENERIC EMAIL
// ===========================================

export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  textContent?: string
): Promise<boolean> {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      logInfo('Email sending skipped - not configured', { to });
      return false;
    }

    const config = await getEmailConfig();

    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, '')
    };

    await transporter.sendMail(mailOptions);
    logInfo('Email sent', { to, subject });
    return true;
  } catch (error) {
    logError('Failed to send email', error as Error, { to, subject });
    return false;
  }
}

// ===========================================
// TEST EMAIL CONNECTION
// ===========================================

export async function testEmailConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      return {
        success: false,
        message: 'Email not configured. Please set SMTP credentials in settings or environment variables.'
      };
    }

    await transporter.verify();
    return {
      success: true,
      message: 'Email connection successful!'
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `Email connection failed: ${err.message}`
    };
  }
}
