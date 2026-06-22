<p align="center">
  <h1 align="center">🏦 GIKI Wallet</h1>
  <p align="center">
    A unified financial wallet & transport management system for the <a href="https://giki.edu.pk">GIKI</a> campus ecosystem.
    <br />
    Built as a <strong>Strict Modular Monolith</strong> — domain-isolated, type-safe from SQL to UI.
  </p>
</p>

<p align="center">
  <a href="https://golang.org"><img src="https://img.shields.io/github/go-mod/go-version/hash-walker/giki-wallet?filename=backend%2Fgo.mod&style=for-the-badge&logo=go&logoColor=white&label=Go" alt="Go Version" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" /></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" /></a>
  <a href="https://www.postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-17-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 17" /></a>
  <a href="https://www.docker.com"><img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" /></a>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#%EF%B8%8F-architecture">Architecture</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-database-schema">Database</a> •
  <a href="#-deployment">Deployment</a>
</p>

---

## ✨ Features

| Domain | Capabilities |
| :--- | :--- |
| **💳 Wallet** | Personal G-Bux wallets, immutable append-only double-entry ledger, hash-chained integrity verification, balance snapshots |
| **💰 Payments** | JazzCash gateway integration (mobile wallet + card), idempotent top-ups, async reconciliation with retry, refund support |
| **🚌 Transport** | Route & schedule management, seat hold/confirm flow with TTL-based expiry, ticket booking with quota enforcement, trip lifecycle management |
| **🔐 Auth** | JWT access + refresh token rotation, email verification, password reset, role-based access control (Student / Employee / Admin) |
| **👤 Users** | Student & employee profiles, admin approval workflow for employees, GIKI-specific identity verification |
| **📧 Notifications** | Async job queue for templated email delivery via Microsoft Graph API |
| **📊 Admin** | Dashboard with revenue/liability reporting, gateway transaction audit logs, user management, system configuration, CSV exports |

---

## 🏗️ Architecture

