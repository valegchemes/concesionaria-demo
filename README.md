# Concesionaria SaaS - Enterprise Edition

Modern, secure SaaS platform for automotive dealers. Multi-tenant CRM + Inventory + Operations.

**Status**: 🚀 Production-ready (v0.1.0 → Enterprise Architecture)

## 📋 Quick Links

- 📖 **[Strategy Document](./SAAS_STRATEGY.md)** - Complete business & technical strategy
- 🏗️ **[Architecture](./ARCHITECTURE_DETAILED.md)** - Technical deep-dive
- 📅 **[Execution Plan](./PHASE_1_EXECUTION_PLAN.md)** - Phase 1 implementation roadmap
- 📊 **[Executive Summary](./EXECUTIVE_SUMMARY.md)** - Business overview

## 🎯 What is This?

A **SaaS platform for automotive dealers** (cars, motorcycles, boats) in Latin America.

```
Multi-tenant ✓  |  Multi-currency ✓  |  Enterprise RBAC ✓  |  Audit Logging ✓
```

### Core Features

| Module | Features |
|--------|----------|
| **CRM** | Lead pipeline, activities, task management, assignment |
| **Inventory** | Vehicle management, pricing (ARS/USD), attributes, photos |
| **Sales** | Deal management, payments, trade-ins, commissions |
| **Operations** | WhatsApp integration, email templates, reporting |
| **Security** | Multi-tenant isolation, RBAC, audit logging, encryption |

## 🛠 Tech Stack

### Core
- **Framework**: Next.js 16+ (App Router + TypeScript)
- **Database**: PostgreSQL 16 + Prisma ORM
- **Auth**: NextAuth.js v5 (JWT-based, passwordless-ready)

### Development
- **Validation**: Zod (runtime + type-safe schemas)
- **Forms**: react-hook-form
- **UI**: Tailwind CSS + shadcn/ui
- **Tables**: TanStack Table (advanced sorting/filtering)
- **Logging**: Pino (structured logs)

### Infrastructure
- **Hosting**: Vercel (serverless) + Neon (PostgreSQL)
- **Monitoring**: Sentry (error tracking)
- **DevOps**: GitHub Actions (CI/CD), Docker

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or use Neon cloud)
- npm or yarn

### Installation

```bash
# 1. Clone repo
git clone <repo> && cd consencionaria

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env.local
# Edit .env.local with your database credentials

# 4. Generate Prisma client
npm run db:generate

# 5. Run migrations
npm run db:migrate

# 6. (Optional) Seed demo data
npm run db:seed

# 7. Start development server
npm run dev
```

Open http://localhost:3000 in your browser.

### Demo Credentials (if seed.ts ran)
```
Email: demo@example.com
Password: password123
```

## 📁 Project Structure

```
├── app/
│   ├── api/v1/           # API routes (REST endpoints)
│   ├── (app)/            # Protected routes (require auth)
│   ├── (public)/         # Public pages (catalog)
│   ├── login/            # Auth pages
│   └── auth/             # NextAuth configuration
│
├── lib/
│   ├── shared/           # Reusable utilities
│   │   ├── config.ts     # Environment validation
│   │   ├── validation.ts # Zod schemas
│   │   ├── logger.ts     # Structured logging
│   │   ├── errors.ts     # Custom error classes
│   │   ├── api-response.ts # API response formatting
│   │   └── auth-helpers.ts # Auth utilities
│   ├── domains/          # Domain-driven design (future)
│   └── infrastructure/   # External services (future)
│
├── components/           # React components
├── prisma/              # Database schema + migrations
├── types/               # TypeScript type definitions
├── middleware.ts        # Global middleware (auth, security)
├── next.config.ts       # Next.js configuration
└── tsconfig.json        # TypeScript configuration
```

## 🔐 Security Features

✅ **Authentication**
- NextAuth.js v5 with JWT
- Password hashing with bcryptjs
- Session management

✅ **Authorization**
- Multi-tenant isolation (automatic)
- Role-based access control (RBAC)
- Granular permissions (ready for implementation)

✅ **Data Protection**
- Audit logging (all changes tracked)
- Input validation (Zod)
- SQL injection prevention (Prisma)
- XSS protection (Next.js defaults)

✅ **Infrastructure**
- Security headers (CSP, HSTS, X-Frame-Options)
- CORS configuration
- Rate limiting (ready for implementation)
- Secrets management (.env validation)

## 🗄️ Database Schema

Key entities:
- **Company** - Multi-tenant root
- **User** - Users per company with roles
- **Lead** - CRM pipeline management
- **Unit** - Inventory (cars, motorcycles, boats)
- **Deal** - Sales with payments and commissions
- **AuditLog** - Complete change history
- **Role / Permission** - Granular RBAC

Migrations managed with Prisma.

```bash
npm run db:migrate          # Create migration
npm run db:migrate:dev      # Apply pending migrations (dev)
npm run db:reset            # Reset DB + reseed (dev only)
```

## 🧪 Testing & Quality

