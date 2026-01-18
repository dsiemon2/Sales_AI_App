// ===========================================
// Apex Sales Training AI - Constants
// ===========================================

// Application Info
export const APP_NAME = process.env.APP_NAME || 'Apex Sales Training AI';
export const APP_VERSION = '1.0.0';

// Server Ports
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const ADMIN_PORT = parseInt(process.env.ADMIN_PORT || '3001', 10);
export const PUBLIC_PORT = parseInt(process.env.PUBLIC_PORT || '3002', 10);

// Session Configuration
export const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-in-production';
export const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || '86400000', 10); // 24 hours

// JWT Configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'change-this-jwt-secret';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Demo Mode
export const DEMO_ENABLED = process.env.DEMO_ENABLED === 'true';
export const DEMO_MESSAGE_LIMIT = parseInt(process.env.DEMO_MESSAGE_LIMIT || '10', 10);
export const DEMO_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

// User Roles
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  MANAGER: 'MANAGER',
  SUPERVISOR: 'SUPERVISOR',
  TRAINEE: 'TRAINEE'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Role Hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.COMPANY_ADMIN]: 80,
  [ROLES.MANAGER]: 60,
  [ROLES.SUPERVISOR]: 40,
  [ROLES.TRAINEE]: 20
};

// Subscription Tiers
export const SUBSCRIPTION_TIERS = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise'
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];

// Tier Limits
export const TIER_LIMITS: Record<SubscriptionTier, {
  users: number;
  industries: number;
  sessionsPerMonth: number;
  apiAccess: boolean;
  voiceEnabled: boolean;
  prioritySupport: boolean;
}> = {
  [SUBSCRIPTION_TIERS.STARTER]: {
    users: 1,
    industries: 1,
    sessionsPerMonth: 100,
    apiAccess: false,
    voiceEnabled: false,
    prioritySupport: false
  },
  [SUBSCRIPTION_TIERS.PROFESSIONAL]: {
    users: 5,
    industries: 3,
    sessionsPerMonth: 500,
    apiAccess: true,
    voiceEnabled: false,
    prioritySupport: false
  },
  [SUBSCRIPTION_TIERS.BUSINESS]: {
    users: 15,
    industries: -1, // unlimited
    sessionsPerMonth: 2000,
    apiAccess: true,
    voiceEnabled: true,
    prioritySupport: true
  },
  [SUBSCRIPTION_TIERS.ENTERPRISE]: {
    users: -1, // unlimited
    industries: -1, // unlimited
    sessionsPerMonth: -1, // unlimited
    apiAccess: true,
    voiceEnabled: true,
    prioritySupport: true
  }
};

// Pricing (in cents)
export const PRICING = {
  [SUBSCRIPTION_TIERS.STARTER]: {
    monthly: 4900,
    annual: 49000
  },
  [SUBSCRIPTION_TIERS.PROFESSIONAL]: {
    monthly: 9900,
    annual: 99000
  },
  [SUBSCRIPTION_TIERS.BUSINESS]: {
    monthly: 19900,
    annual: 199000
  },
  [SUBSCRIPTION_TIERS.ENTERPRISE]: {
    monthly: 0, // custom pricing
    annual: 0
  }
};

// Industry Codes
export const INDUSTRIES = {
  PEN: 'pen',
  AUTO: 'auto',
  SALON: 'salon',
  WESTERN: 'western',
  INSURANCE: 'insurance',
  SOLAR: 'solar',
  SECURITY: 'security',
  DOORS_WINDOWS: 'doors_windows',
  FLOORING: 'flooring',
  REAL_ESTATE: 'real_estate',
  SAAS: 'saas',
  FITNESS: 'fitness',
  HOSPITALITY: 'hospitality',
  MEDICAL: 'medical',
  FOOD_DRINK: 'food_drink',
  DENTAL: 'dental',
  CELL_PHONE: 'cell_phone'
} as const;

export type IndustryCode = typeof INDUSTRIES[keyof typeof INDUSTRIES];

// Sales Session Phases
export const SESSION_PHASES = {
  GREETING: 'greeting',
  DISCOVERY: 'discovery',
  PRESENTATION: 'presentation',
  OBJECTION: 'objection',
  CLOSING: 'closing',
  COMPLETED: 'completed'
} as const;

export type SessionPhase = typeof SESSION_PHASES[keyof typeof SESSION_PHASES];

