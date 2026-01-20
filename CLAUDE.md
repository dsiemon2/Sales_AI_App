# Apex Sales Training AI - Project Reference

**Type:** AI-Powered Sales Training Platform
**Port:** 8090
**URL Prefix:** /ApexSales
**Status:** Active (Development)
**Live URL:** https://www.apexsalestraining.net
**Last Updated:** 2026-01-19

---

## Project Overview
Multi-tenant SaaS platform for AI-powered sales training across 17 industries. Features voice-enabled chat interface, real-time AI conversations, and comprehensive admin dashboard.

**Docker Port:** 8090
**Base Path:** `/ApexSales`
**URLs:**
- Chat: http://localhost:8090/ApexSales/chat (requires login)
- Login: http://localhost:8090/ApexSales/auth/login
- Admin Login: http://localhost:8090/ApexSales/admin/login
- Admin Dashboard: http://localhost:8090/ApexSales/admin?token=admin
- Payment Gateways: http://localhost:8090/ApexSales/admin/payment-configurations?token=admin
- Transactions: http://localhost:8090/ApexSales/admin/payments?token=admin

## Tech Stack
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Caching:** Redis (sessions, rate limiting)
- **Frontend:** EJS templates + Bootstrap 5 + Bootstrap Icons
- **Authentication:** Session-based with bcrypt + OAuth (Google/Microsoft)
- **Voice:** OpenAI Realtime API with WebSockets
- **Logging:** Winston with daily rotation
- **Containerization:** Docker + Docker Compose + Nginx reverse proxy

## File Structure
```
Sales_AI_App/
├── prisma/
│   ├── schema.prisma     # Database schema
│   ├── seed.ts           # Database seeding
│   └── seed-data/        # Seed data files
├── src/
│   ├── app.ts            # Express app setup
│   ├── server.ts         # Server entry point
│   ├── config/
│   │   ├── database.ts   # Prisma client
│   │   ├── redis.ts      # Redis client
│   │   └── constants.ts  # App constants, roles, industries
│   ├── middleware/
│   │   ├── auth.ts       # Authentication (requireAuth, optionalAuth, requireAuthOrToken)
│   │   ├── rbac.ts       # Role-based access control
│   │   ├── rateLimiter.ts # Rate limiting
│   │   ├── tenant.ts     # Multi-tenant middleware
│   │   ├── subscription.ts # Subscription tier enforcement
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── public/home.ts    # Landing, features, pricing, chat
│   │   ├── auth/login.ts     # Login, register, password reset
│   │   ├── admin/            # Admin dashboard routes (dashboard, users, products, etc.)
│   │   └── api/v1/           # REST API endpoints
│   ├── services/
│   │   ├── auth.service.ts   # Authentication business logic
│   │   └── subscription.service.ts # Subscription limits & enforcement
│   └── utils/
│       └── logger.ts
├── views/
│   ├── layouts/
│   │   ├── admin.ejs     # Admin layout with sidebar
│   │   ├── auth.ejs      # Auth pages layout
│   │   └── public.ejs    # Public pages layout
│   ├── public/
│   │   ├── home.ejs      # Landing page
│   │   ├── chat.ejs      # Voice chat interface
│   │   ├── features.ejs  # Features page
│   │   ├── pricing.ejs   # Pricing page
│   │   └── demo.ejs      # Demo page
│   ├── auth/
│   │   ├── login.ejs     # Frontend login
│   │   ├── register.ejs  # User registration
│   │   ├── forgot-password.ejs
│   │   └── reset-password.ejs
│   ├── admin/
│   │   ├── dashboard.ejs     # Admin dashboard
│   │   ├── auth/login.ejs    # Admin login
│   │   ├── users/            # User management (with tier limits)
│   │   ├── companies/        # Company management
│   │   ├── products/         # Product management
│   │   ├── techniques/       # Sales techniques
│   │   ├── discovery/        # Discovery questions
│   │   ├── objections/       # Objection handlers
│   │   ├── closings/         # Closing strategies
│   │   ├── sessions/         # Training sessions
│   │   ├── ai-config/        # AI configuration
│   │   ├── analytics/        # Analytics dashboard
│   │   ├── payments/         # Payment transactions
│   │   ├── payment-configurations/ # Payment gateway setup
│   │   └── ...               # Additional admin modules
│   └── error.ejs         # Error page
├── public/
│   ├── css/              # Stylesheets
│   │   └── themes/       # Theme files
│   ├── js/               # Client-side JavaScript
│   │   └── admin/        # Admin-specific JS
│   └── images/           # Static images
├── docker/
│   ├── nginx.conf        # Nginx reverse proxy config
│   └── entrypoint.sh     # Docker entrypoint script
├── logs/                 # Application logs
├── dist/                 # Compiled TypeScript output
├── docker-compose.yml    # Docker orchestration
└── Dockerfile            # Container build
```

