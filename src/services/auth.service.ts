import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { logInfo, logError, logSecurity, logAudit } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { PASSWORD_REQUIREMENTS, ROLES, Role } from '../config/constants';
import { sendPasswordResetEmail, sendWelcomeEmail } from './email.service';

const SALT_ROUNDS = 12;

// Validate password strength
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Compare password
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Register a new user
export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyId?: string;
  role?: Role;
  phone?: string;
}, ipAddress: string) {
  try {
    // Validate password
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      throw new AppError(passwordValidation.errors.join('. '), 400);
    }

    // Check if email exists (within company scope)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email.toLowerCase(),
        companyId: data.companyId || null
      }
    });

    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        companyId: data.companyId,
        role: data.role || ROLES.TRAINEE,
        phone: data.phone
      }
    });

    // Log the registration
    logInfo('User registered', { userId: user.id, email: user.email });
    logAudit('CREATE', {
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      ipAddress
    });

    logSecurity('REGISTRATION_SUCCESS', {
      userId: user.id,
      email: user.email,
      ipAddress,
      riskLevel: 'low'
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };
  } catch (error) {
    logError('Registration failed', error as Error, { email: data.email });
    throw error;
  }
}

// Login user
export async function loginUser(email: string, password: string, ipAddress: string, userAgent: string) {
  try {
    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            industryId: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            isActive: true
          }
        }
      }
    });

    if (!user) {
      logSecurity('LOGIN_FAILED', {
        email,
        ipAddress,
        userAgent,
        riskLevel: 'medium'
      });
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      logSecurity('LOGIN_FAILED', {
        userId: user.id,
        email,
        ipAddress,
        userAgent,
        riskLevel: 'medium'
      });
      throw new AppError('Account is inactive', 401);
    }

    // Check company status (if user belongs to a company)
    if (user.company && !user.company.isActive) {
      logSecurity('LOGIN_FAILED', {
        userId: user.id,
        email,
        ipAddress,
        userAgent,
        riskLevel: 'medium'
      });
      throw new AppError('Company account is inactive', 401);
    }

    // Verify password
    if (!user.password) {
      throw new AppError('Password login not available for this account', 400);
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      logSecurity('LOGIN_FAILED', {
        userId: user.id,
        email,
        ipAddress,
        userAgent,
        riskLevel: 'medium'
      });
      throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Log successful login
    logSecurity('LOGIN_SUCCESS', {
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      riskLevel: 'low'
    });

    logAudit('LOGIN', {
      userId: user.id,
      entityType: 'User',
      entityId: user.id,
      ipAddress
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as Role,
      companyId: user.companyId,
      company: user.company
    };
  } catch (error) {
    logError('Login failed', error as Error, { email });
    throw error;
  }
}

// Request password reset
export async function requestPasswordReset(email: string, ipAddress: string, baseUrl: string = '') {
  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() }
    });

    // Don't reveal if user exists
    if (!user) {
      logSecurity('PASSWORD_RESET_REQUEST', {
        email,
        ipAddress,
        riskLevel: 'low'
      });
      return { message: 'If an account exists, a reset link has been sent' };
    }

    // Generate reset token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    // Send email with reset link
    const emailBaseUrl = baseUrl || process.env.BASE_URL || 'http://localhost:8090/ApexSales';
    await sendPasswordResetEmail(
      user.email,
      user.firstName,
      token,
      emailBaseUrl
    );

    logSecurity('PASSWORD_RESET_REQUEST', {
      userId: user.id,
      email: user.email,
      ipAddress,
      riskLevel: 'low'
    });

    logInfo('Password reset requested', { userId: user.id, email: user.email });

    return { message: 'If an account exists, a reset link has been sent' };
  } catch (error) {
    logError('Password reset request failed', error as Error, { email });
    throw error;
  }
}

// Reset password with token
export async function resetPassword(token: string, newPassword: string, ipAddress: string) {
  try {
    // Find valid reset token
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!resetRecord) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    if (resetRecord.usedAt) {
      throw new AppError('Reset token already used', 400);
    }

    if (resetRecord.expiresAt < new Date()) {
      throw new AppError('Reset token expired', 400);
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new AppError(passwordValidation.errors.join('. '), 400);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword }
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() }
      })
    ]);

    logSecurity('PASSWORD_RESET_COMPLETE', {
      userId: resetRecord.userId,
      email: resetRecord.user.email,
      ipAddress,
      riskLevel: 'low'
    });

    logAudit('PASSWORD_RESET', {
      userId: resetRecord.userId,
      entityType: 'User',
      entityId: resetRecord.userId,
      ipAddress
    });

    logInfo('Password reset completed', { userId: resetRecord.userId });

    return { success: true };
  } catch (error) {
    logError('Password reset failed', error as Error);
    throw error;
  }
}

// Change password (authenticated user)
export async function changePassword(userId: string, currentPassword: string, newPassword: string, ipAddress: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.password) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new AppError(passwordValidation.errors.join('. '), 400);
    }

    // Hash and update password
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    logAudit('UPDATE', {
      userId,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      changes: { field: 'password' }
    });

    logInfo('Password changed', { userId });

    return { success: true };
  } catch (error) {
    logError('Password change failed', error as Error, { userId });
    throw error;
  }
}

// Get user by ID
export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          industryId: true,
          subscriptionTier: true,
          subscriptionStatus: true
        }
      }
    }
  });
}

// Update user profile
export async function updateUserProfile(userId: string, data: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
}, ipAddress: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data
  });

  logAudit('UPDATE', {
    userId,
    entityType: 'User',
    entityId: userId,
    ipAddress,
    changes: data
  });

  return user;
}