// Sales Session Outcomes
export const SESSION_OUTCOMES = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
  SALE_MADE: 'sale_made',
  NO_SALE: 'no_sale'
} as const;

export type SessionOutcome = typeof SESSION_OUTCOMES[keyof typeof SESSION_OUTCOMES];

// Audit Actions
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_RESET: 'PASSWORD_RESET',
  SUBSCRIPTION_CHANGE: 'SUBSCRIPTION_CHANGE',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  EXPORT: 'EXPORT'
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// Security Event Types
export const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  API_KEY_USED: 'API_KEY_USED'
} as const;

export type SecurityEvent = typeof SECURITY_EVENTS[keyof typeof SECURITY_EVENTS];

// Rate Limits
export const RATE_LIMITS = {
  API_REQUESTS_PER_MINUTE: 200,
  LOGIN_ATTEMPTS_PER_HOUR: 20,
  PASSWORD_RESET_PER_HOUR: 5,
  DEMO_MESSAGES_PER_SESSION: 20
};

// Password Requirements
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false
};

// Email Templates
export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password-reset',
  EMAIL_VERIFICATION: 'email-verification',
  SESSION_SUMMARY: 'session-summary',
  SUBSCRIPTION_CONFIRMATION: 'subscription-confirmation',
  SUBSCRIPTION_CANCELLED: 'subscription-cancelled'
} as const;

// OpenAI Models
export const AI_MODELS = {
  GPT4: 'gpt-4',
  GPT4_TURBO: 'gpt-4-turbo-preview',
  GPT35_TURBO: 'gpt-3.5-turbo'
} as const;

// Voice IDs (OpenAI TTS)
export const VOICE_IDS = {
  ALLOY: 'alloy',
  ECHO: 'echo',
  FABLE: 'fable',
  ONYX: 'onyx',
  NOVA: 'nova',
  SHIMMER: 'shimmer'
} as const;

// 24 Languages (All Enabled)
export const LANGUAGES = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' }
] as const;

// Industry Color Schemes
export const INDUSTRY_COLORS: Record<IndustryCode, {
  primary: string;
  secondary: string;
  accent: string;
  icon: string;
}> = {
  pen: { primary: '#2563eb', secondary: '#1d4ed8', accent: '#3b82f6', icon: 'bi-pen' },
  auto: { primary: '#0d9488', secondary: '#0f766e', accent: '#14b8a6', icon: 'bi-car-front' },
  salon: { primary: '#db2777', secondary: '#be185d', accent: '#ec4899', icon: 'bi-scissors' },
  western: { primary: '#b45309', secondary: '#a16207', accent: '#d97706', icon: 'bi-shop' },
  insurance: { primary: '#0369a1', secondary: '#075985', accent: '#0ea5e9', icon: 'bi-shield-check' },
  solar: { primary: '#f59e0b', secondary: '#d97706', accent: '#fbbf24', icon: 'bi-sun' },
  security: { primary: '#1e40af', secondary: '#1e3a8a', accent: '#3b82f6', icon: 'bi-shield-lock' },
  doors_windows: { primary: '#64748b', secondary: '#475569', accent: '#94a3b8', icon: 'bi-door-open' },
  flooring: { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#a855f7', icon: 'bi-grid-3x3' },
  real_estate: { primary: '#10b981', secondary: '#059669', accent: '#34d399', icon: 'bi-house-door' },
  saas: { primary: '#6366f1', secondary: '#4f46e5', accent: '#818cf8', icon: 'bi-cloud' },
  fitness: { primary: '#ef4444', secondary: '#dc2626', accent: '#f87171', icon: 'bi-heart-pulse' },
  hospitality: { primary: '#f97316', secondary: '#ea580c', accent: '#fb923c', icon: 'bi-building' },
  medical: { primary: '#06b6d4', secondary: '#0891b2', accent: '#22d3ee', icon: 'bi-hospital' },
  food_drink: { primary: '#92400e', secondary: '#78350f', accent: '#b45309', icon: 'bi-cup-hot' },
  dental: { primary: '#0284c7', secondary: '#0369a1', accent: '#38bdf8', icon: 'bi-emoji-smile' },
  cell_phone: { primary: '#7c3aed', secondary: '#6d28d9', accent: '#a855f7', icon: 'bi-phone' }
};
