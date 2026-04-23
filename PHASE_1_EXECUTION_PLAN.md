# 🚀 PLAN DE EJECUCIÓN FASE 1: MVP COMERCIAL

**Duración**: 12 semanas | **Equipo**: 1 Senior FullStack + 1 Junior (opcional) | **Costo**: $6.5K | **Resultado**: Producto vendible, production-ready

---

## 📅 TIMELINE GENERAL

```
Semana 1-2:   Security & Auth Hardening
Semana 3-4:   Escalabilidad & Performance
Semana 5-6:   Observabilidad & Logging
Semana 7-8:   Features MVP & Validation
Semana 9-10:  Testing & Quality Assurance
Semana 11-12: Deployment & Launch
```

---

## SEMANA 1-2: SECURITY & AUTH HARDENING

### Objetivo: Asegurar aplicación antes de production

#### ✅ TASK 1.1: Rate Limiting

**Descripción**: Proteger API contra brute force y DDoS

**Cambios necesarios**:

```typescript
// lib/shared/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
})

// Global rate limiter
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "10 s"),
  analytics: true,
})

// Auth-specific (login attempts)
export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 min"),
  analytics: true,
  prefix: "ratelimit:login",
})

// API limiter
export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, "1 d"),
  analytics: true,
  prefix: "ratelimit:api",
})
```

```typescript
// middleware.ts - Aplicar rate limiting
export const middleware = async (request: NextRequest) => {
  const ip = request.ip || "127.0.0.1"
  
  // Rate limit global
  const { success, limit, remaining, reset } = await rateLimiter.limit(ip)
  
  if (!success) {
    return new NextResponse("Rate limit exceeded", {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    })
  }
  
  return NextResponse.next()
}
```

**Estimación**: 3-4 horas  
**Testing**: Simular 100+ requests, verificar 429  
**PR**: `feat: add rate limiting protection`

---

#### ✅ TASK 1.2: Secrets Management

**Descripción**: Mover secrets de hardcoded a .env

**Cambios necesarios**:

```bash
# .env.example (COMMIT THIS)
NEXTAUTH_SECRET=your-secret-key-here
DATABASE_URL=postgresql://user:password@localhost:5432/db
REDIS_URL=redis://localhost:6379
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
```

```bash
# .env.local (DO NOT COMMIT)
NEXTAUTH_SECRET=actual-secret-from-generator
DATABASE_URL=postgresql://vale:password@neon.tech/db
REDIS_URL=redis://user:password@redis.cloud:6379
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
```

```typescript
// lib/shared/config.ts
import { z } from "zod"

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  NEXTAUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().optional(),
})

export const env = EnvSchema.parse(process.env)
```

```yaml
# vercel.json
{
  "env": {
    "NEXTAUTH_SECRET": "@nextauth_secret",
    "DATABASE_URL": "@database_url",
    "REDIS_URL": "@redis_url"
  }
}
```

**Cambios en docker-compose.yml**:

```yaml
# docker-compose.yml - NEVER hardcode secrets
services:
  app:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - REDIS_URL=${REDIS_URL}
```

**Estimación**: 2 horas  
**Testing**: `npm run build` sin secrets expuestos  
**PR**: `chore: move secrets to .env`

---

#### ✅ TASK 1.3: CORS & Security Headers

**Descripción**: Configurar CORS y headers de seguridad

```typescript
// middleware.ts - Security headers
import { NextRequest, NextResponse } from "next/server"

export const middleware = (request: NextRequest) => {
  const response = NextResponse.next()

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'"
  )
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  )
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  )

  // CORS
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin")
    const allowedOrigins = [
      "http://localhost:3000",
      process.env.NEXTAUTH_URL,
    ]

    if (allowedOrigins.includes(origin || "")) {
      response.headers.set("Access-Control-Allow-Origin", origin || "")
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      )
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      )
      response.headers.set("Access-Control-Max-Age", "86400")
    }

    return new NextResponse(null, { status: 200, headers: response.headers })
  }

  return response
}
```

**Estimación**: 2 horas  
**Testing**: Usar curl/Postman, verificar headers  
**PR**: `chore: add security headers and CORS`

---

#### ✅ TASK 1.4: CSRF Protection

