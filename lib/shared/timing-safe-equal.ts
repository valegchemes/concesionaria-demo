import crypto from 'crypto'

/**
 * Comparación de strings en tiempo constante para evitar timing attacks.
 *
 * `crypto.timingSafeEqual` lanza `RangeError` si los buffers difieren en longitud,
 * lo que rompe la garantía de timing-safe y produce un 500 en vez de un 401/403.
 * Este helper normaliza: si las longitudes difieren, retorna `false` sin lanzar
 * y sin acortar el tiempo de comparación de forma observable.
 *
 * Usar siempre esto para comparar secrets/tokens/signatures (Bearer tokens de
 * diag, webhooks de pagos, etc.).
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  // Si las longitudes difieren, comparar igualmente contra `a` para mantener
  // el tiempo constante y luego descartar el resultado.
  if (bufA.length !== bufB.length) {
    // compara a contra a (siempre true) para no filtrar la longitud, luego falsea
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }

  return crypto.timingSafeEqual(bufA, bufB)
}