The system follows a **Strict Modular Monolith** pattern — a single deployable unit where each domain module owns its data access layer, business logic, and HTTP handlers. Cross-module communication happens only through defined Go service interfaces, never through shared database queries.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx (Reverse Proxy)                   │
│                    :80 / :443  — SSL termination                │
├───────────────────────────────┬──────────────────────────────────┤
│       Frontend (React)        │        Backend (Go + Chi)        │
│  Vite • Tailwind v4 • shadcn │  /api/* → :8080                  │
│  Zustand • TanStack Query     │                                  │
├───────────────────────────────┴──────────────────────────────────┤
│                       Backend Internal Modules                   │
│  ┌──────┐ ┌──────┐ ┌───────┐ ┌─────────┐ ┌──────┐ ┌──────────┐ │
│  │ auth │ │ user │ │wallet │ │ payment │ │trans.│ │  worker  │ │
│  └──┬───┘ └──┬───┘ └──┬────┘ └────┬────┘ └──┬───┘ └────┬─────┘ │
│     │        │        │           │          │          │        │
│  ┌──┴────────┴────────┴───────────┴──────────┴──────────┴──┐    │
│  │            PostgreSQL 17  (Multi-Schema)                 │    │
│  │  giki_wallet  │  giki_transport  │  giki_system          │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Modules (`/backend/internal/`)

| Module | Responsibility |
| :--- | :--- |
| `auth` | JWT issuance, refresh token rotation, email verification, password reset, role-based middleware |
| `user` | User registration, student/employee profiles, admin CRUD, approval workflows |
| `wallet` | Wallet CRUD, double-entry ledger, hash-chain integrity, balance queries, transaction history |
| `payment` | JazzCash gateway orchestration, idempotent top-ups, card/wallet payments, refunds, status inquiry |
| `transport` | Routes, stops, weekly schedules, trip CRUD, seat holds with TTL, ticket booking/cancellation, quota rules |
| `worker` | Persistent job queue (DB-backed), email dispatch, payment reconciliation tickers |
| `audit` | Security event logging, admin audit trail |
| `mailer` | Microsoft Graph API email sender |
| `config_management` | Dynamic system configuration (e.g., max top-up limits) |
| `feedback` | User feedback collection |
| `middleware` | Request ID, structured logging, panic recovery, rate limiting |

### Database Schema Strategy

PostgreSQL schemas enforce logical data boundaries at the database level:

| Schema | Domain | Tables |
| :--- | :--- | :--- |
| `giki_wallet` | Financial & Identity | `users`, `wallets`, `ledger`, `transactions`, `gateway_transactions`, `refresh_tokens`, `access_tokens` |
| `giki_transport` | Logistics | `routes`, `stops`, `trips`, `tickets`, `trip_holds`, `route_weekly_schedules`, `quota_rules`, `driver` |
| `giki_system` | System | `audit_logs`, `system_configs`, `jobs`, `feedback` |

> 📐 The full database schema is available in [SCHEMA_DIAGRAM.dbml](SCHEMA_DIAGRAM.dbml) — paste it into [dbdiagram.io](https://dbdiagram.io) to visualize.

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| [Docker](https://docs.docker.com/get-docker/) | 24+ | Containerized deployment |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ | Service orchestration |
| [Go](https://go.dev/dl/) | 1.24+ | Backend development (local only) |
| [Node.js](https://nodejs.org/) | 20+ | Frontend development (local only) |
| [SQLC](https://sqlc.dev/) | Latest | SQL code generation (local only) |
| [Goose](https://github.com/pressly/goose) | Latest | Database migrations (local only) |

### Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/hash-walker/giki-wallet.git
cd giki-wallet

# 2. Configure environment
cp .env.example .env
# Edit .env with your secrets — see "Environment Variables" below

# 3. Build and start all services
docker compose up --build
```

Once running:

| Service | URL |
| :--- | :--- |
| Frontend | `http://localhost` |
| Backend API | `http://localhost/api` |
| Health Check | `http://localhost/health` |

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
| :--- | :--- |
| `DB_PASSWORD` | PostgreSQL password (min 32 chars for production) |
| `TOKEN_SECRET` | JWT signing key — generate with `openssl rand -hex 32` |
| `LEDGER_HASH_SECRET` | Ledger hash-chain secret — generate with `openssl rand -hex 32` |
| `MS_GRAPH_CLIENT_ID` | Azure AD app client ID for email notifications |
| `MS_GRAPH_CLIENT_SECRET` | Azure AD app client secret |
| `MS_GRAPH_TENANT_ID` | Azure AD tenant ID |
| `JAZZCASH_MERCHANT_ID` | JazzCash merchant dashboard credentials |
| `JAZZCASH_PASSWORD` | JazzCash merchant password |
| `JAZZCASH_INTEGRITY_SALT` | JazzCash HMAC integrity salt |
| `APP_URL` | Public-facing URL (e.g., `https://giktransport.giki.edu.pk`) |

---

## 🛠️ Development

### Local Backend Development

```bash
cd backend

# Install dependencies
make deps

# Run the server (requires .env or exported env vars)
make run

# Run tests
make test

# Regenerate SQLC type-safe queries
make sqlc-generate

# Apply database migrations
make migrate-up

# Rollback migrations
make migrate-down

# Format & lint
make fmt
make lint
```

### Local Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

### Docker Commands

```bash
# From the backend/ directory:
make docker-build      # Build all containers
make docker-up         # Start in background
make docker-down       # Stop all containers
make docker-logs       # Tail logs
make docker-clean      # Stop + remove volumes
make dev               # docker compose up (foreground)
make dev-rebuild       # docker compose up --build
```

---

## 📡 API Reference

All endpoints are served under `/api` via the Nginx reverse proxy. Authentication uses `Authorization: Bearer <token>` headers.

### Public Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check |
| `POST` | `/auth/register` | User registration |
| `POST` | `/auth/signin` | Login (rate-limited) |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/signout` | Logout / revoke refresh token |
| `GET` | `/auth/verify` | Email verification |
| `POST` | `/auth/forgot-password` | Request password reset (rate-limited) |
| `POST` | `/auth/reset-password` | Reset password (rate-limited) |
| `GET` | `/transport/weekly-summary` | Weekly trip schedule |
| `GET` | `/transport/routes` | List all routes |

### Authenticated Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/auth/me` | Current user profile |
| `POST` | `/feedback` | Submit feedback |
| **Payments** | | |
| `POST` | `/payment/topup` | Initiate wallet top-up |
| `GET` | `/payment/status/:txnRefNo` | Check payment status |
| `GET` | `/payment/limit` | Get max top-up limit |
| **Transport** | | |
| `GET` | `/transport/quota` | Get user's booking quota |
| `POST` | `/transport/holds` | Hold seats (with TTL) |
| `GET` | `/transport/holds/active` | List active holds |
| `DELETE` | `/transport/holds/active` | Release all active holds |
| `POST` | `/transport/confirm` | Confirm batch booking |
| `GET` | `/transport/tickets` | List user's tickets |
| `DELETE` | `/transport/tickets/:ticket_id` | Cancel a ticket |
| **Wallet** | | |
| `GET` | `/wallet/balance` | Get wallet balance |
| `GET` | `/wallet/history` | Transaction history (paginated) |

### Admin Endpoints (`/admin/*`)

Requires authentication + role (`SUPER_ADMIN`, `TRANSPORT_ADMIN`, or `FINANCE_ADMIN`).

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET/POST` | `/admin/users` | List / create users |
| `PUT/DELETE` | `/admin/users/:id` | Update / delete user |
| `PATCH` | `/admin/users/:id/status` | Toggle user active status |
| `POST` | `/admin/users/:id/approve` | Approve employee registration |
| `POST` | `/admin/trips` | Create trip |
| `PUT/DELETE` | `/admin/trips/:id` | Update / delete trip |
| `PATCH` | `/admin/trips/:id/status` | Update trip status |
| `GET` | `/admin/tickets` | List all tickets |
| `GET` | `/admin/finance/liability` | System liability balance |
| `GET` | `/admin/finance/revenue` | System revenue balance |
| `GET` | `/admin/transactions/gateway` | Gateway transaction list |
| `POST` | `/admin/transactions/gateway/:txn/verify` | Verify a gateway transaction |
| `GET` | `/admin/audit-logs` | Security audit log |
| `GET/PUT` | `/admin/settings` | System configuration |
| `GET` | `/admin/worker/status` | Background worker status |

> 📬 A complete Postman collection is included: [GIKI_Wallet_API.postman_collection.json](GIKI_Wallet_API.postman_collection.json)

---

## 🗄️ Database Schema

The system uses **23 versioned migrations** managed by [Goose](https://github.com/pressly/goose), run automatically as a Docker init container before the backend starts.

### Key Design Decisions

- **Double-Entry Ledger** — Every wallet transaction produces two ledger entries (debit + credit). The `ledger` table is append-only and immutable.
- **Hash-Chain Integrity** — Each ledger row includes a `row_hash` computed from the previous entry's hash, creating a tamper-evident chain.
- **Seat Hold Pattern** — Transport bookings use a two-phase hold → confirm flow with TTL-based expiration to prevent double-booking.
- **Quota Rules** — Configurable weekly booking limits per user role and trip direction.
- **Idempotent Payments** — Gateway transactions use `idempotency_key` + `txn_ref_no` unique constraints to prevent duplicate charges.

### Visualize

```bash
# Paste the contents of SCHEMA_DIAGRAM.dbml into https://dbdiagram.io
cat SCHEMA_DIAGRAM.dbml
```

---

## 🚢 Deployment

### CI/CD Pipeline

The project uses **GitHub Actions** for continuous deployment:

1. **On push to `main`** → builds 4 Docker images in parallel:
   - `giki-wallet-backend`
   - `giki-wallet-frontend`
   - `giki-wallet-nginx`
   - `giki-wallet-migrations`
2. Images are pushed to **GitHub Container Registry** (`ghcr.io`)
3. A cron-based **auto-deploy script** on the server polls GHCR every 2 minutes, pulling new images and restarting changed services with zero manual intervention

### Production Architecture

```
Internet → Nginx (:443 TLS) → Backend (:8080)
                             → Frontend (static assets)
                             → PostgreSQL (:5432, localhost only)
```

### Auto-Deploy Setup

```bash
# On the production server, set up the cron job:
crontab -e
# Add: */2 * * * * /opt_2/giki-wallet/deploy.sh >> /opt_2/giki-wallet/deploy.log 2>&1
```

The [deploy.sh](deploy.sh) script compares image digests before restarting — no-op if nothing changed.

---

## 📁 Project Structure

```
giki-wallet/
├── backend/                          # Go API server
│   ├── cmd/main.go                   # Application entry point
│   ├── internal/                     # Domain modules (strict boundaries)
│   │   ├── api/                      # HTTP router & route mounting
│   │   ├── auth/                     # Authentication & authorization
│   │   ├── user/                     # User management
│   │   ├── wallet/                   # Financial ledger system
│   │   ├── payment/                  # JazzCash gateway integration
│   │   │   └── gateway/              # JazzCash HTTP client
│   │   ├── transport/                # Route, trip & ticket management
│   │   ├── worker/                   # Background job queue
│   │   ├── audit/                    # Security event logging
│   │   ├── mailer/                   # MS Graph email sender
│   │   ├── feedback/                 # User feedback
│   │   ├── config_management/        # Dynamic system settings
│   │   ├── middleware/               # Request ID, logging, rate limiting
│   │   ├── common/                   # Shared response helpers
│   │   └── types/                    # Shared type definitions
│   ├── sql/schema/                   # Goose migration files (001–023)
│   ├── sqlc.yaml                     # SQLC multi-module configuration
│   ├── Makefile                      # Development commands
│   └── Dockerfile                    # Multi-stage Go build
│
├── frontend/                         # React SPA
│   ├── src/
│   │   ├── admin/                    # Admin panel views
│   │   ├── client/                   # Client-facing views
│   │   ├── shared/                   # Shared components (shadcn/ui)
│   │   ├── context/                  # React context providers
│   │   ├── hooks/                    # Custom hooks
│   │   └── lib/                      # Axios client, utilities
│   ├── package.json
│   └── Dockerfile                    # Vite production build
│
├── infrastructure/
│   ├── nginx/                        # Nginx config, security headers
│   └── postgres/                     # Bootstrap SQL (schema creation)
│
├── openclaw/                         # Project documentation & guides
├── .github/workflows/deploy.yml      # CI/CD pipeline
├── docker-compose.yml                # Full stack orchestration
├── deploy.sh                         # Auto-deploy script (cron)
├── SCHEMA_DIAGRAM.dbml               # Database schema (dbdiagram.io)
├── .env.example                      # Environment template
└── GIKI_Wallet_API.postman_collection.json  # API collection
```

---

## 🧩 Design Principles

1. **Strict Domain Isolation** — Each module has its own SQLC queries, generated DB code, service layer, and HTTP handlers. No module directly imports another module's DB package.

2. **Type Safety End-to-End** — SQLC generates type-safe Go code from raw SQL. The frontend uses TypeScript with Zod validation. No raw SQL strings in application code.

3. **Schema-Level Boundaries** — PostgreSQL schemas (`giki_wallet`, `giki_transport`, `giki_system`) enforce separation at the database level, enabling future extraction into independent services.

4. **Immutable Financial Ledger** — The wallet uses an append-only, hash-chained ledger. Balances are derived from ledger entries, never stored as a mutable field.

5. **Async-First Processing** — Email notifications, payment reconciliation, and cleanup tasks run through a persistent DB-backed job queue with ticker-based polling.

---

## 📄 License

Copyright © GIKI Wallet Contributors. All rights reserved.
