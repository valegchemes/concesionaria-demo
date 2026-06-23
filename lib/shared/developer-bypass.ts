/**
 * Developer Bypass — Acceso ilimitado para cuentas de desarrollo
 *
 * Leé DEVELOPER_EMAILS desde variables de entorno (lista separada por comas).
 * Nunca hardcodear emails en código fuente.
 *
 * SEGURIDAD: El bypass está desactivado en producción (`NODE_ENV === 'production'`).
 * Si se necesita forzarlo en un entorno específico, definir
 * `DEVELOPER_BYPASS_ALLOW_IN_PRODUCTION=1` (no recomendado en prod real).
 *
 * Configuración en .env / Vercel Environment Variables:
 *   DEVELOPER_EMAILS=valegchemes@gmail.com,otro.dev@example.com
 */

import { createLogger } from './logger'

const log = createLogger('DeveloperBypass')

/**
 * El bypass solo aplica fuera de producción, salvo que se habilite
 * explícitamente con `DEVELOPER_BYPASS_ALLOW_IN_PRODUCTION=1`.
 */
function bypassEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return process.env.DEVELOPER_BYPASS_ALLOW_IN_PRODUCTION === '1'
  }
  return true
}

function getDeveloperEmailsList(): string[] {
  return (process.env.DEVELOPER_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isDeveloperEmail(email: string): boolean {
  if (!bypassEnabled()) return false
  if (!email) return false
  return getDeveloperEmailsList().includes(email.trim().toLowerCase())
}

export async function hasDeveloperInCompany(
  prisma: { user: { count: (args: unknown) => Promise<number> } },
  companyId: string
): Promise<boolean> {
  if (!bypassEnabled()) return false
  const emails = getDeveloperEmailsList()
  if (emails.length === 0) return false

  try {
    const count = await prisma.user.count({
      where: {
        companyId,
        email: { in: emails },
      },
    })

    if (count > 0) {
      log.info({ companyId }, 'Developer bypass activo para esta empresa')
    }

    return count > 0
  } catch (error) {
    log.error({ error: String(error), companyId }, 'Error checking developer bypass')
    return false
  }
}

export function getDeveloperEmails(): readonly string[] {
  if (!bypassEnabled()) return Object.freeze([])
  return Object.freeze([...getDeveloperEmailsList()])
}
