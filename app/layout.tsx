import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
import { validateEnvironmentNonFatal } from '@/lib/security/validate-env'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: 'AutoManager CRM',
  description: 'Sistema de gestión para concesionarias de autos',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AutoManager',
  },
}

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
}

// Validate environment at runtime (server-side only), incluida producción.
// NO se ejecuta durante el build de Vercel (phase-production-build) porque ahí
// las variables de entorno runtime no están disponibles, y queremos que el build
// pase. En runtime se usa la versión NO fatal: loguea errores pero no mata la
// lambda (eso ocultaría el problema tras un 500 genérico).
if (
  typeof window === 'undefined' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  validateEnvironmentNonFatal()
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
      <html lang="es" suppressHydrationWarning className={`${inter.variable} font-sans`}>
      <head>
        <link rel="icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className="antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'hsl(222 40% 10%)',
              color: 'hsl(210 40% 95%)',
              border: '1px solid hsl(217 30% 17%)',
              borderRadius: '0.75rem',
              fontSize: '13px',
            },
          }}
          richColors
          closeButton
        />
        {/* Service Worker registration - archivo externo para compatibilidad con CSP */}
        <script src="/sw-register.js" />
      </body>
    </html>
  )
}