**Descripción**: Implementar CSRF tokens con NextAuth v5

**Cambios necesarios**:

NextAuth v5 incluye CSRF protection automática. Solo necesitas:

```typescript
// lib/auth.ts - NextAuth v5 config
import { NextAuthConfig } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        // ... validación
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 horas
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.companyId = user.companyId
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.companyId = token.companyId as string
      session.user.role = token.role as string
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}
```

**Estimación**: 1 hora (ya viene con NextAuth v5)  
**Testing**: Verificar CSRF token en POST requests  
**PR**: `chore: upgrade nextauth to v5`

---

#### ✅ TASK 1.5: Input Sanitization

**Descripción**: Validar y sanitizar inputs

```typescript
// lib/shared/validation.ts
import { z } from "zod"

// Sanitizar strings
const sanitizeString = (value: string) => {
  return value.trim().slice(0, 500) // Max length
}

// Schemas reusables
export const EmailSchema = z
  .string()
  .email()
  .toLowerCase()
  .transform(sanitizeString)

export const PhoneSchema = z
  .string()
  .regex(/^[+\d\s-()]+$/, "Invalid phone format")
  .transform((v) => v.replace(/\s/g, ""))

export const NameSchema = z
  .string()
  .min(2)
  .max(100)
  .transform(sanitizeString)
  .refine((v) => !/[<>{}[\]]/g.test(v), "Invalid characters")

export const CreateLeadSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  phone: PhoneSchema,
  source: z.enum(["WEBSITE", "PHONE", "WHATSAPP", "REFERRAL"]),
})
```

**Estimación**: 3 horas  
**Testing**: Intentar XSS payloads, verificar sanitización  
**PR**: `feat: add comprehensive input validation`

---

#### ✅ TASK 1.6: Audit Logging

**Descripción**: Implementar auditoría de cambios

**Schema Prisma**:

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String   @db.Uuid
  company   Company  @relation(fields: [tenantId], references: [id])
  
  userId    String   @db.Uuid
  user      User     @relation(fields: [userId], references: [id])
  
  action    String   @db.VarChar(50) // CREATE, UPDATE, DELETE
  resourceType String @db.VarChar(50) // Lead, Unit, Deal
  resourceId String  @db.Uuid
  
  before    Json?    // Previous state
  after     Json?    // New state
  
  ipAddress String?
  userAgent String?
  reason    String?
  
  createdAt DateTime @default(now())
  
  @@index([tenantId, createdAt])
  @@index([userId, createdAt])
  @@index([resourceType, resourceId])
}
```

```typescript
// lib/shared/audit.ts
import { AuditLog } from "@prisma/client"
import { prisma } from "@/lib/shared/prisma"

export async function recordAudit({
  tenantId,
  userId,
  action,
  resourceType,
  resourceId,
  before,
  after,
  ipAddress,
  userAgent,
  reason,
}: {
  tenantId: string
  userId: string
  action: "CREATE" | "UPDATE" | "DELETE"
  resourceType: string
  resourceId: string
  before?: any
  after?: any
  ipAddress?: string
  userAgent?: string
  reason?: string
}) {
  return prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      before: before || null,
      after: after || null,
      ipAddress,
      userAgent,
      reason,
    },
  })
}
```

```typescript
// Uso en API routes
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession()
  const body = await req.json()
  
  // Get old state
  const oldLead = await db.lead.findFirstOrThrow({ where: { id: params.id } })
  
  // Update
  const newLead = await db.lead.update(
    { where: { id: params.id } },
    { data: body }
  )
  
  // Record audit
  await recordAudit({
    tenantId: session.user.companyId,
    userId: session.user.id,
    action: "UPDATE",
    resourceType: "Lead",
    resourceId: params.id,
    before: oldLead,
    after: newLead,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  })
  
  return NextResponse.json(newLead)
}
```

**Estimación**: 4 horas  
**Testing**: Verificar audit logs en DB  
**PR**: `feat: add audit logging`

---

### 📋 CHECKLIST SEMANA 1-2

- [ ] Rate limiting implementado (login + API)
- [ ] Secrets en .env (nunca hardcoded)
- [ ] CORS configurado
- [ ] Security headers en middleware
- [ ] CSRF protection (NextAuth v5)
- [ ] Input sanitization (todos los endpoints)
- [ ] Audit logging schema + implementation
- [ ] Tests básicos de seguridad
- [ ] PR review y merge
- [ ] Deploy a staging y test
- [ ] Documentación de cambios

**Estimación Total Semana 1-2**: 40-50 horas  
**Status**: 🟡 Critical path

---

## SEMANA 3-4: ESCALABILIDAD & PERFORMANCE

### Objetivo: Preparar para múltiples tenants sin degradación

#### ✅ TASK 3.1: Paginación en todos los GET

```typescript
// lib/shared/pagination.ts
export interface PaginationParams {
  page: number
  limit: number
  sort?: string
  order?: "asc" | "desc"
}

