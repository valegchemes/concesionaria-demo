'use client'

/**
 * useObjectUrl.ts
 * 
 * Hook para manejar object URLs de forma segura con cleanup automático.
 * 
 * PROBLEMA QUE RESUELVE:
 * URL.createObjectURL() crea URLs en memoria del navegador que nunca se liberan
 * automáticamente. Si no se llama URL.revokeObjectURL(), la memoria nunca se libera.
 * 
 * SOLUCIÓN:
 * - Guardar la URL actual y el ref para cleanup
 * - Revocar automáticamente cuando se crea una nueva URL
 * - Revocar cuando el componente se desmonta
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export function useObjectUrl() {
  const [url, setUrl] = useState<string>('')
  const objectUrlRef = useRef<string>('')

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = ''
      }
    }
  }, [])

  const setNewUrl = useCallback((file: File | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = ''
    }

    if (file) {
      const newUrl = URL.createObjectURL(file)
      objectUrlRef.current = newUrl
      setUrl(newUrl)
    } else {
      setUrl('')
    }
  }, [])

  const clearUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = ''
    }
    setUrl('')
  }, [])

  return { url, setNewUrl, clearUrl }
}