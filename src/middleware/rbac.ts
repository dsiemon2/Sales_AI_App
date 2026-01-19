import { Request, Response, NextFunction } from 'express';
import { ROLES, Role, ROLE_HIERARCHY } from '../config/constants';
import { AppError } from './errorHandler';
import { logSecurity } from '../utils/logger';

// Menu items with their required roles
export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  section?: string;
  minRole: Role;
  industrySpecific?: boolean;
  requiredFeature?: string;
}

// Permission definitions
export const PERMISSIONS = {
  // Dashboard & Analytics
  VIEW_DASHBOARD: { minRole: ROLES.TRAINEE },
  VIEW_ANALYTICS: { minRole: ROLES.TRAINEE },
  VIEW_ALL_ANALYTICS: { minRole: ROLES.SUPERVISOR },

  // Sessions
  VIEW_SESSIONS: { minRole: ROLES.TRAINEE },
  VIEW_ALL_SESSIONS: { minRole: ROLES.SUPERVISOR },
  DELETE_SESSIONS: { minRole: ROLES.MANAGER },

  // Sales Configuration
  VIEW_PRODUCTS: { minRole: ROLES.TRAINEE },
  MANAGE_PRODUCTS: { minRole: ROLES.MANAGER },
  VIEW_TECHNIQUES: { minRole: ROLES.TRAINEE },
  MANAGE_TECHNIQUES: { minRole: ROLES.MANAGER },
  VIEW_DISCOVERY: { minRole: ROLES.TRAINEE },
  MANAGE_DISCOVERY: { minRole: ROLES.MANAGER },
  VIEW_CLOSING: { minRole: ROLES.TRAINEE },
  MANAGE_CLOSING: { minRole: ROLES.MANAGER },
  VIEW_OBJECTIONS: { minRole: ROLES.TRAINEE },
  MANAGE_OBJECTIONS: { minRole: ROLES.MANAGER },

  // AI Configuration
  VIEW_AI_CONFIG: { minRole: ROLES.MANAGER },
  MANAGE_AI_CONFIG: { minRole: ROLES.COMPANY_ADMIN },
  VIEW_AI_AGENTS: { minRole: ROLES.MANAGER },
  MANAGE_AI_AGENTS: { minRole: ROLES.COMPANY_ADMIN },
  VIEW_AI_TOOLS: { minRole: ROLES.MANAGER },
  MANAGE_AI_TOOLS: { minRole: ROLES.COMPANY_ADMIN },
  VIEW_KNOWLEDGE_BASE: { minRole: ROLES.TRAINEE },
  MANAGE_KNOWLEDGE_BASE: { minRole: ROLES.MANAGER },
  VIEW_VOICES: { minRole: ROLES.MANAGER },
  MANAGE_VOICES: { minRole: ROLES.COMPANY_ADMIN },
  VIEW_GREETING: { minRole: ROLES.MANAGER },
  MANAGE_GREETING: { minRole: ROLES.MANAGER },

  // Automation
  VIEW_LOGIC_RULES: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_LOGIC_RULES: { minRole: ROLES.SUPER_ADMIN },
  VIEW_FUNCTIONS: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_FUNCTIONS: { minRole: ROLES.SUPER_ADMIN },

  // Communication
  VIEW_SMS_SETTINGS: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_SMS_SETTINGS: { minRole: ROLES.COMPANY_ADMIN },
  VIEW_WEBHOOKS: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_WEBHOOKS: { minRole: ROLES.SUPER_ADMIN },

  // Company Management
  VIEW_USERS: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_USERS: { minRole: ROLES.COMPANY_ADMIN },
  VIEW_COMPANIES: { minRole: ROLES.SUPER_ADMIN },
  MANAGE_COMPANIES: { minRole: ROLES.SUPER_ADMIN },
  VIEW_INDUSTRIES: { minRole: ROLES.SUPER_ADMIN },
  MANAGE_INDUSTRIES: { minRole: ROLES.SUPER_ADMIN },

  // Billing
  VIEW_PAYMENTS: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_PAYMENTS: { minRole: ROLES.COMPANY_ADMIN },
  VIEW_SUBSCRIPTION: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_SUBSCRIPTION: { minRole: ROLES.COMPANY_ADMIN },

  // System
  VIEW_SETTINGS: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_SETTINGS: { minRole: ROLES.COMPANY_ADMIN },
  VIEW_FEATURES: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_FEATURES: { minRole: ROLES.COMPANY_ADMIN },
  VIEW_AUDIT_LOGS: { minRole: ROLES.COMPANY_ADMIN },
  MANAGE_PLATFORM: { minRole: ROLES.SUPER_ADMIN }
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Check if user has permission
export function hasPermission(userRole: Role, permission: Permission): boolean {
  const permConfig = PERMISSIONS[permission];
  if (!permConfig) return false;

  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[permConfig.minRole];

  return userLevel >= requiredLevel;
}

// Middleware to check permission
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401));
    }

    if (!hasPermission(req.user.role, permission)) {
      logSecurity('PERMISSION_DENIED', {
        userId: req.user.id,
        ipAddress: req.ip || 'unknown',
        riskLevel: 'medium'
      });

      if (req.accepts('html')) {
        return res.status(403).render('error', {
          title: 'Access Denied',
          message: 'You do not have permission to perform this action.',
          statusCode: 403
        });
      }

      return next(new AppError('Access denied', 403));
    }

    next();
  };
}

