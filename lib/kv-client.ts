// lib/kv-client.ts
// Normalize environment variables for Vercel KV / Upstash Redis compatibility.
// @vercel/kv reads env vars at import time, so any aliases must be set before importing.
// Si no hay KV configurado, el cliente se inicializa sin conexión real,
// y las operaciones fallarán gracefulmente sin timeouts.

import { createClient } from '@vercel/kv'

const KV_REST_API_URL =
  process.env.KV_REST_API_URL ||
  process.env.KV_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_API_URL ||
  ''

const KV_REST_API_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.KV_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN ||
  ''

const isConfigured = KV_REST_API_URL.length > 0 && KV_REST_API_TOKEN.length > 0

/**
 * KV Client seguro — si no hay URL/token configurados, se crea un mock
 * que no hace conexiones reales (evita timeouts con credenciales dummy).
 */
export const kv = isConfigured
  ? createClient({
      url: KV_REST_API_URL,
      token: KV_REST_API_TOKEN,
    })
  : createClient({
      // Usar valores reales pero no habrá conexión saliente real
      // Las operaciones lanzarán error inmediatamente en lugar de timeout
      url: 'http://localhost:9999', // Puerto que no escucha -> fallo rápido
      token: 'noop',
    })
