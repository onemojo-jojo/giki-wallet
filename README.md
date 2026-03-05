# Giki Wallet: Modular Monolith Architecture

[![Go Version](https://img.shields.io/github/go-mod/go-version/hash-walker/giki-wallet?filename=backend%2Fgo.mod&style=flat-square&logo=go)](https://golang.org)
[![React](https://img.shields.io/badge/Frontend-React%2019-blue?style=flat-square&logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Infrastructure-Docker-2496ED?style=flat-square&logo=docker)](https://www.docker.com)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)

## Overview

Giki Wallet is a unified financial and transport management system developed for the GIKI ecosystem. The project implements a **Strict Modular Monolith** architecture to ensure domain isolation, maintainability, and scalability while avoiding the operational overhead of microservices.

## Technology Stack

### Backend
*   **Core:** [Go (Golang)](https://go.dev/)
*   **Data Access:** [SQLC](https://sqlc.dev/) for type-safe SQL generator.
*   **Database Migrations:** [Goose](https://github.com/pressly/goose) for versioned schema management.
*   **Integrations:** Microsoft Graph API (Notification Services), JazzCash SDK (Payment Gateway).

### Frontend
*   **Core:** [React 19](https://react.dev/) via [Vite](https://vitejs.dev/).
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/) component library.
*   **State Management:** [Zustand](https://github.com/pmndrs/zustand).
*   **Data Fetching:** [TanStack Query](https://tanstack.com/query/latest) for server-state management.

### Infrastructure
*   **Containerization:** [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).
*   **Server/Proxy:** [Nginx](https://www.nginx.com/) for reverse proxying and static asset delivery.
*   **Database:** [PostgreSQL](https://www.postgresql.org/) with multi-schema orchestration.

## Architecture and Domain Modules

### Internal Backend Modules (`/backend/internal/`)
The system is partitioned into independent domain modules to ensure strict separation of concerns:

*   **`auth`**: Identity management, session orchestration, and authentication protocols.
*   **`wallet`**: Financial ledger system managing accounts, balances, and atomic transactions.
*   **`payment`**: JazzCash gateway integration, transaction processing, and reconciliation.
*   **`transport`**: Logistics management including routes, schedules, stops, and seat inventory.
*   **`user`**: User profile management and GIKI-specific identity verification.
*   **`audit`**: Global system-wide auditing and event logging.
*   **`mailer`**: Template-based notification delivery via MS Graph.

### Database Schema Strategy
PostgreSQL schemas are utilized to enforce logical data boundaries:
| Schema | Domain | Responsibility |
| :--- | :--- | :--- |
| `giki_wallet` | Financial | Ledgers, transactions, and balances. |
| `transport_system` | Logistics | Routes, schedules, and bookings. |
| `giki_system` | System | Authentication, audit logs, and global config. |

## Getting Started

### Prerequisites
*   Docker and Docker Compose.
*   Go 1.22+ (required for local backend development).

### Environment Configuration
1.  Initialize environment file:
    ```bash
    cp .env.example .env
    ```
2.  Configure secrets and connection strings in `.env`.

### Deployment via Docker
To build and start the entire service stack:
```bash
docker-compose up --build
```
Access points:
*   Frontend: `http://localhost`
*   Backend API: `http://localhost/api`

### Development Commands
Common tasks are managed via the `Makefile` in the `backend/` directory:
*   `make sqlc-generate`: Regenerate the data access layer.
*   `make migrate-up`: Apply database schema changes.
*   `make run`: Start the API server in a local environment.
*   `make test`: Run the test suite.

## Project Structure

```text
.
├── backend/            # Go API, SQLC configurations, and migrations
├── frontend/           # React application, Vite config, and components
├── infrastructure/     # Nginx configurations and database bootstrap scripts
├── certs/              # SSL certificate storage
└── docker-compose.yml  # System orchestration manifest
```

## Architectural Principles

### Modular Monolith Philosophy
The project adheres to several key principles to maintain codebase health:
1.  **Strict Domain Isolation:** Cross-module communication is restricted to defined service interfaces.
2.  **Schema Enforcement:** Foreign keys across schemas are minimized to facilitate future decoupling.
3.  **Type Safety:** Ensuring consistency from SQL schemas to frontend interfaces.

Copyright

# GIKI Wallet CI/CD Test - 2026-03-05T22:59:32Z
