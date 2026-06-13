/**
 * Developer Bypass — Acceso ilimitado para cuentas de desarrollo
 *
 * Leé DEVELOPER_EMAILS desde variables de entorno (lista separada por comas).
 * Nunca hardcodear emails en código fuente.
 *
 * Configuración en .env:
 *   DEVELOPER_EMAILS=valegchemes@gmail.com,otro.dev@example.com
 */

import { createLogger } from './logger'

const log = createLogger('DeveloperBypass')

function getDeveloperEmailsList(): string[] {
  return (process.env.DEVELOPER_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isDeveloperEmail(email: string): boolean {
  if (!email) return false
  return getDeveloperEmailsList().includes(email.trim().toLowerCase())
}

export async function hasDeveloperInCompany(
  prisma: { user: { count: (args: unknown) => Promise<number> } },
  companyId: string
): Promise<boolean> {
  const emails = getDeveloperEmailsList()
  if (emails.length === 0) return false

  try {
    const count = await prisma.user.count({
      where: {
        companyId,
        email: { in: emails },
      },
    })
    return count > 0
  } catch (error) {
    log.error({ error: String(error), companyId }, 'Error checking developer bypass')
    return false
  }
}

export function getDeveloperEmails(): readonly string[] {
  return Object.freeze([...getDeveloperEmailsList()])
}
