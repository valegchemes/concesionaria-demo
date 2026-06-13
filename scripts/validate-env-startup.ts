#!/usr/bin/env tsx
/**
 * Startup Environment Validation
 * 
 * Run this script at application startup to validate all required
 * environment variables are present and secure.
 * 
 * Usage:
 *   npx tsx scripts/validate-env-startup.ts
 * 
 * Or import in your custom server:
 *   import { validateEnvironmentAtStartup } from './scripts/validate-env-startup'
 *   validateEnvironmentAtStartup()
 */

import { validateEnvironmentAtStartup } from '../lib/security/validate-env'

// Run validation
validateEnvironmentAtStartup()

// If we reach here, validation passed
console.log('✅ Environment validation passed - application can start')