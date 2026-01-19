# Apex AI Sales Training

Multi-tenant SaaS platform for AI-powered sales training.

**Production Domain:** www.apexsalestraining.net

## Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express 4.18
- **Language:** TypeScript 5.3
- **Database:** PostgreSQL 15
- **ORM:** Prisma 5.7
- **Cache:** Redis 7
- **WebSockets:** ws 8.16
- **Auth:** Passport.js
- **Logging:** Winston

### Frontend
- **Templating:** EJS 3.1
- **CSS Framework:** Bootstrap 5
- **Icons:** Bootstrap Icons

### Payment Gateways
Stripe, PayPal, Square

### SMS/Notifications
- **Twilio** - SMS notifications for training completions and follow-ups

## Ports

| Service | Port | Description |
|---------|------|-------------|
| Nginx Proxy | 8090 | Main entry point |
| HTTPS | 443 | Secure entry point |
| App Server | 3000 | Internal - Main application |
| PostgreSQL | 5433 | Database server |
| Redis | 6380 | Cache & Sessions |

## Local Development URLs

- **Landing Page:** http://localhost:8090/ApexSales/
- **Admin Panel:** http://localhost:8090/ApexSales/admin?token=admin

## Docker Setup

```bash
# Start all services
docker compose up -d

# Rebuild and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

## Author

Daniel Siemon
