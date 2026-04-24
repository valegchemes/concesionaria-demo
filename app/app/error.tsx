'use client'

import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AppError boundary]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <div className="text-red-500 text-5xl">⚠</div>
      <h2 className="text-2xl font-bold text-gray-800">Ocurrió un error</h2>
      <p className="text-gray-600 text-center max-w-md">
        {error?.message || 'Error desconocido en la aplicación'}
      </p>
      {error?.digest && (
        <p className="text-xs text-gray-400 font-mono">ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
      >
        Reintentar
      </button>
    </div>
  )
}
