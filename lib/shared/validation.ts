// lib/shared/validation.ts
// Reusable Zod schemas for form validation

import { z } from "zod"

/**
 * Sanitiza una cadena de texto eliminando etiquetas HTML potencialmente peligrosas (mitigación XSS)
 */
export function sanitizeString(val: string | null | undefined): string {
  if (!val) return ""
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Elimina etiquetas script
    .replace(/<[^>]+>/g, '') // Elimina cualquier otra etiqueta HTML
    .trim()
}

// ============================================================================
// Common Field Validators
// ============================================================================

export const StringSchema = z.string().trim().min(1, "Este campo es requerido").transform(sanitizeString)
export const OptionalStringSchema = z.string().trim().transform(sanitizeString).optional().or(z.literal(""))

export const EmailSchema = z
  .string()
  .email("Dirección de email inválida")
  .toLowerCase()
  .trim()

export const PasswordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "La contraseña debe contener al menos una letra mayúscula")
  .regex(/[a-z]/, "La contraseña debe contener al menos una letra minúscula")
  .regex(/[0-9]/, "La contraseña debe contener al menos un número")

export const PhoneSchema = z
  .string()
  // E.164: opcionalmente + al inicio, luego 7-15 dígitos (sin espacios ni guiones)
  .regex(/^\+?[1-9]\d{1,14}$/, "Formato de teléfono inválido (ej: +5491112345678)")
  .transform(v => v.replace(/\s/g, "")) // Elimina espacios residuales

export const NameSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(100, "El nombre debe tener como máximo 100 caracteres")
  .transform(sanitizeString)
  .refine(v => !/[<>{}[\]]/g.test(v), "Caracteres inválidos en el nombre")

export const SlugSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-z0-9-]+$/, "El slug solo puede contener letras minúsculas, números y guiones")

export const URLSchema = z.string().url("URL inválida")

export const CurrencySchema = z
  .number()
  .nonnegative("Amount must be 0 or positive")
  .max(999_999_999.99, "Amount exceeds maximum allowed value")
  .refine(
    (v) => Number.isFinite(v) && Math.round(v * 100) === v * 100,
    "Amount must have at most 2 decimal places"
  )
  .or(
    z.string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid currency format")
      .transform(Number)
      .refine((v) => v <= 999_999_999.99, "Amount exceeds maximum allowed value")
  )

// Esquema específico para Dólares para prevenir errores de tipeo millonarios
export const UsdCurrencySchema = z.number()
  .nonnegative("Amount must be 0 or positive")
  .max(2_000_000, "Monto en USD excede el límite razonable de 2.000.000")
  .refine(
    (v) => Number.isFinite(v) && Math.round(v * 100) === v * 100,
    "Amount must have at most 2 decimal places"
  )
  .or(
    z.string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid currency format")
      .transform(Number)
      .refine((v) => v <= 2_000_000, "Monto en USD excede el límite razonable de 2.000.000")
  )

// ============================================================================
// Auth Schemas
// ============================================================================

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required"),
})

export const RegisterCompanySchema = z.object({
  companyName: NameSchema,
  slug: SlugSchema,
  companyPhone: PhoneSchema.optional(),
  companyEmail: EmailSchema.optional().or(z.literal("")),
  adminName: NameSchema,
  adminEmail: EmailSchema,
  password: PasswordSchema,
})

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: z.string(),
  name: NameSchema,
})
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

// ============================================================================
// Lead Schemas
// ============================================================================

export const LeadSourceEnum = z.enum([
  "INSTAGRAM",
  "FACEBOOK_MARKETPLACE",
  "REFERRAL",
  "WALK_IN",
  "PHONE",
  "WEBSITE",
  "WHATSAPP",
  "OLX",
  "AUTOSUSADOS",
  "OTHER"
])
export const LeadStatusEnum = z.enum([
  "NEW",
  "CONTACTED",
  "VISIT_SCHEDULED",
  "OFFER",
  "RESERVED",
  "SOLD",
  "LOST",
])

export const CreateLeadSchema = z.object({
  name: NameSchema,
  email: EmailSchema.optional().or(z.literal("")),
  phone: PhoneSchema,
  source: LeadSourceEnum.default("WEBSITE"),
  status: LeadStatusEnum.default("NEW"),
  notes: z.string().max(500).transform(sanitizeString).optional().or(z.literal("")),
  assignedToId: z.string().optional().nullable(),
  interestedUnitId: z.string().optional().nullable(),
})

export const UpdateLeadSchema = CreateLeadSchema.partial().extend({
  status: LeadStatusEnum.optional(),
  assignedToId: z.string().optional().nullable(),
  interestedUnitId: z.string().optional().nullable(),
})

// ============================================================================
// Unit/Inventory Schemas
// ============================================================================

export const UnitTypeEnum = z.enum(['CAR', 'MOTORCYCLE', 'BOAT'])
export const UnitStatusEnum = z.enum(['AVAILABLE', 'IN_PREP', 'RESERVED', 'SOLD'])