export function validatePagination(page?: string, limit?: string) {
  const p = Math.max(1, parseInt(page || "1"))
  const l = Math.max(1, Math.min(100, parseInt(limit || "20")))
  return { page: p, limit: l, skip: (p - 1) * l }
}

export async function paginate<T>(
  count: Promise<number>,
  data: Promise<T[]>,
  page: number,
  limit: number
) {
  const [total, items] = await Promise.all([count, data])
  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
    },
  }
}
```

```typescript
// app/api/v1/leads/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const { page, limit, skip } = validatePagination(
    searchParams.get("page"),
    searchParams.get("limit")
  )
  
  const tenantId = await getTenantId()
  
  const [count, leads] = await Promise.all([
    prisma.lead.count({ where: { companyId: tenantId } }),
    prisma.lead.findMany({
      where: { companyId: tenantId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ])
  
  return NextResponse.json(
    paginate(
      Promise.resolve(count),
      Promise.resolve(leads),
      page,
      limit
    )
  )
}
```

**Estimación**: 6 horas (aplicar a 5 endpoints principales)  
**PR**: `feat: add pagination to all list endpoints`

---

#### ✅ TASK 3.2: Caching con Redis

```typescript
// lib/infrastructure/redis.ts
import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
})

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  // Try cache
  const cached = await redis.get<T>(key)
  if (cached) return cached
  
  // Fetch
  const data = await fetcher()
  
  // Cache
  await redis.setex(key, ttl, JSON.stringify(data))
  
  return data
}

export async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
```

```typescript
// Uso en API
export async function GET(req: NextRequest, { params }) {
  const tenantId = await getTenantId()
  
  const lead = await getCached(
    `lead:${params.id}:${tenantId}`,
    () =>
      prisma.lead.findFirstOrThrow({
        where: { id: params.id, companyId: tenantId },
      }),
    600 // 10 min TTL
  )
  
  return NextResponse.json(lead)
}

// Invalidar cache cuando actualiza
export async function PATCH(req: NextRequest, { params }) {
  // ... update logic
  
  // Invalidate cache
  await invalidateCache(`lead:${params.id}:*`)
  await invalidateCache(`leads:${tenantId}:*`)
}
```

**Estimación**: 4 horas  
**PR**: `feat: add redis caching layer`

---

#### ✅ TASK 3.3: Database Optimization

```typescript
// Analizar queries lentas
// En Neon console: EXPLAIN ANALYZE SELECT ...

// Crear índices faltantes
model Lead {
  id         String @id @default(cuid())
  companyId  String @db.Uuid
  status     String
  assignedToId String? @db.Uuid
  createdAt  DateTime @default(now())
  
  // Indices para performance
  @@index([companyId])
  @@index([companyId, status])
  @@index([companyId, assignedToId])
  @@index([companyId, createdAt])
}

model Unit {
  id        String @id @default(cuid())
  companyId String @db.Uuid
  status    String
  vin       String?
  
  @@unique([companyId, vin]) // Prevenir duplicados
  @@index([companyId])
  @@index([companyId, status])
}
```

**Estimación**: 3 horas  
**PR**: `chore: optimize database indexes`

---

#### ✅ TASK 3.4: Background Jobs (Bull)

```typescript
// lib/infrastructure/jobs.ts
import Queue from "bull"
import { redis } from "./redis"

export const emailQueue = new Queue("email", {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
})