## Authentication System

### Session-Based Auth
- Sessions stored in Redis with `apex.sid` cookie
- 24-hour default session, 30 days with "remember me"
- `requireAuth` middleware for protected routes
- `optionalAuth` for public pages with optional user context

### Login Routes
- **Frontend:** `/auth/login` - redirects to `/chat` after login
- **Admin:** `/admin/login` - redirects to `/admin` after login
- Both support JSON API responses for AJAX calls

### OAuth Providers
- Google OAuth 2.0 (`/auth/google`)
- Microsoft OAuth 2.0 (`/auth/microsoft`)

### Trial Code System
- Trial codes can be activated at `/auth/trial`
- Codes have: max uses, expiration date, days valid, optional industry lock
- Successful activation redirects to registration with trial context
- Admin management at `/admin/trial-codes`

### Account & Subscription Management
- **Account Settings:** `/admin/account` - Edit name, email, phone, password
- **My Subscription:** `/admin/my-subscription` - View and manage subscription
- **Pricing Plans:** `/admin/pricing` - View and upgrade subscription tiers

## Chat Interface (Voice-First Design)

The chat page (`/chat`) uses a voice-first design:

### Features
- **Large Mic Button:** 150x150px orange gradient with glow effect
- **Audio Visualizer:** 24-bar real-time audio visualization
- **Voice Selector:** 6 OpenAI voices (Alloy, Nova, Shimmer, Echo, Onyx, Fable)
- **Conversation Transcript:** Scrollable message history
- **Quick Commands:** Pre-built sales training prompts
- **Text Input Fallback:** Type if voice not available
- **Connect/Disconnect:** WebSocket connection controls

### Color Scheme
- Background: Dark blue gradient (`#0B1F3B` to `#1a365d`)
- Accent: Orange (`#FF6A00`)
- Cards: Semi-transparent white with blur effect
- Messages: White/orange with visible borders for contrast

### WebSocket Endpoint
- URL: `ws://localhost:8090/ApexSales/ws/voice`
- Handles: audio streaming, text messages, voice selection

## UI Component Standards

### Action Buttons
ALL action buttons must have Bootstrap tooltips:
```html
<button class="btn btn-sm btn-outline-primary"
        data-bs-toggle="tooltip"
        title="Describe what this button does">
  <i class="bi bi-icon-name"></i>
</button>
```

### Data Tables
ALL tables must include:
1. Row selection with checkboxes
2. Pagination (10/25/50 per page)
3. Bulk actions toolbar
4. Selected row highlighting

### CSP Compliance
- NO inline `onclick` handlers (blocked by CSP)
- Use `addEventListener` instead
- Scripts must be in `<script>` tags or external files

## RBAC Roles (Hierarchy)
1. **SUPER_ADMIN** - Platform owner, all access, can manage all companies
2. **COMPANY_ADMIN** - Tenant owner, full company access
3. **MANAGER** - Can configure sales content, view team analytics
4. **SUPERVISOR** - Team lead, view analytics only
5. **TRAINEE** - Training sessions only

