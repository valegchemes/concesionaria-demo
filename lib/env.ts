/**
 * Validación centralizada de variables de entorno
 * Se valida lazy - solo cuando se accede por primera vez
 */

import { z } from 'zod'

const envSchema = z.object({
  // Stripe - REQUIRED for webhooks
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PUBLIC_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),

  // NextAuth
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters').optional(),
  NEXTAUTH_URL: z.string().optional(),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL').optional(),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid URL').optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL').optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // App URLs
  PUBLIC_URL: z.string().optional(),

  // Sentry
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Redis/KV
  KV_URL: z.string().optional(),
  KV_REST_API_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type EnvConfig = z.infer<typeof envSchema>

// Cached validation
let cachedEnv: EnvConfig | null = null
let validationError: Error | null = null

/**
 * Validate and get environment variables
 * Only validates on first access
 */
function getEnv(): EnvConfig {
  if (cachedEnv !== null) {
    return cachedEnv
  }

  if (validationError) {
    throw validationError
  }

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:')
    console.error(parsed.error.flatten().fieldErrors)
    const error = new Error('Invalid environment variables')
    validationError = error
    throw error
  }

  cachedEnv = parsed.data
  return cachedEnv
}

/**
 * Create a lazy proxy that validates only on first access
 */
export const env: EnvConfig = new Proxy({} as EnvConfig, {
  get(_, prop: string | symbol) {
    return getEnv()[prop as keyof EnvConfig]
  },
})

/**
 * Get computed values with fallbacks
 */
export const computedEnv = {
  get PUBLIC_URL() {
    const e = getEnv()
    const url = e.PUBLIC_URL || (e.NODE_ENV === 'production' ? undefined : 'http://localhost:3000')
    if (e.NODE_ENV === 'production' && !url) {
      throw new Error('PUBLIC_URL is required in production')
    }
    return url
  },
} as const
