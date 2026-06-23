#!/usr/bin/env tsx
/**
 * Startup Environment Validation
 * 
 * This script validates ALL required environment variables at startup.
 * Should be called early in the application lifecycle (e.g., in a custom server, 
 * or as a pre-build step) to fail fast if critical configuration is missing.
 */

import { z } from 'zod'

// ============================================================================
// REQUIRED ENVIRONMENT VARIABLES (must be present in all environments)
// ============================================================================

const requiredEnvSchema = z.object({
  // NextAuth
  NEXTAUTH_SECRET: z.string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters')
    .refine(val => {
      const weakSecrets = ['your-secret', 'change-me', 'example', 'test', 'demo', 'password', '12345', 'secret']
      const valLower = val.toLowerCase()
      return !weakSecrets.some(weak => valLower.includes(weak))
    }, 'NEXTAUTH_SECRET contains weak/insecure patterns'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid PostgreSQL connection string'),
  
  // Mercado Pago (required for payments)
  MP_ACCESS_TOKEN: z.string().min(1, 'MP_ACCESS_TOKEN is required'),
  MP_PUBLIC_KEY: z.string().min(1, 'MP_PUBLIC_KEY is required'),
  MP_WEBHOOK_SECRET: z.string().min(1, 'MP_WEBHOOK_SECRET is required'),
  
  // Blob storage
  BLOB_READ_WRITE_TOKEN: z.string().min(1, 'BLOB_READ_WRITE_TOKEN is required'),
});

// ============================================================================
// PRODUCTION-ONLY REQUIRED VARIABLES
// ============================================================================

const productionRequiredSchema = z.object({
  // Supabase (for catalog/public access)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  
  // Pusher (realtime)
  PUSHER_APP_ID: z.string().min(1, 'PUSHER_APP_ID is required'),
  PUSHER_KEY: z.string().min(1, 'PUSHER_KEY is required'),
  PUSHER_SECRET: z.string().min(1, 'PUSHER_SECRET is required'),
  PUSHER_CLUSTER: z.string().min(1, 'PUSHER_CLUSTER is required'),
  NEXT_PUBLIC_PUSHER_KEY: z.string().min(1, 'NEXT_PUBLIC_PUSHER_KEY is required'),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().min(1, 'NEXT_PUBLIC_PUSHER_CLUSTER is required'),
  
  // Redis/KV (for rate limiting - one of KV_URL or UPSTASH_REDIS_REST_URL)
  KV_URL: z.string().url('KV_URL must be a valid URL'),
  KV_REST_API_URL: z.string().url('KV_REST_API_URL must be a valid URL'),
  KV_REST_API_TOKEN: z.string().min(1, 'KV_REST_API_TOKEN is required'),
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),
  
  // Sentry (error tracking)
  SENTRY_DSN: z.string().url('SENTRY_DSN must be a valid URL'),
  SENTRY_ORG: z.string().min(1, 'SENTRY_ORG is required'),
  SENTRY_PROJECT: z.string().min(1, 'SENTRY_PROJECT is required'),
  
  // Security secrets
  DIAG_SECRET_TOKEN: z.string().min(32, 'DIAG_SECRET_TOKEN must be at least 32 characters'),
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters'),
  
  // Public URL for production
  PUBLIC_URL: z.string().url('PUBLIC_URL must be a valid URL'),
  
  // NextAuth URL must be HTTPS in production (stricter than required)
  NEXTAUTH_URL: z.string().url().refine(url => url.startsWith('https://'), {
    message: 'NEXTAUTH_URL must use HTTPS in production'
  }),
})

// ============================================================================
// OPTIONAL VARIABLES (with defaults) — SIN DUPLICAR CON productionRequiredSchema
// ============================================================================

const optionalSchema = z.object({
  // Stripe (deprecated but kept for migration)
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLIC_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  
  // Analytics
  DEFAULT_EXCHANGE_RATE_ARS_PER_USD: z.coerce.number().positive().default(1000),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // NextAuth URL must use HTTPS in production
  NEXTAUTH_URL: z.string().url().optional(),
});

// ============================================================================
// COMPLETE SCHEMA — SIN DUPLICACIONES
// ============================================================================

const fullEnvSchema = requiredEnvSchema
  .and(productionRequiredSchema)
  .and(optionalSchema);

// Type for the validated environment
export type ValidatedEnv = z.infer<typeof fullEnvSchema>

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function validateEnvironment(): { success: boolean; errors: string[]; validatedEnv: Record<string, string> } {
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Select schema based on environment
  const schema = isProduction ? fullEnvSchema : requiredEnvSchema
  
  const result = schema.safeParse(process.env)
  
  if (!result.success) {
    const errors = result.error.errors.map(e => 
      `${e.path.join('.')}: ${e.message}`
    )
    return { success: false, errors, validatedEnv: {} }
  }
  
  return { 
    success: true, 
    errors: [], 
    validatedEnv: result.data as Record<string, string> 
  }
}

// ============================================================================
// STARTUP VALIDATION
// ============================================================================

/**
 * Valida el entorno y, si falla, sale del proceso con código 1.
 * Usar SOLO cuando se ejecuta como script CLI (tsx) o en un servidor custom.
 * NO usar dentro de lambdas/serverless runtime (usar `validateEnvironmentNonFatal`).
 */
export function validateEnvironmentAtStartup(): void {
  const result = validateEnvironment()

  if (!result.success) {
    console.error('\n❌ ═══════════════════════════════════════════')
    console.error('❌  ENVIRONMENT VALIDATION FAILED')
    console.error('═══════════════════════════════════════════\n')
    console.error('Missing or invalid environment variables:\n')
    result.errors.forEach(err => console.error(`  ❌ ${err}`))
    console.error('\n═══════════════════════════════════════════\n')
    console.error('Please check your .env file and ensure all required variables are set.')
    console.error('For production, ensure all production-only variables are set.\n')
    process.exit(1)
  }

  console.log('✅ Environment validation passed')

  // Warn about weak secrets in development
  if (process.env.NODE_ENV !== 'production') {
    const weakSecrets = [
      'NEXTAUTH_SECRET',
      'CRON_SECRET',
      'DIAG_SECRET_TOKEN'
    ]

    for (const secret of weakSecrets) {
      const value = process.env[secret]
      if (value && (value.length < 32 || ['your-secret', 'change-me', 'example', 'test', 'demo', 'password', '12345', 'secret'].some(w => value.toLowerCase().includes(w)))) {
        console.warn(`⚠️  Warning: ${secret} appears to be weak or a placeholder value`)
      }
    }
  }
}

/**
 * Valida el entorno SIN salir del proceso. Apta para runtime serverless
 * (Vercel): si hay errores, los loguea como `console.error` pero NO mata la
 * lambda (eso dejaría la app caída y ocultaría el problema tras un 500).
 *
 * Devuelve `true` si el entorno es válido.
 */
export function validateEnvironmentNonFatal(): boolean {
  const result = validateEnvironment()

  if (!result.success) {
    console.error('\n❌ ENVIRONMENT VALIDATION FAILED (non-fatal, runtime)')
    console.error('Missing/invalid environment variables:')
    for (const err of result.errors) console.error(`  ❌ ${err}`)
    console.error('')
    return false
  }

  return true
}
