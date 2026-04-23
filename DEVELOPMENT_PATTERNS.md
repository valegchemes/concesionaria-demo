// DEVELOPMENT_PATTERNS.md

# Professional Development Patterns

This document establishes the patterns and best practices for professional-grade code in this project.

## 1. Service Layer Pattern

All business logic lives in the `lib/domains/{resource}/service.ts` layer.

### Structure
```
lib/domains/
├── leads/
│   ├── types.ts          # Domain types
│   ├── service.ts        # Business logic
│   ├── repository.ts     # Data access (optional)
│   └── index.ts          # Exports
├── units/
│   ├── types.ts
│   ├── service.ts
│   └── index.ts
└── deals/
    ├── types.ts
    ├── service.ts
    └── index.ts
```

### Service Class Template
```typescript
import { createLogger } from '@/lib/shared/logger'
import { NotFoundError, ValidationError } from '@/lib/shared/errors'
import { prisma } from '@/lib/shared/prisma'

const log = createLogger('MyService')

export class MyService {
  async create(data: CreateCommand): Promise<Result> {
    log.info({ context }, 'Creating resource')
    
    // Validation
    // Database operations
    // Logging
    
    log.info({ resourceId }, 'Resource created')
    return result
  }
  
  async getById(id: string, companyId: string): Promise<Result> {
    const resource = await prisma.resource.findFirst({
      where: { id, companyId }
    })
    
    if (!resource) {
      throw new NotFoundError('Resource', id)
    }
    
    return resource
  }
}

export const myService = new MyService()
```

## 2. API Route Pattern

All API routes use the `withErrorHandling` wrapper.

### Template
```typescript
// app/api/v1/leads/route.ts

import { NextRequest } from 'next/server'
import { withErrorHandling, successResponse, paginatedResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { CreateLeadSchema } from '@/lib/shared/validation'
import { leadService } from '@/lib/domains/leads/service'

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()
  
  const json = await request.json()
  const data = CreateLeadSchema.parse(json)
  
  const lead = await leadService.create({
    ...data,
    companyId: user.companyId,
    createdById: user.id,
  })
  
  return successResponse(lead, 201)
})

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()
  
  const page = Number(request.nextUrl.searchParams.get('page')) || 1
  const limit = Number(request.nextUrl.searchParams.get('limit')) || 20
  const status = request.nextUrl.searchParams.get('status') || undefined
  
  const result = await leadService.list(user.companyId, {
    page,
    limit,
    status,
  })
  
  return paginatedResponse(
    result.leads,
    result.pagination.total,
    result.pagination.page,
    result.pagination.limit
  )
})
```

## 3. Error Handling

### Use Custom Errors
```typescript
// ✅ DO
throw new NotFoundError('Lead', leadId)
throw new ValidationError('Invalid phone format')
throw new ForbiddenError('You cannot access this resource')
throw new ConflictError('Lead already exists')

// ❌ DON'T
throw new Error('Not found')
throw new Error('Invalid input')
throw { error: 'Forbidden' }
```

### Error Handling in Routes
Wrapped with `withErrorHandling` - errors are automatically caught and serialized.

## 4. Logging

### Pattern
```typescript
const log = createLogger('ModuleName')

// Info: General operations
log.info({ leadId, status }, 'Lead status updated')

// Debug: Detailed information
log.debug({ query, filters }, 'Searching leads')

// Warn: Unexpected but handled
log.warn({ userId }, 'User not found in cache')

// Error: Errors (usually caught by error boundary)
log.error({ error: err.message }, 'Database connection failed')
```

### Context Object
Always pass relevant context as first argument:
```typescript
log.info(
  { leadId, companyId, userId, action: 'CREATE' },
  'Lead created'
)
```

## 5. Validation

### Schemas
Use reusable Zod schemas from `lib/shared/validation.ts`

```typescript
import { CreateLeadSchema, UpdateLeadSchema } from '@/lib/shared/validation'

// In API route
const data = CreateLeadSchema.parse(request.json())
// Types are inferred: typeof data === CreateLeadInput

// In service
const validated = CreateLeadSchema.parse(userInput)
```

### Custom Validation
```typescript
import { z } from 'zod'

const MySchema = z.object({
  email: EmailSchema,
  phone: PhoneSchema,
  status: z.enum(['NEW', 'CONTACTED', 'LOST']),
}).strict()
```

## 6. Multi-Tenant Safety

### Rules
1. **Never trust user input for companyId**
   ```typescript
   // ❌ DON'T
   const { companyId } = request.json()
   
   // ✅ DO
   const user = await getCurrentUser() // Contains verified companyId
   const { companyId } = user
   ```

2. **Always filter by companyId**
   ```typescript
   // ✅ ALWAYS INCLUDE companyId IN WHERE CLAUSE
   await prisma.lead.findFirst({
     where: { id, companyId }
   })
   
   // ❌ NEVER QUERY WITHOUT companyId FILTER
   await prisma.lead.findUnique({
     where: { id }
   })
   ```

3. **Use `requireCompanyAccess()` for additional safety**
   ```typescript
   await requireCompanyAccess(companyId)
   ```

## 7. Database Operations

