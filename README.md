# Dealer Portal

B2B wholesale ordering portal with multi-tenant pricing, customer self-service, and admin management. Built with Next.js 15, Prisma, PostgreSQL, and NextAuth.

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm

### Setup

```bash
# Clone and install
git clone <repo-url> dealer-portal
cd dealer-portal
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL and AUTH_SECRET at minimum

# Create database and run migrations
createdb dealer_portal
npx prisma migrate deploy

# Seed demo data
npx prisma db seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@example.com | password |
| Staff | staff@example.com | DemoPassword123! |
| Dealer Customer | john@acmehardware.com | DemoPassword123! |
| VIP Customer | carlos@westcoasttools.com | DemoPassword123! |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm test` | Run all tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:coverage` | Tests with coverage report |
| `npm run db:migrate` | Deploy migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset and re-seed database |

## Using as a Template

This repo is designed as a reusable template for B2B dealer portals.

1. Click **"Use this template"** on GitHub (or fork)
2. Follow the [Re-skinning Guide](docs/RESKINNING.md) to customize branding
3. Follow the [Deployment Guide](docs/DEPLOYMENT.md) for Railway setup

## Documentation

| Document | Description |
|---|---|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Railway deployment guide |
| [docs/RESKINNING.md](docs/RESKINNING.md) | Branding customization (30 min) |
| [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md) | Admin user guide |

## Architecture

- **Next.js 15** — App Router, Server Components, Server Actions
- **Prisma 7** — PostgreSQL ORM with type-safe queries
- **NextAuth v5** — JWT authentication with role-based access
- **Resend** — Transactional emails (optional, logs to console without API key)
- **Zod** — Runtime validation for all forms and APIs
- **Vitest** — Unit and integration testing

## License

ISC
