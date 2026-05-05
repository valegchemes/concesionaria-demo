/**
 * Validación centralizada de variables de entorno
 * Se valida en build-time con Zod
 * Exports un objeto tipado con todas las env vars
 */

import { z } from 'zod'

const envSchema = z.object({
  // Stripe
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  STRIPE_PUBLIC_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),

  // NextAuth
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().optional(),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid URL').optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
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

type Env = z.infer<typeof envSchema>

/**
 * Parse and validate environment variables
 * Throws error if validation fails
 */
function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:')
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables')
  }

  return parsed.data
}

// Parse env at module load time (catches issues early)
export const env = getEnv()

/**
 * Get computed values with fallbacks
 */
export const computedEnv = {
  // PUBLIC_URL fallback: localhost in dev, required in prod
  PUBLIC_URL:
    env.PUBLIC_URL ||
    (env.NODE_ENV === 'production' ? undefined : 'http://localhost:3000'),
} as const

// Type guard to ensure PUBLIC_URL exists in production
if (env.NODE_ENV === 'production' && !computedEnv.PUBLIC_URL) {
  throw new Error(
    'PUBLIC_URL is required in production. Set it in your environment variables.'
  )
}

export type EnvConfig = Env
