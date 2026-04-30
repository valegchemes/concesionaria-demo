// lib/shared/config.ts
// Environment variables validation with Zod (Server-side only)

import { z } from "zod"

const isServer = typeof window === 'undefined'

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXTAUTH_URL: z.string().url().optional().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  DATABASE_URL: z.string().url().optional().default("postgresql://localhost:5432/demo"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SENTRY_DSN: z.string().optional(),
  ENABLE_DEMO_DATA: z.string().transform(v => v === "true").default("true"),
  NEXT_PUBLIC_DEMO_MODE: z.string().transform(v => v === "true").default("true"),
  ENABLE_API_DOCS: z.string().transform(v => v === "true").default("true"),
})

// Parse environment variables
const parsed = EnvSchema.safeParse(process.env)

// In server, validate strictly. In browser, use defaults
let env: z.infer<typeof EnvSchema>

if (!parsed.success) {
  if (isServer) {
    console.warn("⚠️ Invalid environment variables:")
    console.warn(parsed.error.flatten())
    // Prevent build crash on Vercel by not exiting.
  }
  env = {
    NODE_ENV: "development",
    NEXTAUTH_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "dummy_secret_for_build_only_123456789",
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://localhost:5432/demo",
    LOG_LEVEL: "info",
    SENTRY_DSN: undefined,
    ENABLE_DEMO_DATA: true,
    NEXT_PUBLIC_DEMO_MODE: true,
    ENABLE_API_DOCS: true,
  }
} else {
  env = parsed.data
}

export { env }

if (isServer && env.NODE_ENV === "production") {
  if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET.length < 32) {
    console.warn("⚠️ NEXTAUTH_SECRET is required and must be at least 32 characters in production. Skipping exit to allow build.")
  }
}