## Subscription Tiers & Pricing

### Tier Limits
| Feature | Starter ($49/mo) | Professional ($99/mo) | Business ($199/mo) | Enterprise |
|---------|------------------|----------------------|-------------------|------------|
| Users | 1 | 5 | 15 | Unlimited |
| Industries | 1 | 3 | Unlimited | Unlimited |
| Sessions/Month | 100 | 500 | 2000 | Unlimited |
| API Access | No | **Yes** | **Yes** | **Yes** |
| Voice Training | No | No | **Yes** | **Yes** |
| Full Analytics | Basic | **Yes** | **Yes** | **Yes** |
| Priority Support | No | No | **Yes** | **Yes** |
| Custom Branding | No | No | **Yes** | **Yes** |

### Enforcement
- **User Limits:** Enforced in `/admin/users` - cannot add users beyond tier limit
- **API Access:** API routes (`/api/v1/*`) require Professional+ tier
- **Voice Training:** Chat voice features require Business+ tier
- **Analytics:** Full analytics dashboards require Professional+ tier

### Key Files
- `src/config/constants.ts` - `TIER_LIMITS` and `PRICING` definitions
- `src/services/subscription.service.ts` - Limit checking functions
- `src/middleware/subscription.ts` - Enforcement middleware

## Payment Gateway Configuration

### Supported Gateways
- **Stripe** - Full integration with test/live mode toggle
- **PayPal** - Full integration with sandbox/production mode
- **Square** - Full integration with sandbox/production mode
- **Braintree** - Full integration with sandbox/production mode
- **Authorize.net** - Full integration with test/live mode toggle

### Coming Soon
- Plaid (ACH)
- Crypto payments

### Database Model
```prisma
model CompanyPaymentSettings {
  stripeEnabled, stripePublishableKey, stripeSecretKey, stripeTestMode
  paypalEnabled, paypalClientId, paypalClientSecret, paypalTestMode
  squareEnabled, squareApplicationId, squareAccessToken, squareTestMode
}
```

### Admin Routes
- `GET /admin/payment-configurations` - Gateway setup page
- `POST /admin/payment-configurations` - Save gateway settings
- `GET /admin/payments` - View payment transactions

## 17 Industries
`pen`, `auto`, `salon`, `western`, `insurance`, `solar`, `security`, `doors_windows`, `flooring`, `real_estate`, `saas`, `fitness`, `hospitality`, `medical`, `food_drink`, `dental`, `cell_phone`

## 24 Languages (All Enabled)
Arabic, Chinese (Mandarin), Czech, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi, Italian, Japanese, Korean, Norwegian, Polish, Portuguese, Russian, Spanish, Swedish, Thai, Turkish, Vietnamese

## Demo Credentials

### Super Admin (Platform-wide access)
- Email: `admin@apexsalesai.com`
- Password: `Admin123!`

### Sample Company Users (Elite Writing - Pen Industry)
- **Company Admin:** `john@elitewriting.com` / `Demo123!`
- **Manager:** `sarah@elitewriting.com` / `Demo123!`

### All Sample Company Users
All seeded company users use password: `Demo123!`

## Docker Commands

```bash
# Start all services
docker compose up -d

# Rebuild after code changes
docker compose build --no-cache app
docker compose up -d app

# View logs
docker compose logs -f app
docker compose logs --tail 50 app

# Check error logs inside container
docker compose exec app sh -c "tail -50 logs/error-$(date +%Y-%m-%d).log"

# Reset database (warning: deletes all data)
docker compose down
docker volume rm sales_ai_app_postgres_data
docker compose up -d

# Health check
curl http://localhost:8090/ApexSales/health
```

## Development Commands

