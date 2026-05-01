// lib/shared/validation.ts
// Reusable Zod schemas for form validation

import { z } from "zod"

// ============================================================================
// Common Field Validators
// ============================================================================

export const StringSchema = z.string().trim().min(1, "This field is required")
export const OptionalStringSchema = z.string().trim().optional().or(z.literal(""))

export const EmailSchema = z
  .string()
  .email("Invalid email address")
  .toLowerCase()
  .trim()

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")

export const PhoneSchema = z
  .string()
  .regex(/^[+\d\s\-()]+$/, "Invalid phone format")
  .min(7, "Phone number too short")
  .max(20, "Phone number too long")
  .transform(v => v.replace(/\s/g, "")) // Remove spaces

export const NameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters")
  .refine(v => !/[<>{}[\]]/g.test(v), "Invalid characters in name")

export const SlugSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and dashes")

export const URLSchema = z.string().url("Invalid URL")

export const CurrencySchema = z
  .number()
  .nonnegative("Amount must be 0 or positive")
  .or(z.string().regex(/^\d+(\.\d{2})?$/).transform(Number))

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
  notes: z.string().max(500).optional().or(z.literal("")),
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
  priceArs: CurrencySchema.optional().nullable(),
  priceUsd: CurrencySchema.optional().nullable(),
  acquisitionCostArs: CurrencySchema.optional().nullable(),
  acquisitionCostUsd: CurrencySchema.optional().nullable(),
  description: z.string().max(2000).optional().or(z.literal("")).nullable(),
  year: z.number().int().min(1800).max(2100).optional().nullable(),
  location: z.string().max(200).optional().or(z.literal("")).nullable(),
  status: UnitStatusEnum.default('AVAILABLE'),
  vin: z.string().optional().or(z.literal("")).nullable(),
  domain: z.string().optional().or(z.literal("")).nullable(),
  engineNumber: z.string().optional().or(z.literal("")).nullable(),
  frameNumber: z.string().optional().or(z.literal("")).nullable(),
  hin: z.string().optional().or(z.literal("")).nullable(),
  registrationNumber: z.string().optional().or(z.literal("")).nullable(),
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
})

export type CreateDealInput = z.infer<typeof CreateDealSchema>
export type LeadStatus = z.infer<typeof LeadStatusEnum>
export type LeadSource = z.infer<typeof LeadSourceEnum>
export type UnitType = z.infer<typeof UnitTypeEnum>
export type UnitStatus = z.infer<typeof UnitStatusEnum>
export type DealStatus = z.infer<typeof DealStatusEnum>
