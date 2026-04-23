# 🏛️ ARQUITECTURA TÉCNICA DETALLADA - NEXT.JS SAAS ENTERPRISE

## 1. ESTRUCTURA DE CARPETAS RECOMENDADA

```
app/
├── (app)/                              # Rutas protegidas
│   ├── layout.tsx                      # Layout principal con sidebar
│   ├── page.tsx                        # Dashboard
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # KPIs principales
│   │   └── components/
│   │       ├── revenue-chart.tsx
│   │       ├── leads-funnel.tsx
│   │       └── recent-activities.tsx
│   │
│   ├── leads/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Lista leads con paginación
│   │   ├── [id]/
│   │   │   ├── page.tsx                # Detalle lead
│   │   │   ├── layout.tsx
│   │   │   ├── activities/
│   │   │   │   └── page.tsx            # Timeline actividades
│   │   │   └── tasks/
│   │   │       └── page.tsx            # Tareas asignadas
│   │   ├── new/
│   │   │   └── page.tsx                # Crear lead (form)
│   │   └── quick/
│   │       └── page.tsx                # Quick add (modal)
│   │
│   ├── units/                          # Inventario
│   │   ├── page.tsx
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   └── new/
│   │       └── page.tsx
│   │
│   ├── deals/                          # Ventas
│   │   ├── page.tsx
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   └── new/
│   │       └── page.tsx
│   │
│   ├── reports/
│   │   ├── page.tsx                    # Dashboard reportes
│   │   ├── sales/
│   │   │   └── page.tsx                # Reporte ventas
│   │   ├── inventory/
│   │   │   └── page.tsx                # Rotación inventario
│   │   └── forecasts/
│   │       └── page.tsx                # Predicciones
│   │
│   ├── team/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   │
│   └── settings/
│       ├── page.tsx
│       ├── company/
│       │   └── page.tsx
│       ├── users/
│       │   └── page.tsx
│       ├── integrations/
│       │   └── page.tsx
│       └── billing/
│           └── page.tsx
│
├── api/
│   ├── v1/                             # API versionada
│   │   ├── leads/
│   │   │   ├── route.ts                # GET /leads, POST (crear)
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts            # GET, PATCH, DELETE individual
│   │   │   │   ├── activities/
│   │   │   │   │   └── route.ts        # GET activities, POST
│   │   │   │   └── tasks/
│   │   │   │       └── route.ts        # GET tasks, POST, DELETE
│   │   │   ├── bulk/
│   │   │   │   └── route.ts            # PATCH bulk, DELETE bulk
│   │   │   ├── search/
│   │   │   │   └── route.ts            # Full-text search
│   │   │   └── export/
│   │   │       └── route.ts            # CSV, XLSX export
│   │   │
│   │   ├── units/
│   │   ├── deals/
│   │   ├── users/
│   │   ├── reports/
│   │   ├── integrations/
│   │   └── webhooks/
│   │       └── route.ts                # Incoming webhooks
│   │
│   ├── internal/                       # Uso solo interno
│   │   ├── health/
│   │   │   └── route.ts                # Health check
│   │   ├── metrics/
│   │   │   └── route.ts                # Métricas del sistema
│   │   └── admin/
│   │       └── route.ts                # Admin operations
│   │
│   └── auth/
│       ├── [...nextauth]/
│       │   └── route.ts
│       └── register/
│           └── route.ts
│
├── components/
│   ├── layout/
│   │   ├── app-header.tsx
│   │   ├── app-sidebar.tsx
│   │   ├── breadcrumb.tsx
│   │   └── footer.tsx
│   │
│   ├── forms/
│   │   ├── lead-form.tsx               # Crear/editar lead
│   │   ├── unit-form.tsx
│   │   ├── deal-form.tsx
│   │   └── settings-form.tsx
│   │
│   ├── tables/
│   │   ├── leads-table.tsx             # Con sorting, filtering, paginación
│   │   ├── units-table.tsx
│   │   ├── deals-table.tsx
│   │   └── transactions-table.tsx
│   │
│   ├── dialogs/
│   │   ├── confirm-dialog.tsx          # Acciones destructivas
│   │   ├── bulk-action-dialog.tsx
│   │   └── filter-dialog.tsx
│   │
│   ├── charts/
│   │   ├── revenue-chart.tsx
│   │   ├── leads-funnel.tsx
│   │   └── inventory-chart.tsx
│   │
│   ├── ui/                             # shadcn primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   │
│   └── providers.tsx                   # SessionProvider, React Query, etc.
│
├── lib/
│   ├── domains/                        # Domain-driven design
│   │   ├── leads/
│   │   │   ├── service.ts              # Lead business logic
│   │   │   ├── repository.ts           # Data access
│   │   │   ├── dto.ts                  # Validation schemas
│   │   │   ├── events.ts               # Domain events
│   │   │   ├── types.ts                # TypeScript types
│   │   │   └── constants.ts            # Enum, status values
│   │   │
│   │   ├── units/
│   │   ├── deals/
│   │   ├── users/
│   │   └── reports/
│   │
│   ├── shared/
│   │   ├── auth.ts                     # Auth utilities
│   │   ├── tenant.ts                   # Multi-tenant utilities
│   │   ├── prisma.ts                   # Wrapped DB queries
│   │   ├── errors.ts                   # Custom error classes
│   │   ├── logger.ts                   # Logging (Pino)
│   │   ├── utils.ts                    # Helper functions
│   │   ├── constants.ts                # Global constants
│   │   ├── validation.ts               # Zod schemas
│   │   └── middleware.ts               # Express/Next middleware
│   │
│   └── infrastructure/
│       ├── redis.ts                    # Redis client
│       ├── jobs.ts                     # Bull job queue
│       ├── mailer.ts                   # Email service
│       ├── sentry.ts                   # Error tracking
│       ├── datadog.ts                  # Monitoring
│       └── stripe.ts                   # Payment processing
│
├── middleware/
│   ├── auth.ts                         # NextAuth middleware
│   ├── tenant.ts                       # Tenant resolution
│   ├── security.ts                     # Security headers, CORS
│   ├── rate-limit.ts                   # Rate limiting
│   ├── logging.ts                      # Request logging
│   └── error.ts                        # Error handling
│
├── types/
│   ├── next-auth.d.ts                  # NextAuth types
│   ├── entities.ts                     # Domain entity types
│   ├── api.ts                          # API request/response types
│   ├── forms.ts                        # Form data types
│   └── global.ts                       # Global types
│
├── prisma/
│   ├── schema.prisma                   # Single source of truth
│   ├── migrations/
│   │   ├── migration_lock.toml
│   │   └── 001_init.sql                # Migration history
│   ├── seed.ts                         # DB seeding
│   ├── seeds/
│   │   ├── roles.ts                    # Seed roles/permissions
│   │   └── demo-data.ts                # Demo customers
│   └── init-tables.sql
│
├── tests/
│   ├── unit/
│   │   ├── lib/
│   │   │   ├── auth.test.ts
│   │   │   └── tenant.test.ts
│   │   └── domains/
│   │       ├── leads.test.ts
│   │       └── deals.test.ts
│   │
│   ├── integration/
│   │   ├── api/
│   │   │   ├── leads.test.ts
│   │   │   ├── units.test.ts
│   │   │   └── deals.test.ts
│   │   └── multi-tenant.test.ts
│   │
│   ├── e2e/
│   │   ├── auth.test.ts
│   │   ├── lead-flow.test.ts            # Lead → Deal flow
│   │   ├── multi-tenant.test.ts
│   │   └── permissions.test.ts
│   │
│   └── fixtures/
│       ├── users.ts
│       ├── leads.ts
│       └── companies.ts
│
├── docs/
│   ├── API.md                          # API documentation
│   ├── ARCHITECTURE.md                 # Architecture decisions
│   ├── DEPLOYMENT.md                   # Deployment guide
│   ├── DEVELOPMENT.md                  # Development guide
│   └── SECURITY.md                     # Security checklist
│
├── .env.example                        # Template variables
├── .env.local                          # Local development
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── middleware.ts                       # Main middleware
├── package.json
├── docker-compose.yml
└── README.md
```

