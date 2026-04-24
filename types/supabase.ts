/**
 * Supabase Database Types
 * Generated from schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      units: {
        Row: {
          id: string
          brand: string
          model: string
          year: number
          price: number
          description: string | null
          status: 'available' | 'sold'
          images: string[]
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand: string
          model: string
          year: number
          price: number
          description?: string | null
          status?: 'available' | 'sold'
          images?: string[]
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand?: string
          model?: string
          year?: number
          price?: number
          description?: string | null
          status?: 'available' | 'sold'
          images?: string[]
          user_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