export const whatsappQueue = new Queue("whatsapp", {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
})

export const reportQueue = new Queue("reports", {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
})

// Processors
emailQueue.process(async (job) => {
  const { to, subject, template, data } = job.data
  
  // Send email
  await sendEmail({
    to,
    subject,
    html: renderTemplate(template, data),
  })
  
  return { sent: true }
})

// Usar en API
export async function POST(req: Request) {
  const lead = await db.lead.create(/* ... */)
  
  // Queue email instead of sending sync
  await emailQueue.add({
    to: lead.email,
    subject: "Welcome to AutoHub",
    template: "welcome",
    data: { name: lead.name },
  })
  
  return NextResponse.json(lead, { status: 201 })
}
```

**Estimación**: 5 horas  
**PR**: `feat: add background job queue with Bull`

---

### 📋 CHECKLIST SEMANA 3-4

- [ ] Paginación en todos GET endpoints
- [ ] Redis caching layer funcional
- [ ] Database indexes optimizados
- [ ] Bull job queue configurado
- [ ] Email queue implementada
- [ ] Load tests (100+ concurrent users)
- [ ] Performance metrics (query times < 100ms)
- [ ] PR review y merge
- [ ] Deploy staging y test

**Estimación Total Semana 3-4**: 40-50 horas

---

## SEMANA 5-6: OBSERVABILIDAD & LOGGING

### Objetivo: Visibilidad total del sistema

#### ✅ TASK 5.1: Logging Estructurado (Pino)

```typescript
// lib/shared/logger.ts
import pino from "pino"

const transport = pino.transport({
  target: "pino-pretty",
  options: {
    colorize: process.env.NODE_ENV === "development",
    singleLine: false,
    translateTime: "HH:MM:ss Z",
    ignore: "pid,hostname",
  },
})

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    base: {
      env: process.env.NODE_ENV,
      service: "autohub-api",
    },
  },
  transport
)

export function createLogger(name: string) {
  return logger.child({ module: name })
}
```

```typescript
// Uso en servicios
const log = createLogger("LeadService")

export async function createLead(data) {
  log.info({ data }, "Creating lead")
  
  const lead = await db.lead.create(data)
  
  log.info({ leadId: lead.id }, "Lead created successfully")
  
  return lead
}
```

**Estimación**: 3 horas  
**PR**: `feat: add structured logging with pino`

---

#### ✅ TASK 5.2: Error Tracking (Sentry)

```typescript
// lib/infrastructure/sentry.ts
import * as Sentry from "@sentry/nextjs"

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    debug: process.env.NODE_ENV === "development",
  })
}

// middleware.ts
import { initSentry } from "@/lib/infrastructure/sentry"

initSentry()

export const middleware = (request) => {
  try {
    // ... middleware logic
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        context: "middleware",
      },
    })
    throw error
  }
}
```

**Estimación**: 2 horas  
**PR**: `feat: add sentry error tracking`

---

#### ✅ TASK 5.3: Request/Response Logging

```typescript
// middleware/logging.ts
import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/shared/logger"

