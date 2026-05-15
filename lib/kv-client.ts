// lib/kv-client.ts
// Normalize environment variables for Vercel KV / Upstash Redis compatibility.
// @vercel/kv reads env vars at import time, so any aliases must be set before importing.

import { createClient } from '@vercel/kv'

const KV_REST_API_URL =
  process.env.KV_REST_API_URL ||
  process.env.KV_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_API_URL ||
  'https://dummy.upstash.io'

const KV_REST_API_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.KV_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN ||
  'dummy'

export const kv = createClient({
  url: KV_REST_API_URL,
  token: KV_REST_API_TOKEN,
})
