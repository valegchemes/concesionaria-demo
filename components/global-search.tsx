'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, User, Car, Handshake, Users, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

type SearchResultType = 'LEAD' | 'UNIT' | 'DEAL' | 'USER'

interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  url: string
}

const TypeIcon = ({ type }: { type: SearchResultType }) => {
  switch (type) {
    case 'LEAD':
      return <User className="h-4 w-4 text-blue-500" />
    case 'UNIT':
      return <Car className="h-4 w-4 text-green-500" />
    case 'DEAL':
      return <Handshake className="h-4 w-4 text-purple-500" />
    case 'USER':
      return <Users className="h-4 w-4 text-orange-500" />
  }
}

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)

  // Debounced search con AbortController.
  // Antes, al teclear rápido, un fetch anterior podía resolver DESPUÉS que uno
  // más nuevo y sobrescribir los resultados con datos obsoletos (race condition).
  // Ahora cada efecto crea su propio controller y aborta el anterior al
  // limpiar/desmontar, ignorando respuestas obsoletas.
  useEffect(() => {
    if (query.trim().length < 2) {
      if (mountedRef.current) {
        setResults([])
        setIsLoading(false)
      }
      return
    }

    const controller = new AbortController()
    setIsLoading(true)

    const debounceId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          if (mountedRef.current) {
            setResults(data.data || [])
          }
        } else {
          if (mountedRef.current) setResults([])
        }
      } catch (error) {
        // AbortError es esperado cuando una nueva tecla cancela esta request.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        console.error('Search error:', error)
        if (mountedRef.current) setResults([])
      } finally {
        // Solo actualizar loading si este request no fue cancelado.
        if (!controller.signal.aborted && mountedRef.current) {
          setIsLoading(false)
        }
      }
    }, 300)

    return () => {
      clearTimeout(debounceId)
      controller.abort()
    }
  }, [query])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = () => {
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div className="relative w-96" ref={containerRef}>
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-adaptive-secondary" />
      <Input
        type="search"
        placeholder="Buscar leads, unidades, operaciones..."
        className="pl-9 w-full surface-secondary border-transparent text-adaptive-primary placeholder:text-adaptive-secondary focus:surface-primary transition-colors"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isLoading && (
        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />
      )}

      {/* Dropdown Results */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 surface-primary rounded-lg shadow-lg border border-white/20 overflow-hidden z-50 backdrop-blur-md">
          <div className="max-h-96 overflow-y-auto p-2">
            {!isLoading && results.length === 0 && (
              <div className="p-4 text-center text-sm text-adaptive-secondary">
                No se encontraron resultados para &quot;{query}&quot;
              </div>
            )}
            
            {results.map((result) => (
              <Link
                key={`${result.type}-${result.id}`}
                href={result.url}
                onClick={handleSelect}
                className="flex items-center gap-3 p-3 hover:surface-secondary rounded-md transition-colors group cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full surface-muted flex items-center justify-center shrink-0">
                  <TypeIcon type={result.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-adaptive-primary truncate">
                    {result.title}
                  </p>
                  <p className="text-xs text-adaptive-secondary truncate">
                    {result.subtitle}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-adaptive-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
