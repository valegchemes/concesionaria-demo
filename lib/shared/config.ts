// lib/shared/config.ts
// Environment variables validation with Zod (Server-side only)

import { z } from "zod"

const isServer = typeof window === 'undefined'

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXTAUTH_URL: z.string().url().optional().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(32).optional().default("demo-secret-key-for-development-only-123"),
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
    console.error("❌ Invalid environment variables:")
    console.error(parsed.error.flatten())
  }
  // Use defaults in browser
  env = {
    NODE_ENV: "development",
    NEXTAUTH_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "demo-secret-key-for-development-only-123",
    DATABASE_URL: "postgresql://localhost:5432/demo",
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

// Verify critical secrets only on server
if (isServer && env.NODE_ENV === "production") {
  if (env.NEXTAUTH_SECRET?.includes("demo") || env.NEXTAUTH_SECRET?.includes("your-secret")) {
    console.warn("⚠️ Using demo NEXTAUTH_SECRET in production. Set a secure value.")
  }
}