---

## 2. STACK TECNOLÓGICO DETALLADO

### Dependencies Recomendadas (package.json)

```json
{
  "dependencies": {
    "next": "^16.2.4",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    
    "@prisma/client": "^5.0.0",
    "next-auth": "^5.0.0",
    
    "zod": "^3.24.0",
    "react-hook-form": "^7.52.0",
    "@hookform/resolvers": "^3.3.4",
    
    "@tanstack/react-query": "^5.28.0",
    "@tanstack/react-table": "^8.21.3",
    
    "tailwindcss": "^3.3.0",
    "@shadcn/ui": "^0.8.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.400.0",
    
    "zustand": "^4.5.0",
    "immer": "^10.1.1",
    
    "axios": "^1.7.0",
    "stripe": "^17.0.0",
    
    "bull": "^4.14.0",
    "redis": "^4.7.0",
    
    "pino": "^9.2.0",
    "pino-pretty": "^10.3.1",
    
    "@sentry/nextjs": "^8.0.0",
    
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.1.2",
    
    "date-fns": "^3.3.1",
    "dayjs": "^1.11.10",
    "recharts": "^2.12.0",
    
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5",
    
    "@prisma/cli": "^5.0.0",
    
    "vitest": "^1.6.0",
    "@vitest/ui": "^1.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.2",
    
    "@playwright/test": "^1.44.0",
    
    "eslint": "^9",
    "eslint-config-next": "^16.2.4",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    
    "prettier": "^3.3.0",
    
    "next-rate-limit": "^1.0.0",
    "dotenv-cli": "^7.0.0"
  }
}
```

