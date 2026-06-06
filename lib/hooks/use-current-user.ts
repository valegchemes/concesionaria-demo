/**
 * lib/hooks/use-current-user.ts
 *
 * Hook compartido para obtener el usuario actual con SWR.
 *
 * MOTIVACIÓN:
 * Antes, cada página client-side hacía `fetch('/api/me', { cache: 'no-store' })`
 * de forma independiente en su propio useEffect. Al navegar entre páginas,
 * se disparaban múltiples fetches a /api/me con datos idénticos.
 *
 * SWR deduplica por key: si dos componentes en el mismo árbol (o en la misma sesión)
 * llaman a este hook, solo se hace 1 fetch y el resultado se comparte.
 * El TTL de 5 minutos protege contra fetches redundantes al navegar.
 */

'use client'

import useSWR from 'swr'

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
  whatsappNumber: string | null
  exchangeRateArsPerUsd: number | null
  companyId: string
  companyName: string
  companySlug: string
  whatsappCentral: string | null
}

const fetcher = async (url: string): Promise<CurrentUser> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Error ${res.status} al obtener usuario`)
  return res.json()
}

export function useCurrentUser() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser>(
    '/api/me',
    fetcher,
    {
      // 5 minutos de deduplicación: el rol/nombre del usuario no cambia frecuentemente
      dedupingInterval: 5 * 60 * 1000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      errorRetryCount: 1,
    }
  )

  return {
    user: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
    // Atajos de uso frecuente
    role: data?.role ?? null,
    isAdmin: data?.role === 'ADMIN',
    isManager: data?.role === 'MANAGER',
    isSeller: data?.role === 'SELLER',
  }
}