```bash
npm run dev          # Development server with hot reload
npm run build        # Build TypeScript to dist/
npm run db:push      # Push schema changes to database
npm run db:seed      # Seed database with sample data
npx prisma studio    # Open Prisma database GUI
```

## Environment Variables

Key variables (see `.env.example`):
```
PORT=3000
BASE_PATH=/ApexSales
DATABASE_URL=postgresql://user:pass@localhost:5432/apex_sales
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

## Prisma Models (Key)

- `User` - Users with roles and company association
- `Company` - Multi-tenant companies with industry and subscription tier
- `Industry` - 17 supported industries
- `Language` - 24 supported languages
- `AIConfig` - AI configuration per company (greeting, model settings)
- `Product`, `Technique`, `DiscoveryQuestion`, `ObjectionHandler`, `ClosingStrategy` - Sales content
- `SalesSession` - Training session records
- `TrialCode` - Trial activation codes
- `Subscription` - Platform subscription tracking (tier, status, Stripe IDs)
- `Transaction` - Payment transaction records
- `CompanyPaymentSettings` - Payment gateway credentials per company

## Logging

Comprehensive Winston logging with daily rotation:

```
src/utils/logger.ts
```

### Features
- **Console Output**: Colorized logs in non-production environments
- **File Rotation**: Daily log files with compression
- **Error Logs**: Separate error-level log files (`error-%DATE%.log`) with 30-day retention
- **Combined Logs**: All levels in combined files (`combined-%DATE%.log`) with 14-day retention
- **Debug Logs**: Development-only debug logs with 7-day retention
- **Stack Traces**: Full stack traces for errors
- **File Size Limit**: 20MB max per file with automatic rotation
- **Compression**: zippedArchive for rotated log files

### Log Levels
- `error` - Error conditions
- `warn` - Warning conditions
- `info` - Informational messages
- `http` - HTTP request logging
- `debug` - Debug information (dev only)

### Helper Functions
```typescript
import { logInfo, logError, logWarn, logDebug, logHttp, logRequest, logAudit, logSecurity } from '../utils/logger';

// Standard logging
logInfo('Server started', { port: 8090 });
logError('Database connection failed', error, { connectionString: '...' });

// HTTP request logging
logRequest({ method: 'POST', url: '/api/users', ip: req.ip, userId: req.user?.id });

// Audit logging for compliance
logAudit('USER_CREATED', { userId: newUser.id, companyId: company.id, ipAddress: req.ip });

// Security event logging
logSecurity('LOGIN_FAILED', { email, ipAddress: req.ip, riskLevel: 'medium' });
```

### Log Files Location
```
logs/
├── error-2026-01-19.log      # Error logs only
├── combined-2026-01-19.log   # All log levels
└── debug-2026-01-19.log      # Debug logs (dev only)
```

---

## Troubleshooting

### "token is not defined" Error
**Cause:** Templates use `${token}` but routes don't pass it
**Solution:** Dashboard middleware sets `res.locals.token` for all admin routes

### Redirect Loop / Too Many Requests
**Cause:** Browser cached old pages with wrong auth redirects
**Solution:** Clear browser cookies and cache, or use Incognito mode

### 500 Errors on Admin Pages
**Cause:** Missing variables in render calls (token, basePath, etc.)
**Solution:** All admin routes inherit from dashboard middleware which sets common variables

### "User limit reached" Error
**Cause:** Company has reached its subscription tier's user limit
**Solution:** Upgrade subscription tier or deactivate unused users

### "API access requires Professional plan" Error
**Cause:** Attempting to use API routes with Starter tier
**Solution:** Upgrade to Professional or higher tier for API access

### "Voice training requires Business plan" Error
**Cause:** Attempting to use voice features with non-Business tier
**Solution:** Upgrade to Business tier for voice training access

### Payment Gateway Not Saving
**Cause:** Missing company context in tenant middleware
**Solution:** Ensure user is logged in with company association before configuring payment gateways
