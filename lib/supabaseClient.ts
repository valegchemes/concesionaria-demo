/**
 * Client-side Supabase client
 * Use this in Client Components ('use client')
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import { env } from './env'

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Re-export commonly used types
export type SupabaseClient = ReturnType<typeof createClient>