```bash
# Linting
npm run lint

# Type checking
npx tsc --noEmit

# (Coming soon) Unit tests
npm run test

# (Coming soon) E2E tests
npm run test:e2e
```

## 📝 Environment Variables

See [.env.example](./.env.example) for all available variables.

**Critical for production:**
- `NEXTAUTH_SECRET` - Change to random 32+ char string
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Set to `production`
- `NEXTAUTH_URL` - Your deployment domain

## 📚 Documentation

- **[SAAS_STRATEGY.md](./SAAS_STRATEGY.md)** - Complete business model, financials, roadmap
- **[ARCHITECTURE_DETAILED.md](./ARCHITECTURE_DETAILED.md)** - Technical architecture, patterns, stack
- **[PHASE_1_EXECUTION_PLAN.md](./PHASE_1_EXECUTION_PLAN.md)** - Weekly execution plan with tasks
- **[EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)** - High-level overview for stakeholders

## 🚢 Deployment

### Quick Start (Vercel)
```bash
# Push to GitHub, connect to Vercel
# Set environment variables in Vercel dashboard
# Automatic deployment on git push
```

### Self-hosted (Docker)
```bash
docker build -t consencionaria .
docker run -p 3000:3000 consencionaria
```

## 🐛 Troubleshooting

### Database connection issues
```bash
# Test connection
psql $DATABASE_URL

# Regenerate Prisma client
npm run db:generate
```

### NextAuth not working
- Ensure `NEXTAUTH_SECRET` is set (use `openssl rand -base64 32`)
- Check `NEXTAUTH_URL` matches your deployment domain

### Build errors
```bash
npm run db:generate  # Regenerate Prisma client
npm run build        # Rebuild (no cache)
```

## 🤝 Contributing

This is a commercial SaaS product. For feature requests or bug reports:
1. Check [GitHub Issues](../../issues)
2. Create detailed issue with reproduction steps
3. For large features, open Discussion first

## 📄 License

Proprietary - See LICENSE file

## 🆘 Support

- 📧 Email: support@consencionaria.io
- 💬 Slack: [Join community]
- 📖 Docs: [Full documentation](./SAAS_STRATEGY.md)

---

**Version**: 0.1.0  
**Last Updated**: April 21, 2026  
**Status**: Production-ready with enterprise roadmap
- Control de costos y margen real

### Catálogo Público
- Mini-sitio por concesionaria
- URL pública por unidad
- Tracking de clicks a WhatsApp

### Operaciones (Deals)
- Registro de ventas y permutas
- Comisiones a vendedores
- Gastos de cierre
- Conversión de permuta a stock

## Requisitos

- Node.js 18+
- PostgreSQL 15+
- Docker (opcional)

## Instalación Local

### 1. Clonar e instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/concesionaria?schema=public"
NEXTAUTH_SECRET="tu-secret-key-aqui"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Iniciar base de datos con Docker

```bash
docker-compose up -d db
```

O usar PostgreSQL local.

### 4. Migrar y seedear la base de datos

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Iniciar servidor de desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Cuentas de Demo

Después de correr el seed, puedes ingresar con:

- **Admin**: admin@demo.com / admin123
- **Vendedor**: vendedor@demo.com / seller123
- **Company slug**: demo

## Estructura del Proyecto

```
app/
├── (public)/          # Catálogo público (por host)
│   ├── page.tsx       # Listado de unidades
│   └── u/[id]/        # Detalle de unidad
├── app/               # Panel privado (requiere auth)
│   ├── dashboard/     # Dashboard principal
│   ├── leads/         # Gestión de leads
│   ├── units/         # Inventario
│   ├── deals/         # Operaciones
│   └── settings/      # Configuración
├── api/               # API routes
│   ├── auth/          # NextAuth
│   ├── units/         # CRUD unidades
│   └── leads/         # CRUD leads
├── login/             # Página de login
components/
├── ui/                # Componentes shadcn/ui
├── app-sidebar.tsx    # Navegación
└── app-header.tsx     # Header
lib/
├── prisma.ts          # Cliente Prisma
├── auth.ts            # Helpers de auth
├── tenant.ts          # Resolución multi-tenant
└── utils.ts           # Utilidades
prisma/
├── schema.prisma      # Esquema de BD
└── seed.ts            # Datos de demo
```

## Scripts Disponibles

- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build de producción
- `npm run db:generate` - Generar Prisma Client
- `npm run db:migrate` - Crear migración
- `npm run db:seed` - Seedear base de datos
- `npm run db:reset` - Reset + seed

## Deploy con Docker

```bash
docker-compose up -d
```

Esto inicia:
- App en http://localhost:3000
- PostgreSQL en puerto 5432
- Adminer en http://localhost:8080

## Roadmap

- [x] Scaffold Next.js + Prisma
- [x] Auth con NextAuth
- [x] CRUD Unidades
- [x] CRUD Leads
- [x] Catálogo público por host
- [x] Docker + docker-compose
- [ ] Importación/Exportación Excel
- [ ] Vista planilla (TanStack Table)
- [ ] Tracking clicks WhatsApp
- [ ] API WhatsApp Business (futuro)

## Licencia

MIT