---

## 3. PATRONES IMPLEMENTACIÓN

### Pattern: Domain Service (Business Logic)

```typescript
// lib/domains/leads/service.ts
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { LeadDTO, CreateLeadDTO, UpdateLeadDTO } from './dto'
import { getTenantId } from '@/lib/shared/tenant'
import { createLogger } from '@/lib/shared/logger'

const logger = createLogger('LeadService')

export class LeadService {
  async create(data: CreateLeadDTO) {
    const tenantId = await getTenantId()
    
    logger.info({ tenantId, action: 'create_lead', data }, 'Creating lead')
    
    const lead = await prisma.lead.create({
      data: {
        ...data,
        companyId: tenantId,
        status: 'NEW',
        createdAt: new Date(),
      },
      include: { activities: true, tasks: true }
    })
    
    // Emit event para otras acciones
    await eventBus.emit('lead.created', { tenantId, leadId: lead.id })
    
    return lead
  }
  
  async findById(id: string) {
    const tenantId = await getTenantId()
    
    const lead = await prisma.lead.findFirstOrThrow({
      where: { id, companyId: tenantId },
      include: { activities: true, tasks: true, assignedTo: true }
    })
    
    return lead
  }
  
  async updateStatus(id: string, status: LeadStatus) {
    const tenantId = await getTenantId()
    
    const oldLead = await this.findById(id)
    
    const updated = await prisma.lead.update({
      where: { id, companyId: tenantId },
      data: { status, updatedAt: new Date() }
    })
    
    // Audit log
    await auditLog.record({
      tenantId, userId: session.user.id,
      action: 'UPDATE', resourceType: 'Lead',
      before: oldLead, after: updated
    })
    
    // Event
    await eventBus.emit('lead.status_changed', {
      tenantId, leadId: id, oldStatus: oldLead.status, newStatus: status
    })
    
    return updated
  }
}

export const leadService = new LeadService()
```

### Pattern: API Route con Validación & Error Handling

```typescript
// app/api/v1/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { leadService } from '@/lib/domains/leads/service'
import { CreateLeadSchema } from '@/lib/domains/leads/dto'
import { withAuth } from '@/lib/shared/middleware'
import { validateTenant } from '@/lib/shared/tenant'
import { logError } from '@/lib/shared/logger'

export const GET = withAuth(async (req: NextRequest) => {
  try {
    // Validar query params
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as LeadStatus | null
    
    // Validar límites
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination params' },
        { status: 400 }
      )
    }
    
    // Obtener datos
    const { data, total } = await leadService.findMany({
      page, limit, status
    })
    
    return NextResponse.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    logError(error, { context: 'GET /api/v1/leads' })
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (req: NextRequest) => {
  try {
    // Validar payload
    const body = await req.json()
    const validated = CreateLeadSchema.parse(body)
    
    // Crear
    const lead = await leadService.create(validated)
    
    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    
    logError(error, { context: 'POST /api/v1/leads' })
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    )
  }
})
```

### Pattern: Wrapper DB con Aislamiento Automático

```typescript
// lib/shared/prisma.ts
import { PrismaClient } from '@prisma/client'
import { getTenantId } from './tenant'

const prismaClient = new PrismaClient()

// Wrapper que añade automáticamente filtro de tenant
export const db = {
  lead: {
    async findMany(where = {}, opts = {}) {
      const tenantId = await getTenantId()
      return prismaClient.lead.findMany({
        where: { ...where, companyId: tenantId },
        ...opts
      })
    },
    
    async findFirst(where = {}) {
      const tenantId = await getTenantId()
      return prismaClient.lead.findFirst({
        where: { ...where, companyId: tenantId }
      })
    },
    
    async findFirstOrThrow(where = {}, opts = {}) {
      const tenantId = await getTenantId()
      return prismaClient.lead.findFirstOrThrow({
        where: { ...where, companyId: tenantId },
        ...opts
      })
    },
    
    async create(data) {
      const tenantId = await getTenantId()
      return prismaClient.lead.create({
        data: { ...data, companyId: tenantId }
      })
    },
    
    async update(where, data) {
      const tenantId = await getTenantId()
      return prismaClient.lead.update({
        where: { ...where, companyId: tenantId },
        data
      })
    },
    
    async delete(where) {
      const tenantId = await getTenantId()
      // Soft delete
      return prismaClient.lead.update({
        where: { ...where, companyId: tenantId },
        data: { deletedAt: new Date(), isActive: false }
      })
    }
  },
  // ... copiar patrón para units, deals, etc.
}
```

