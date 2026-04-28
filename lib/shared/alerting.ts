/**
 * Alerting básico - Punto B del roadmap
 * Alertas operativas simples para detección proactiva
 */

import { createLogger } from './logger'

const log = createLogger('Alerting')

interface AlertConfig {
  webhookUrl?: string
  environment: 'development' | 'production'
}

const config: AlertConfig = {
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

// Contadores en memoria (en producción usar Redis)
const counters = new Map<string, number[]>() // key -> timestamps

function shouldAlert(key: string, threshold: number, windowSeconds: number): boolean {
  const now = Date.now()
  const window = windowSeconds * 1000
  
  const timestamps = counters.get(key) || []
  // Limpiar timestamps antiguos
  const recent = timestamps.filter(t => now - t < window)
  recent.push(now)
  counters.set(key, recent)
  
  return recent.length >= threshold
}

export const alerting = {
  /**
   * Alerta si múltiples pagos fallan consecutivamente
   * Posible indicio de race condition o bug crítico
   */
  paymentFailed(dealId: string, error: string) {
    log.error({ dealId, error }, 'Payment failed')
    
    if (shouldAlert('payment_failures', 3, 300)) { // 3 fallos en 5 minutos
      this.sendAlert('🚨 CRITICAL: 3+ payments failed in 5min', {
        dealId,
        error,
        action: 'Check dealService.recordPayment transactions'
      })
    }
  },

  /**
   * Alerta si rate limiting bloquea tráfico legítimo
   * Posible indicio de ataque o configuración muy agresiva
   */
  rateLimitBlocked(ip: string, path: string, isAuthenticated: boolean) {
    log.warn({ ip, path, isAuthenticated }, 'Rate limit blocked request')
    
    // Solo alertar si bloquea usuarios autenticados
    if (isAuthenticated && shouldAlert('rate_limit_auth', 5, 60)) { // 5 bloqueos en 1 min
      this.sendAlert('⚠️ WARNING: Rate limiting blocking authenticated users', {
        ip,
        path,
        suggestion: 'Review rate limit thresholds'
      })
    }
  },

  /**
   * Alerta en login admin sospechoso
   */
  adminLogin(userId: string, email: string, ip: string, success: boolean) {
    log.info({ userId, email, ip, success }, 'Admin login attempt')
    
    if (!success && shouldAlert('admin_login_failures', 3, 600)) { // 3 fallos en 10 min
      this.sendAlert('🛡️ SECURITY: Multiple failed admin logins', {
        email,
        ip,
        action: 'Consider IP ban or 2FA review'
      })
    }
  },

  /**
   * Alerta si soft delete está fallando (expense sigue visible)
   */
  softDeleteAnomaly(expenseId: string, companyId: string) {
    log.error({ expenseId, companyId }, 'Soft delete anomaly detected')
    this.sendAlert('🔧 BUG: Expense soft delete not working', {
      expenseId,
      action: 'Check expenses API delete endpoint'
    })
  },

  /**
   * Envío de alerta (slack/email/log)
   */
  async sendAlert(title: string, details: Record<string, unknown>) {
    const alert = {
      title,
      details,
      timestamp: new Date().toISOString(),
      environment: config.environment
    }
    
    // Siempre loggear
    log.error(alert, 'ALERT triggered')
    
    // Enviar webhook si está configurado
    if (config.webhookUrl && config.environment === 'production') {
      try {
        await fetch(config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        })
      } catch (e) {
        log.error({ error: e instanceof Error ? e.message : String(e) }, 'Failed to send webhook alert')
      }
    }
  }
}

// Resetear contadores cada hora para evitar memory leaks
setInterval(() => {
  counters.clear()
}, 3600000)