// Get menu items for a role
export function getMenuForRole(role: Role, industryCode?: string): MenuItem[] {
  const baseMenu: MenuItem[] = [
    // Core (no section)
    { id: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', path: '/admin', section: '', minRole: ROLES.TRAINEE },
    { id: 'sessions', label: 'Sessions', icon: 'bi-chat-left-text', path: '/admin/sessions', section: '', minRole: ROLES.TRAINEE },
    { id: 'analytics', label: 'Analytics', icon: 'bi-graph-up', path: '/admin/analytics', section: '', minRole: ROLES.TRAINEE },

    // Sales Configuration
    { id: 'product', label: 'Products', icon: 'bi-box-seam', path: '/admin/products', section: 'Sales Configuration', minRole: ROLES.MANAGER, industrySpecific: true },
    { id: 'techniques', label: 'Techniques', icon: 'bi-lightbulb', path: '/admin/techniques', section: 'Sales Configuration', minRole: ROLES.MANAGER },
    { id: 'discovery', label: "Discovery Q's", icon: 'bi-question-circle', path: '/admin/discovery', section: 'Sales Configuration', minRole: ROLES.MANAGER },
    { id: 'closing', label: 'Closing', icon: 'bi-trophy', path: '/admin/closings', section: 'Sales Configuration', minRole: ROLES.MANAGER },
    { id: 'objections', label: 'Objections', icon: 'bi-shield-exclamation', path: '/admin/objections', section: 'Sales Configuration', minRole: ROLES.MANAGER },

    // AI Configuration
    { id: 'ai-config', label: 'AI Config', icon: 'bi-robot', path: '/admin/ai-config', section: 'AI Configuration', minRole: ROLES.COMPANY_ADMIN },
    { id: 'ai-agents', label: 'AI Agents', icon: 'bi-people', path: '/admin/ai-agents', section: 'AI Configuration', minRole: ROLES.COMPANY_ADMIN },
    { id: 'ai-tools', label: 'AI Tools', icon: 'bi-tools', path: '/admin/ai-tools', section: 'AI Configuration', minRole: ROLES.COMPANY_ADMIN },
    { id: 'knowledge-base', label: 'Knowledge Base', icon: 'bi-book', path: '/admin/knowledge-base', section: 'AI Configuration', minRole: ROLES.MANAGER },
    { id: 'voices', label: 'Voices & Mode', icon: 'bi-volume-up', path: '/admin/voices', section: 'AI Configuration', minRole: ROLES.COMPANY_ADMIN },
    { id: 'greeting', label: 'Greeting', icon: 'bi-chat-quote', path: '/admin/greeting', section: 'AI Configuration', minRole: ROLES.MANAGER },

    // Automation
    { id: 'logic-rules', label: 'Logic Rules', icon: 'bi-diagram-3', path: '/admin/logic-rules', section: 'Automation', minRole: ROLES.COMPANY_ADMIN },
    { id: 'functions', label: 'Functions', icon: 'bi-code-square', path: '/admin/functions', section: 'Automation', minRole: ROLES.COMPANY_ADMIN },

    // Communication
    { id: 'sms-settings', label: 'SMS Settings', icon: 'bi-chat-dots', path: '/admin/sms-settings', section: 'Communication', minRole: ROLES.COMPANY_ADMIN },
    { id: 'webhooks', label: 'WebHooks', icon: 'bi-link-45deg', path: '/admin/webhooks', section: 'Communication', minRole: ROLES.COMPANY_ADMIN },

    // Integrations
    { id: 'ms-teams', label: 'MS Teams', icon: 'bi-microsoft-teams', path: '/admin/ms-teams', section: 'Integrations', minRole: ROLES.COMPANY_ADMIN },

    // Company Management
    { id: 'users', label: 'Users', icon: 'bi-people-fill', path: '/admin/users', section: 'Company Management', minRole: ROLES.COMPANY_ADMIN },
    { id: 'companies', label: 'Companies', icon: 'bi-building', path: '/admin/companies', section: 'Company Management', minRole: ROLES.SUPER_ADMIN },
    { id: 'industries', label: 'Industries', icon: 'bi-briefcase', path: '/admin/industries', section: 'Company Management', minRole: ROLES.SUPER_ADMIN },
    { id: 'trial-codes', label: 'Trial Codes', icon: 'bi-key', path: '/admin/trial-codes', section: 'Company Management', minRole: ROLES.SUPER_ADMIN },

    // Content Management
    { id: 'announcements', label: 'Announcements', icon: 'bi-megaphone', path: '/admin/announcements', section: 'Content Management', minRole: ROLES.SUPER_ADMIN },
    { id: 'banners', label: 'Banners', icon: 'bi-images', path: '/admin/banners', section: 'Content Management', minRole: ROLES.SUPER_ADMIN },

    // Billing
    { id: 'payments', label: 'Transactions', icon: 'bi-receipt', path: '/admin/payments', section: 'Billing', minRole: ROLES.COMPANY_ADMIN },
    { id: 'payment-configurations', label: 'Payment Gateways', icon: 'bi-credit-card', path: '/admin/payment-configurations', section: 'Billing', minRole: ROLES.COMPANY_ADMIN },

    // Account
    { id: 'account', label: 'Account Settings', icon: 'bi-shield-check', path: '/admin/account', section: 'Account', minRole: ROLES.TRAINEE },
    { id: 'my-subscription', label: 'My Subscription', icon: 'bi-person-badge', path: '/admin/my-subscription', section: 'Account', minRole: ROLES.COMPANY_ADMIN },
    { id: 'pricing', label: 'Pricing Plans', icon: 'bi-tags', path: '/admin/pricing', section: 'Account', minRole: ROLES.COMPANY_ADMIN },

    // System
    { id: 'settings', label: 'Settings', icon: 'bi-gear', path: '/admin/settings', section: 'System', minRole: ROLES.COMPANY_ADMIN },
    { id: 'features', label: 'Features', icon: 'bi-toggles', path: '/admin/features', section: 'System', minRole: ROLES.COMPANY_ADMIN },
    { id: 'audit-logs', label: 'Audit Logs', icon: 'bi-journal-text', path: '/admin/audit-logs', section: 'System', minRole: ROLES.SUPER_ADMIN }
  ];

  // Filter by role
  const userLevel = ROLE_HIERARCHY[role];
  return baseMenu.filter(item => {
    const requiredLevel = ROLE_HIERARCHY[item.minRole];
    return userLevel >= requiredLevel;
  });
}

// Group menu items by section
export function groupMenuBySection(items: MenuItem[]): Record<string, MenuItem[]> {
  const grouped: Record<string, MenuItem[]> = {};

  items.forEach(item => {
    const section = item.section || '';
    if (!grouped[section]) {
      grouped[section] = [];
    }
    grouped[section].push(item);
  });

  return grouped;
}
