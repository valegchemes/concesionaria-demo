// lib/kv-client.ts
// Normalize environment variables for Vercel KV / Upstash Redis compatibility.
// @vercel/kv reads env vars at import time, so any aliases must be set before importing.

const KV_REST_API_URL =
  process.env.KV_REST_API_URL ||
  process.env.KV_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_API_URL

const KV_REST_API_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.KV_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN

if (KV_REST_API_URL) {
  process.env.KV_REST_API_URL = KV_REST_API_URL
}

if (KV_REST_API_TOKEN) {
  process.env.KV_REST_API_TOKEN = KV_REST_API_TOKEN
}

import { kv } from '@vercel/kv'

export { kv }
