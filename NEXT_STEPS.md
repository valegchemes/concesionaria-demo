// NEXT_STEPS.md

# Next Immediate Steps

**Status**: Foundation complete ✅  
**Goal**: Implement domain services and refactor API routes  
**Timeline**: 2-4 hours work

---

## 🎯 Task 1: Create Unit Service (30 minutes)

### Files to Create
1. `lib/domains/units/types.ts` - Unit domain types
2. `lib/domains/units/service.ts` - Unit business logic
3. `lib/domains/units/index.ts` - Export file

### Template: Copy from Lead Service
The Lead service in `lib/domains/leads/service.ts` is your template. Adapt it for Units:

- Change class name: `LeadService` → `UnitService`
- Change model: `lead` → `unit`
- Change interfaces: `CreateLeadCommand` → `CreateUnitCommand`
- Adjust validations for Unit-specific rules:
  - Valid unit types: `AUTO | MOTORCYCLE | BOAT`
  - Require: `title`, `type`, `year`, `mileage`, `price`
  - Status: `AVAILABLE | RESERVED | SOLD | DISCARDED`

### Methods to Implement
```typescript
// Core CRUD
async create(command: CreateUnitCommand): Promise<UnitWithRelations>
async getById(id: string, companyId: string): Promise<UnitWithRelations>
async list(companyId, { page, limit, type, status }): Promise<ListResult>
async update(id, companyId, command: UpdateUnitCommand): Promise<UnitWithRelations>
async delete(id: string, companyId: string): Promise<void>

// Unit-specific
async search(companyId, query, limit): Promise<SearchResult>
async getByPrice(companyId, min, max): Promise<UnitWithRelations[]>
async validateStatusTransition(current, new): Promise<void>
async getAvailableUnits(companyId): Promise<Unit[]>
```

---

## 🎯 Task 2: Create Deal Service (30 minutes)

### Files to Create
1. `lib/domains/deals/types.ts` - Deal domain types
2. `lib/domains/deals/service.ts` - Deal business logic
3. `lib/domains/deals/index.ts` - Export file

### Deal-Specific Logic
```typescript
// Status transitions
NEW → NEGOTIATING → OFFERED → ACCEPTED → COMPLETED → CLOSED

// Relations
- Deal has 1 Lead
- Deal has 1 Unit
- Deal has many DealPayments
- Deal has many DealCostItems

// Methods
async create(CreateDealCommand): Promise<DealWithRelations>
async updateStatus(id, newStatus): Promise<void>  // Validate transitions
async recordPayment(dealId, amount, method): Promise<DealPayment>
async getDealValue(dealId): Promise<{gross, costItems, net}>
async closeDeal(dealId, completionNotes): Promise<void>
```

---

## 🎯 Task 3: Refactor Lead API Route (45 minutes)

### Current File
`app/api/v1/leads/route.ts`

### Changes Needed

**Before:**
```typescript
export async function GET(request: NextRequest) {
  // Manual validation
  // Manual error handling
  // Manual logging
}
```

**After:**
```typescript
import { withErrorHandling, successResponse, paginatedResponse } from '@/lib/shared/api-response'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { CreateLeadSchema, UpdateLeadSchema } from '@/lib/shared/validation'
import { leadService } from '@/lib/domains/leads/service'

// GET - List leads with pagination
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()
  
  const page = Number(request.nextUrl.searchParams.get('page')) || 1
  const limit = Number(request.nextUrl.searchParams.get('limit')) || 20
  const status = request.nextUrl.searchParams.get('status')
  const assignedToId = request.nextUrl.searchParams.get('assignedToId')
  
  const { leads, pagination } = await leadService.list(user.companyId, {
    page,
    limit,
    status: status || undefined,
    assignedToId: assignedToId || undefined,
  })
  
  return paginatedResponse(leads, pagination.total, pagination.page, pagination.limit)
})

// POST - Create new lead
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await getCurrentUser()
  const requireRole('ADMIN', 'MANAGER')  // Only admins/managers
  
  const json = await request.json()
  const data = CreateLeadSchema.parse(json)
  
  const lead = await leadService.create({
    ...data,
    companyId: user.companyId,
    createdById: user.id,
  })
  
  return successResponse(lead, 201)
})
```

### Also Create Parameterized Routes

**`app/api/v1/leads/[id]/route.ts`**
```typescript
// GET /api/v1/leads/123
export const GET = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser()
  const lead = await leadService.getById(params.id, user.companyId)
  return successResponse(lead)
})

// PUT /api/v1/leads/123
export const PUT = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser()
  const json = await request.json()
  const data = UpdateLeadSchema.parse(json)
  
  const lead = await leadService.update(params.id, user.companyId, data)
  return successResponse(lead)
})

// DELETE /api/v1/leads/123
export const DELETE = withErrorHandling(async (request, { params }) => {
  const user = await getCurrentUser()
  await leadService.delete(params.id, user.companyId)
  return successResponse({ deleted: true })
})
```

---

## 🎯 Task 4: Similar Refactor for Units (30 minutes)

