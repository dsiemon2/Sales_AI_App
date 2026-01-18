// ===========================================
// API Token Service
// Manages API tokens for external integrations
// ===========================================

import crypto from 'crypto';
import prisma from '../config/database';
import { logInfo, logError, logSecurity } from '../utils/logger';

const TOKEN_PREFIX = 'apex_sk_';
const TOKEN_LENGTH = 32; // 32 bytes = 64 hex chars

// Generate a new API token
export async function createApiToken(
  companyId: string,
  name: string,
  createdBy?: string,
  expiresAt?: Date,
  permissions: string[] = ['*']
): Promise<{
  token: string;  // Only returned once!
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
}> {
  // Generate random token
  const randomBytes = crypto.randomBytes(TOKEN_LENGTH);
  const tokenBody = randomBytes.toString('hex');
  const fullToken = `${TOKEN_PREFIX}${tokenBody}`;

  // Hash the token for storage
  const tokenHash = hashToken(fullToken);

  // Store prefix for identification
  const prefix = fullToken.substring(0, 16);

  const apiToken = await prisma.apiToken.create({
    data: {
      companyId,
      name,
      tokenHash,
      prefix,
      createdBy,
      expiresAt,
      permissions: permissions
    }
  });

  logInfo('API token created', {
    companyId,
    tokenId: apiToken.id,
    name,
    prefix
  });

  // Return the plain token ONLY on creation
  return {
    token: fullToken,
    id: apiToken.id,
    name: apiToken.name,
    prefix: apiToken.prefix,
    createdAt: apiToken.createdAt
  };
}

// Validate an API token and return company info
export async function validateApiToken(token: string): Promise<{
  valid: boolean;
  companyId?: string;
  company?: {
    id: string;
    name: string;
    industryId: string;
    subscriptionTier: string;
    subscriptionStatus: string;
  };
  tokenId?: string;
  permissions?: string[];
  error?: string;
}> {
  try {
    // Check token format
    if (!token.startsWith(TOKEN_PREFIX)) {
      return { valid: false, error: 'Invalid token format' };
    }

    // Hash the token for lookup
    const tokenHash = hashToken(token);

    // Find the token
    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash },
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

    if (!apiToken) {
      logSecurity('API_TOKEN_INVALID', {
        ipAddress: token.substring(0, 16), // Use prefix for identification
        riskLevel: 'medium'
      });
      return { valid: false, error: 'Invalid token' };
    }

    // Check if token is active
    if (!apiToken.isActive) {
      logSecurity('API_TOKEN_INACTIVE', {
        userId: apiToken.createdBy || undefined,
        riskLevel: 'low'
      });
      return { valid: false, error: 'Token is inactive' };
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      logSecurity('API_TOKEN_EXPIRED', {
        userId: apiToken.createdBy || undefined,
        riskLevel: 'low'
      });
      return { valid: false, error: 'Token has expired' };
    }

    // Check if company is active
    if (!apiToken.company.isActive) {
      return { valid: false, error: 'Company is inactive' };
    }

    // Update last used timestamp
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() }
    });

    return {
      valid: true,
      companyId: apiToken.companyId,
      company: apiToken.company,
      tokenId: apiToken.id,
      permissions: apiToken.permissions as string[]
    };
  } catch (error) {
    logError('API token validation error', error as Error);
    return { valid: false, error: 'Token validation failed' };
  }
}

// List API tokens for a company (without the actual tokens)
export async function listApiTokens(companyId: string): Promise<{
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}[]> {
  const tokens = await prisma.apiToken.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return tokens;
}

// Revoke an API token
export async function revokeApiToken(
  tokenId: string,
  companyId: string
): Promise<boolean> {
  try {
    const token = await prisma.apiToken.findFirst({
      where: { id: tokenId, companyId }
    });

    if (!token) {
      return false;
    }

    await prisma.apiToken.update({
      where: { id: tokenId },
      data: { isActive: false }
    });

    logInfo('API token revoked', { tokenId, companyId });
    return true;
  } catch (error) {
    logError('Failed to revoke API token', error as Error);
    return false;
  }
}

// Delete an API token permanently
export async function deleteApiToken(
  tokenId: string,
  companyId: string
): Promise<boolean> {
  try {
    const token = await prisma.apiToken.findFirst({
      where: { id: tokenId, companyId }
    });

    if (!token) {
      return false;
    }

    await prisma.apiToken.delete({
      where: { id: tokenId }
    });

    logInfo('API token deleted', { tokenId, companyId });
    return true;
  } catch (error) {
    logError('Failed to delete API token', error as Error);
    return false;
  }
}

// Hash a token using SHA-256
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Check if a token has a specific permission
export function hasPermission(permissions: string[], required: string): boolean {
  // Wildcard grants all permissions
  if (permissions.includes('*')) {
    return true;
  }

  // Check for exact match or prefix match (e.g., 'read:*' matches 'read:users')
  return permissions.some(perm => {
    if (perm === required) return true;
    if (perm.endsWith(':*')) {
      const prefix = perm.slice(0, -1);
      return required.startsWith(prefix);
    }
    return false;
  });
}
