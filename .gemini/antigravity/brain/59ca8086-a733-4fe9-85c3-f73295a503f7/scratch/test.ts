// Run this with ts-node
import { z } from 'zod';

const UnitTypeEnum = z.enum(['CAR', 'MOTORCYCLE', 'BOAT'])
const UnitStatusEnum = z.enum(['AVAILABLE', 'IN_PREP', 'RESERVED', 'SOLD', 'DISCARDED'])
const CurrencySchema = z.number().nonnegative("Amount must be 0 or positive").or(z.string().regex(/^\d+(\.\d{2})?$/).transform(Number))

const CreateUnitSchema = z.object({
  title: z.string(),
  type: UnitTypeEnum,
  priceArs: CurrencySchema.optional().nullable(),
  priceUsd: CurrencySchema.optional().nullable(),
  acquisitionCostArs: CurrencySchema.optional().nullable(),
  acquisitionCostUsd: CurrencySchema.optional().nullable(),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  status: UnitStatusEnum.default('AVAILABLE'),
  vin: z.string().optional().or(z.literal("")),
  domain: z.string().optional().or(z.literal("")),
  engineNumber: z.string().optional().or(z.literal("")),
  frameNumber: z.string().optional().or(z.literal("")),
  hin: z.string().optional().or(z.literal("")),
  registrationNumber: z.string().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  photos: z.array(z.object({ url: z.string(), order: z.number() })).optional(),
})

const UpdateUnitSchema = CreateUnitSchema.partial().extend({
  status: UnitStatusEnum.optional(),
})

const payload = {
  id: "cmoathlre000313x2e6i5q21r",
  title: "123",
  type: "CAR",
  priceArs: 123,
  priceUsd: 123,
  acquisitionCostArs: 1123,
  acquisitionCostUsd: 0,
  description: "123",
  location: "123",
  status: "AVAILABLE",
  photos: [],
  costItems: [],
  interestedLeads: []
};

try {
  const result = UpdateUnitSchema.parse(payload);
  console.log("SUCCESS:", result);
} catch (e) {
  console.log("ERROR:", JSON.stringify(e.errors, null, 2));
}