export const CreateUnitSchema = z.object({
  title: NameSchema,
  type: UnitTypeEnum,
  brand: z.string().trim().transform(sanitizeString).optional(),
  model: z.string().trim().transform(sanitizeString).optional(),
  priceArs: CurrencySchema.optional().nullable(),
  priceUsd: UsdCurrencySchema.optional().nullable(),
  acquisitionCostArs: CurrencySchema.optional().nullable(),
  acquisitionCostUsd: UsdCurrencySchema.optional().nullable(),
  description: z.string().max(2000).transform(sanitizeString).optional().or(z.literal("")).nullable(),
  year: z.number().int().min(1800).max(2100).optional().nullable(),
  location: z.string().max(200).transform(sanitizeString).optional().or(z.literal("")).nullable(),
  status: UnitStatusEnum.default('AVAILABLE'),
  vin: z.string().transform(sanitizeString).optional().or(z.literal("")).nullable(),
  domain: z.string().transform(sanitizeString).optional().or(z.literal("")).nullable(),
  engineNumber: z.string().transform(sanitizeString).optional().or(z.literal("")).nullable(),
  frameNumber: z.string().transform(sanitizeString).optional().or(z.literal("")).nullable(),
  hin: z.string().transform(sanitizeString).optional().or(z.literal("")).nullable(),
  registrationNumber: z.string().transform(sanitizeString).optional().or(z.literal("")).nullable(),
  tags: z.array(z.string()).optional(),
  photos: z.array(z.object({ url: z.string(), order: z.number() })).optional(),
  attributes: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
})

export const UpdateUnitSchema = CreateUnitSchema.partial().extend({
  status: UnitStatusEnum.optional(),
})

// ============================================================================
// Deal Schemas
// ============================================================================

// Reuse DealStatusEnum from CreateDealSchema (defined below)
export const UpdateDealSchema = z.object({
  status: z.enum(['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT', 'DELIVERED', 'CANCELED']).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
  finalPrice: CurrencySchema.optional(),
  finalPriceCurrency: z.enum(['ARS', 'USD']).optional(),
  exchangeRate: z.number().positive().optional(),
})

// ============================================================================
// Company/Settings Schemas
// ============================================================================

export const UpdateCompanySchema = z.object({
  name: NameSchema.optional(),
  phone: PhoneSchema.optional().or(z.literal('')),
  email: EmailSchema.optional().or(z.literal('')),
  whatsappCentral: z.string().optional().or(z.literal('')),
  cuit: z.string().optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  currencyPreference: z.enum(['ARS', 'USD', 'BOTH']).optional(),
  logoUrl: z.string().optional().or(z.literal('')),
  signatureUrl: z.string().optional().or(z.literal('')),
})

// ============================================================================
// Type Exports
// ============================================================================

export type LoginInput = z.infer<typeof LoginSchema>
export type RegisterInput = z.infer<typeof RegisterSchema>
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>
export type UpdateDealInput = z.infer<typeof UpdateDealSchema>

export const DealStatusEnum = z.enum([
  'NEGOTIATION',
  'RESERVED',
  'APPROVED',
  'IN_PAYMENT',
  'DELIVERED',
  'CANCELED',
])

export const CreateDealSchema = z.object({
  leadId: z.string().min(1, "Client is required"),
  unitId: z.string().min(1, "Unit is required"),
  sellerId: z.string().min(1, "Seller is required"),
  finalPrice: CurrencySchema,
  finalPriceCurrency: z.enum(['ARS', 'USD']).default('ARS'),
  status: DealStatusEnum.default('NEGOTIATION'),
  depositAmount: CurrencySchema.optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
  tradeIn: z.object({
    description: z.string().min(1, "Descripción de la unidad es requerida"),
    type: UnitTypeEnum,
    expectedValue: CurrencySchema,
    photos: z.array(z.object({ url: z.string(), order: z.number() })).optional(),
  }).optional(),
})

// Override the tradeIn type to include photos
export type CreateDealInput = Omit<z.infer<typeof CreateDealSchema>, 'tradeIn'> & {
  tradeIn?: {
    description: string
    type: 'CAR' | 'MOTORCYCLE' | 'BOAT'
    expectedValue: number
    photos?: Array<{ url: string; order: number }>
  } | null
}
export type LeadStatus = z.infer<typeof LeadStatusEnum>
export type LeadSource = z.infer<typeof LeadSourceEnum>
export type UnitType = z.infer<typeof UnitTypeEnum>
export type UnitStatus = z.infer<typeof UnitStatusEnum>
export type DealStatus = z.infer<typeof DealStatusEnum>

// ============================================================================
// Payment Schemas (for /api/deals/[id] POST - Record Payment)
// ============================================================================

export const PaymentMethodEnum = z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'CARD', 'FINANCING'])

export const RecordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0').finite(),
  method: PaymentMethodEnum,
  reference: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>

// ============================================================================
// WhatsApp Template Schemas (for /api/whatsapp/templates POST)
// ============================================================================

export const WhatsAppTemplateSchema = z.object({
  name: NameSchema,
  template: z.string().min(1, 'Template content is required').max(2000),
  isDefault: z.boolean().default(false),
})

export type WhatsAppTemplateInput = z.infer<typeof WhatsAppTemplateSchema>

// ============================================================================
// Task Schemas (for /api/leads/[id]/tasks POST/PATCH)
// ============================================================================

export const CreateTaskSchema = z.object({
  title: StringSchema,
  description: z.string().max(500).optional().or(z.literal('')),
  dueDate: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
  isCompleted: z.boolean().default(false),
})

export const UpdateTaskSchema = z.object({
  isCompleted: z.boolean().optional(),
  title: StringSchema.optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  dueDate: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
})

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>
