import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AutoManager CRM',
    short_name: 'AutoManager',
    description: 'Sistema CRM Avanzado para Concesionarias',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a', // Slate 900
    theme_color: '#3b82f6', // Blue 500
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
