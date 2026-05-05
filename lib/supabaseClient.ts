/**
 * Client-side Supabase client
 * Use this in Client Components ('use client')
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import { env } from './env'

export function createClient() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration (URL or Anon Key)')
  }
  
  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  )
}

// Re-export commonly used types
export type SupabaseClient = ReturnType<typeof createClient>
