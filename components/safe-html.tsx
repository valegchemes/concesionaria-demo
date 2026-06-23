/**
 * SafeHtml — renderiza HTML saneado de forma segura.
 *
 * Antes usaba un sanitizador casero basado en `DOMParser` que retornaba `null`
 * en SSR (causando hydration mismatch en React 19) y tenía bypasses para
 * `javascript:`/`style`. Ahora usa la librería probada `sanitize-html`
 * (`lib/shared/sanitize-html.ts`) vía `dangerouslySetInnerHTML`.
 *
 * El saneamiento se hace en cada render (memoizado por `html`), por lo que es
 * seguro tanto en servidor como en cliente sin mismatch de hidratación.
 */
'use client'

import { useMemo } from 'react'
import { sanitizeForRender } from '@/lib/shared/sanitize-html'

export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const sanitized = useMemo(() => sanitizeForRender(html), [html])

  return (
    <div
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
