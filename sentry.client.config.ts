import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env'

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN || env.SENTRY_DSN,
  
  // Solo capturar el 10% de transacciones en producción para reducir carga
  tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  debug: env.NODE_ENV === 'development',
  
  // Reducido a 0: el replay de sesiones genera tráfico constante via tunnelRoute
  // y tiene alto impacto en el billing de Vercel (cada chunk = 1 invocación)
  replaysSessionSampleRate: 0,
  
  // Solo grabar replay en errores graves, y solo el 10% de ellos
  replaysOnErrorSampleRate: 0.1,
  
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})