Update:
- `app/api/v1/units/route.ts` - Use `unitService`
- `app/api/v1/units/[id]/route.ts` - Use `unitService`

---

## 🎯 Task 5: Similar Refactor for Deals (30 minutes)

Update:
- `app/api/v1/deals/route.ts` - Use `dealService`
- `app/api/v1/deals/[id]/route.ts` - Use `dealService`

---

## ✅ Verification Checklist After Each Task

After implementing each service:

```bash
# 1. Ensure no TypeScript errors
npx tsc --noEmit

# 2. Ensure Prisma client is up to date
npm run db:generate

# 3. Start dev server
npm run dev

# 4. Test the API endpoint
curl http://localhost:3000/api/v1/leads \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"

# 5. Check response format
# Should be: { success: true, data: [...], pagination: {...} }
```

---

## 📋 Code Checklist for Each Service

When creating a new service, ensure:

- ✅ Created `/lib/domains/{resource}/types.ts` with domain types
- ✅ Created `/lib/domains/{resource}/service.ts` with service class
- ✅ Created `/lib/domains/{resource}/index.ts` exporting singleton
- ✅ `const log = createLogger('ServiceName')` at top
- ✅ Every method has logging: `log.info()` for success, `log.error()` for failures
- ✅ All user input validated at entry point
- ✅ All queries filtered by `companyId` (multi-tenant safety)
- ✅ Proper error types thrown: `NotFoundError`, `ValidationError`, etc.
- ✅ Return types match TypeScript definitions
- ✅ No `console.log` (use logger instead)

---

## 📋 Code Checklist for API Routes

When updating API routes, ensure:

- ✅ Imported `withErrorHandling` wrapper
- ✅ Called `getCurrentUser()` to get authenticated user
- ✅ Used `user.companyId` for all queries (never user input)
- ✅ Validate input with `Schema.parse(input)` or use schema-based helpers
- ✅ Service methods handle all business logic
- ✅ Return consistent response format: `successResponse()` or `paginatedResponse()`
- ✅ Errors automatically caught and serialized (thanks to `withErrorHandling`)
- ✅ No try-catch blocks (wrapper handles it)
- ✅ No manual error responses needed
- ✅ Proper HTTP status codes (201 for POST, 200 for GET/PUT, 204/200 for DELETE)

---

## 🚀 Timeline Estimate

| Task | Time | Total |
|------|------|-------|
| 1. Unit Service | 30 min | 30 min |
| 2. Deal Service | 30 min | 1 hr |
| 3. Refactor Leads Routes | 45 min | 1:45 |
| 4. Refactor Units Routes | 30 min | 2:15 |
| 5. Refactor Deals Routes | 30 min | 2:45 |
| 6. Testing + Fixes | 30 min | 3:15 |
| **Total** | | **~3 hours** |

---

## 🔗 Reference Files

Keep these open while working:

1. **Template**: `lib/domains/leads/service.ts` - Copy structure
2. **Patterns**: `DEVELOPMENT_PATTERNS.md` - Coding standards
3. **Validation**: `lib/shared/validation.ts` - Available schemas
4. **Errors**: `lib/shared/errors.ts` - Error types
5. **API Response**: `lib/shared/api-response.ts` - Response helpers
6. **Auth Helpers**: `lib/shared/auth-helpers.ts` - Auth utilities

---

## 💡 Pro Tips

1. **Use Find & Replace** - When copying Lead service to Unit service, use find/replace:
   - `LeadService` → `UnitService`
   - `lead` → `unit`
   - `Lead` → `Unit`

2. **Copy Routes** - When refactoring routes, keep lead routes as-is and copy to units/deals

3. **Test Incrementally** - After each service created, test it immediately

4. **Run Migrations** - If you modified Prisma schema: `npm run db:migrate`

5. **Type Safety** - Let TypeScript guide you. If something is underlined, read the error

---

## 🆘 Common Issues

**Issue**: "Module not found: lib/domains/units/service"
**Fix**: Ensure you created the file AND exported the singleton at the bottom

**Issue**: "Cannot find name 'unitService'"
**Fix**: Add `import { unitService } from '@/lib/domains/units/service'` to route

**Issue**: "Type 'unknown' is not assignable to type 'string'"
**Fix**: Use `getCurrentUser()` to get typed user object instead of casting

**Issue**: "Prisma FindUnique requires a unique field"
**Fix**: Use `findFirst()` with `where: { id, companyId }` instead of `findUnique()`

---

## 📞 Need Help?

- Reference patterns: See `DEVELOPMENT_PATTERNS.md` section on Service Layer Pattern
- Copy structure: Use `lib/domains/leads/service.ts` as template
- Type help: Hover over types in VS Code to see definitions
- Error help: Custom errors in `lib/shared/errors.ts` with examples

---

**Status**: Ready to implement  
**Difficulty**: Easy (template provided)  
**Estimated Time**: 3 hours total

Start with Task 1 (Unit Service) - it's the simplest and will give you confidence for the rest!