### Pattern: Event-Driven Architecture

```typescript
// lib/shared/events.ts
import { EventEmitter } from 'events'

export interface DomainEvent {
  type: string
  tenantId: string
  data: any
  timestamp: Date
  version: number
}

class EventBus extends EventEmitter {
  async emit(eventType: string, data: any) {
    const event: DomainEvent = {
      type: eventType,
      tenantId: data.tenantId,
      data,
      timestamp: new Date(),
      version: 1
    }
    
    // Log event
    console.log(`[EVENT] ${eventType}`, event)
    
    // Emit en memoria (async, no-blocking)
    super.emit(eventType, event)
    
    // Futuro: publicar a message queue (RabbitMQ/Kafka)
    // await messageQueue.publish(eventType, event)
    
    // Futuro: persistir para auditoría
    // await db.eventLog.create({ ...event })
  }
}

export const eventBus = new EventBus()

// Registrar handlers
eventBus.on('deal.closed', async (event: DomainEvent) => {
  console.log('Deal closed, triggering actions:', event.data.dealId)
  
  // 1. Actualizar inventario
  await db.unit.update(
    { id: event.data.unitId },
    { status: 'SOLD' }
  )
  
  // 2. Generar factura (background job)
  await jobQueue.add('generate_invoice', {
    dealId: event.data.dealId,
    tenantId: event.tenantId
  })
  
  // 3. Enviar notificación
  await eventBus.emit('notification.send', {
    tenantId: event.tenantId,
    type: 'deal_closed',
    userId: event.data.closedBy,
    message: `Deal closed: ${event.data.dealId}`
  })
})

eventBus.on('notification.send', async (event) => {
  // Enviar email, SMS, push notification
})
```

---

## 4. MIDDLEWARE STACK

```typescript
// middleware.ts - Main entry point
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'

export const middleware = (request: NextRequest) => {
  // 1. Security headers (siempre)
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // 2. CORS handling
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200 })
  }
  
  // 3. Rate limiting
  // ... applied in per-route level
  
  return response
}

export const config = {
  matcher: ['/((?!public|login|register).*)'],
  missing: [
    { source: '/images/:path*', destination: '/api/images/:path*' },
  ],
}
```

---

## 5. TESTING STRATEGY

```typescript
// tests/integration/api/leads.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/v1/leads/route'
import { mockDeep } from 'jest-mock-extended'

describe('POST /api/v1/leads', () => {
  let request: NextRequest
  
  beforeEach(() => {
    // Setup
    vi.mock('@/lib/shared/tenant', () => ({
      getTenantId: () => 'tenant-123'
    }))
  })
  
  it('should create a lead with valid data', async () => {
    const body = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+5491234567890',
      source: 'WEBSITE',
      status: 'NEW'
    }
    
    const request = new NextRequest('http://localhost:3000/api/v1/leads', {
      method: 'POST',
      body: JSON.stringify(body)
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.name).toBe('John Doe')
  })
  
  it('should fail with invalid email', async () => {
    const body = { name: 'John', email: 'invalid-email' }
    const response = await POST(/* ... */)
    
    expect(response.status).toBe(400)
  })
})

// tests/e2e/lead-flow.test.ts (Playwright)
import { test, expect } from '@playwright/test'

test.describe('Lead to Deal Flow', () => {
  test('should convert lead to deal', async ({ page }) => {
    // 1. Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'seller@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('[type="submit"]')
    
    // 2. Create lead
    await page.goto('/app/leads')
    await page.click('button:has-text("New Lead")')
    await page.fill('[name="name"]', 'Prospect Name')
    await page.fill('[name="email"]', 'prospect@example.com')
    await page.click('button:has-text("Create")')
    
    // 3. Convert to deal
    await page.click('[data-testid="lead-convert-btn"]')
    await page.click('button:has-text("Confirm")')
    
    // 4. Verify
    expect(await page.locator('[data-testid="status"]')).toContainText('DEAL')
  })
})
```

---

## 6. DEPLOYMENT CONFIGURATION

```dockerfile
# Dockerfile - Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build
COPY . .
RUN npx prisma generate
RUN npm run build

# Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy built app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/internal/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run
CMD ["npm", "run", "start"]
```

```yaml
# vercel.json
{
  "buildCommand": "npm run build && npx prisma generate",
  "outputDirectory": ".next",
  "env": {
    "NEXTAUTH_SECRET": "@nextauth_secret",
    "DATABASE_URL": "@database_url",
    "REDIS_URL": "@redis_url"
  },
  "functions": {
    "api/**": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

---

**Documento versión**: 1.0  
**Status**: 🟢 Listo para implementación  
**Próximo**: Crear documento de Plan de Ejecución Fase 1
