/**
 * Client-side Supabase client
 * Use this in Client Components ('use client')
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Re-export commonly used types
export type SupabaseClient = ReturnType<typeof createClient>