### Use Prisma Client
```typescript
import { prisma } from '@/lib/shared/prisma'

// Single operations
const lead = await prisma.lead.create({ data })

// Batch operations with Promise.all
const [leads, total] = await Promise.all([
  prisma.lead.findMany({ where, skip, take }),
  prisma.lead.count({ where })
])

// Transactions (for atomic operations)
await prisma.$transaction([
  prisma.lead.update({ where, data }),
  prisma.auditLog.create({ data }),
])
```

## 8. Configuration

### Use Type-Safe Config
```typescript
import { env } from '@/lib/shared/config'

// All environment variables are typed
const logLevel = env.LOG_LEVEL // Type: 'debug' | 'info' | 'warn' | 'error'
const dbUrl = env.DATABASE_URL   // Type: string (guaranteed to exist)

// Sentry only if configured
if (env.SENTRY_DSN) {
  initSentry(env.SENTRY_DSN)
}
```

## 9. Types

### Domain Types
Put domain-specific types in `lib/domains/{resource}/types.ts`

```typescript
export type LeadWithRelations = Lead & {
  activities: LeadActivity[]
  assignedTo?: User | null
}

export interface CreateLeadCommand {
  name: string
  phone: string
  companyId: string
  createdById: string
}
```

### Global Types
Put shared types in `types/` folder

```typescript
types/
├── next-auth.d.ts     # NextAuth augmentations
├── common.ts          # Shared types (Pagination, Cursor, etc.)
└── api.ts             # API response types
```

## 10. Testing

### Unit Tests (Future)
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { LeadService } from '@/lib/domains/leads/service'

describe('LeadService', () => {
  let service: LeadService
  
  beforeEach(() => {
    service = new LeadService()
  })
  
  it('should create a lead with valid data', async () => {
    const lead = await service.create({
      name: 'John Doe',
      phone: '555-1234',
      companyId: 'test-company',
      createdById: 'test-user',
    })
    
    expect(lead).toHaveProperty('id')
    expect(lead.name).toBe('John Doe')
  })
})
```

### E2E Tests (Future)
```typescript
import { test, expect } from '@playwright/test'

test('create lead flow', async ({ page }) => {
  await page.goto('/app/leads')
  await page.click('text=New Lead')
  await page.fill('[name=name]', 'John Doe')
  await page.fill('[name=phone]', '555-1234')
  await page.click('text=Create')
  
  await expect(page).toHaveURL('/app/leads/[id]')
})
```

## 11. Code Organization

### Import Order
```typescript
// 1. External packages
import { NextResponse } from 'next/server'
import { z } from 'zod'

// 2. Internal absolute imports
import { prisma } from '@/lib/shared/prisma'
import { leadService } from '@/lib/domains/leads/service'

// 3. Relative imports
import type { MyType } from './types'

// 4. Types (if not grouped above)
import type { Lead } from '@prisma/client'
```

### File Naming
- Services: `service.ts` (class) or `service.ts` for functions
- Types: `types.ts`
- Routes: `route.ts`
- Components: `ComponentName.tsx` (PascalCase)
- Utilities: `kebab-case.ts` or `camelCase.ts`

## 12. Security

### Input Validation
✅ **Always validate before using**
```typescript
const data = CreateLeadSchema.parse(input)
```

### Authentication
✅ **Always check user session**
```typescript
const user = await getCurrentUser()
```

### Authorization
✅ **Always verify company access**
```typescript
await requireCompanyAccess(user.companyId, resourceCompanyId)
```

### Secrets
✅ **Never log secrets**
```typescript
log.info({ userId }, 'User logged in')  // ✅ Good
log.info({ password }, 'User password') // ❌ Bad
```

## 13. Performance

### Pagination
Always paginate list endpoints
```typescript
const { page = 1, limit = 20 } = query
const offset = (page - 1) * limit

const [items, total] = await Promise.all([
  prisma.lead.findMany({ skip: offset, take: limit }),
  prisma.lead.count({ where })
])
```

### Selective Includes
Only fetch related data when needed
```typescript
// For list: minimal data
prisma.lead.findMany({ select: { id, name, phone } })

// For detail: full data with relations
prisma.lead.findFirst({ include: { activities, assignedTo } })
```

### Caching (Future)
```typescript
const cached = await cache.get(`lead:${id}`)
if (cached) return cached

const lead = await prisma.lead.findFirst({ ... })
await cache.set(`lead:${id}`, lead, 3600) // 1 hour

return lead
```

## 14. Environment-Specific Behavior

### Development
- Verbose logging (pino-pretty)
- Seed data available
- CORS enabled

### Production
- JSON structured logs
- Sentry enabled
- No seed data
- No debug endpoints

```typescript
if (process.env.NODE_ENV === 'development') {
  // dev-only code
}

if (process.env.NODE_ENV === 'production') {
  // prod-only code
}
```

## 15. Commits & PRs

### Commit Message Format
```
feat: Add lead service
fix: Fix validation error in registration
docs: Update README
test: Add unit tests for LeadService
chore: Update dependencies

[Optional description with context and reasons]
```

### PR Template
```markdown
## What
Brief description of changes

## Why
Reason for the change

## How
Technical implementation approach

## Testing
How to test the changes

## Checklist
- [ ] Tests pass
- [ ] Follows development patterns
- [ ] No security issues
- [ ] Documentation updated
```

---

**Version**: 1.0  
**Last Updated**: April 21, 2026  

Follow these patterns to maintain professional-grade code quality across the project.