export async function withLogging(handler: Function) {
  return async (req: NextRequest) => {
    const startTime = Date.now()
    const path = req.nextUrl.pathname
    const method = req.method
    
    logger.info({ method, path }, "Request started")
    
    try {
      const response = await handler(req)
      const duration = Date.now() - startTime
      
      logger.info(
        {
          method,
          path,
          status: response.status,
          duration,
        },
        "Request completed"
      )
      
      return response
    } catch (error) {
      const duration = Date.now() - startTime
      
      logger.error(
        {
          method,
          path,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
        "Request failed"
      )
      
      throw error
    }
  }
}
```

**Estimación**: 3 horas  
**PR**: `feat: add comprehensive request logging`

---

#### ✅ TASK 5.4: Metrics & Monitoring

```typescript
// lib/infrastructure/metrics.ts
import { logger } from "@/lib/shared/logger"

export interface AppMetrics {
  requests: number
  errors: number
  averageResponseTime: number
  activeDatabases: number
  queuedJobs: number
}

let metrics: AppMetrics = {
  requests: 0,
  errors: 0,
  averageResponseTime: 0,
  activeDatabases: 0,
  queuedJobs: 0,
}

export async function recordMetric(name: string, value: number) {
  logger.info({ metric: name, value }, "Metric recorded")
  
  // Enviar a DataDog/New Relic
  if (process.env.DATADOG_API_KEY) {
    // await sendToDataDog(name, value)
  }
}

export function getMetrics() {
  return metrics
}
```

```typescript
// app/api/internal/metrics/route.ts
export async function GET() {
  const metrics = getMetrics()
  
  return NextResponse.json(metrics)
}
```

**Estimación**: 2 horas  
**PR**: `feat: add metrics endpoint`

---

### 📋 CHECKLIST SEMANA 5-6

- [ ] Logging estructurado con Pino
- [ ] Sentry error tracking configurado
- [ ] Request/response logging
- [ ] Metrics collection
- [ ] Health check endpoint
- [ ] Logs viewables en terminal
- [ ] Alertas Sentry configuradas
- [ ] PR review y merge
- [ ] Deploy staging y test

**Estimación Total Semana 5-6**: 30-40 horas

---

## SEMANA 7-8: FEATURES MVP & VALIDATION

### Objetivo: Producto vendible, validar PMF

#### ✅ TASK 7.1: Dashboard mejorado

- KPIs principales (MRR, Leads, Deals, Revenue)
- Gráficos simples (Recharts)
- Filtros por fecha/estado

**Estimación**: 8 horas

#### ✅ TASK 7.2: Gestión de usuarios

- Invitar usuarios a company
- Cambiar rol/permisos
- Desactivar usuario

**Estimación**: 6 horas

#### ✅ TASK 7.3: Validaciones mejoradas

- Email verification
- Phone verification (SMS)

**Estimación**: 6 horas

#### ✅ TASK 7.4: Contact & Outreach primeros clientes

- Identificar 5-10 concesionarios objetivo
- Crear script de pitch
- Email outreach + follow-up

**Estimación**: 10 horas (no dev)

### 📋 CHECKLIST SEMANA 7-8

- [ ] Dashboard con KPIs principales
- [ ] Gestión de usuarios completa
- [ ] Email verification implementada
- [ ] 5 clientes contactados
- [ ] 1-2 clientes en trial
- [ ] Feedback loop iniciado

**Estimación Total Semana 7-8**: 40-50 horas (incluyendo sales)

---

## SEMANA 9-10: TESTING & QA

### Objetivo: Confianza en calidad del código

#### ✅ TASK 9.1: E2E Tests (Playwright)

- Login → Create Lead → Convert Deal
- User management
- Multi-tenant isolation

**Estimación**: 8 horas

#### ✅ TASK 9.2: Unit/Integration Tests

- Services principales (80% coverage)
- Validaciones Zod
- Error handling

**Estimación**: 8 horas

#### ✅ TASK 9.3: Load Testing

- 100+ usuarios concurrentes
- Identificar bottlenecks
- Ajustar límites

**Estimación**: 4 horas

#### ✅ TASK 9.4: Security Testing

- OWASP Top 10 checks
- SQL injection attempts
- CSRF verification

**Estimación**: 4 horas

### 📋 CHECKLIST SEMANA 9-10

- [ ] E2E tests críticos pasando
- [ ] 80% unit test coverage
- [ ] Load test exitoso (100+ users)
- [ ] Security review pasado
- [ ] Zero critical vulnerabilities
- [ ] CI/CD pipeline funcionando

**Estimación Total Semana 9-10**: 40-50 horas

---

## SEMANA 11-12: DEPLOYMENT & LAUNCH

### Objetivo: Producción + clientes pagantes

#### ✅ TASK 11.1: Production Hardening

- SSL/TLS certificados
- Security headers
- Rate limiting activado
- Backups automáticos

**Estimación**: 3 horas

#### ✅ TASK 11.2: Documentación

- API docs (Swagger)
- Setup guide
- Admin manual

**Estimación**: 5 horas

#### ✅ TASK 11.3: Launch

- Deploy a Vercel production
- Verificar funcionalidad end-to-end
- Monitoreo en vivo

**Estimación**: 4 horas

#### ✅ TASK 11.4: Customer Onboarding

- Crear primeros 5 clientes pagantes
- Training webinars
- Support channel (Slack/email)

**Estimación**: 6 horas

### 📋 CHECKLIST SEMANA 11-12

- [ ] App en producción (Vercel)
- [ ] SSL/TLS validado
- [ ] Documentación completa
- [ ] 5+ clientes pagantes
- [ ] MRR ~$500-1000
- [ ] Monitoreo 24/7
- [ ] Launch announcement
- [ ] Métricas SaaS tracking

**Estimación Total Semana 11-12**: 30-40 horas

---

## 📊 RESUMEN EJECUCIÓN FASE 1

### Timeline Realista

```
Semana 1-2:   40-50 h (Seguridad)
Semana 3-4:   40-50 h (Escalabilidad)
Semana 5-6:   30-40 h (Observabilidad)
Semana 7-8:   40-50 h (Features + Sales)
Semana 9-10:  40-50 h (Testing)
Semana 11-12: 30-40 h (Deployment)
──────────────────────────
TOTAL:        220-280 horas (para 1 dev senior)
```

**Para 1 Senior + 1 Junior**: Reducir 30% (160-200 horas totales)

### Recursos Necesarios

```
Personas
├─ 1 Full-Stack Senior (React + Node.js + Prisma)
├─ 1 Junior (opcional, ayuda con tests/docs)
└─ Occasional: Sales/Marketing

Herramientas ($~$300-500/mes)
├─ GitHub Pro ($21)
├─ Vercel Pro ($20)
├─ Neon PostgreSQL ($0-50)
├─ Redis Cloud ($7)
├─ Sentry ($0-29)
├─ DataDog ($15 min)
└─ Stripe ($0, 2.9% fee)

Tiempo
├─ Coding: 220-280 horas
├─ Code review: 40 horas
├─ Testing: 50 horas
├─ Docs: 20 horas
├─ Deployment: 20 horas
└─ TOTAL: 350-430 horas (~10-12 semanas full-time)
```

### Budget

```
Desarrollo
├─ Senior dev: 280 h × $75/h = $21,000
├─ Junior dev: 140 h × $30/h = $4,200 (optional)
└─ Subtotal: $21,000-25,200

Infrastructure
├─ Hosting (Vercel + BD): $150/mes = $600 (6 meses)
├─ Herramientas: $400/mes = $1,600 (6 meses)
└─ Subtotal: $2,200

TOTAL COSTO FASE 1: $23,200-27,400

OPTIMIZED (1 dev, external support):
├─ Senior dev: $10,000
├─ Contractor support: $3,000
├─ Infrastructure: $2,200
└─ TOTAL: $15,200
```

### Métricas de Éxito

```
✅ TÉCNICAS
├─ 80%+ test coverage
├─ Todos endpoints validados
├─ 0 security vulnerabilities críticas
├─ Response time < 200ms (p95)
├─ Uptime > 99%
└─ Zero data leaks

✅ COMERCIALES
├─ 5-10 clientes en trial
├─ 3-5 clientes pagantes
├─ MRR $300-1000
├─ CAC < $1000
├─ NPS > 30
└─ Churn < 5%

✅ PRODUCTO
├─ Feature completeness (100% MVP spec)
├─ UX scores: Lighthouse > 80
├─ Dashboard funcional
├─ API documentada
└─ Onboarding < 30 min
```

---

## 🎯 PRÓXIMOS PASOS (Hoy - Esta Semana)

### Hoy
- [ ] Revisar este documento
- [ ] Setup GitHub project/milestones
- [ ] Crear backlog en GitHub Issues

### Esta Semana
- [ ] Setup CI/CD (GitHub Actions)
- [ ] Crear rama `feature/saas-refactor`
- [ ] Iniciar Task 1.1 (Rate Limiting)
- [ ] Daily standup (si equipo)

### Semana 1-2
- [ ] Completar todas las tasks de Seguridad
- [ ] Code reviews diarios
- [ ] Deploy a staging cada 2 días
- [ ] Weekly demo + feedback

---

**Documento versión**: 1.0  
**Status**: 🟢 Listo para kickoff  
**Fecha**: 20 de abril de 2026  
**Próxima revisión**: Fin de Semana 2
