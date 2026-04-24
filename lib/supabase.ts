import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const isConfigured = supabaseUrl.startsWith('http') && supabaseAnonKey.length > 10

export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const createServerClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!serviceRoleKey || !isConfigured) {
    throw new Error('Missing Supabase configuration')
  }
  
  return createClient(supabaseUrl, serviceRoleKey)
}

// Tipos para la tabla units
export interface Unit {
  id: string
  brand: string
  model: string
  year: number
  price: number
  description: string
  status: 'available' | 'sold'
  images: string[] // Array de URLs
  user_id: string
  created_at: string
  updated_at: string
}

export interface UnitInput {
  brand: string
  model: string
  year: number
  price: number
  description: string
  images: string[]
}
