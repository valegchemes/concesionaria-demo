import Stripe from 'stripe'
import { env } from '@/lib/env'

const stripeKey = env.STRIPE_SECRET_KEY

if (!stripeKey) {
  throw new Error(
    'STRIPE_SECRET_KEY is required. Please set it in your environment variables.'
  )
}

// Validar que sea live key en producción
if (env.NODE_ENV === 'production' && stripeKey.startsWith('sk_test_')) {
  throw new Error(
    'Cannot use Stripe test key (sk_test_*) in production. Use a live key (sk_live_*).'
  )
}

// Advertir si se usa live key en desarrollo
if (env.NODE_ENV === 'development' && stripeKey.startsWith('sk_live_')) {
  console.warn(
    '⚠️  WARNING: Using Stripe LIVE key in development environment. ' +
    'Consider using a test key (sk_test_*) instead.'
  )
}

export const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-04-10', // Pinned to installed types version
  maxNetworkRetries: 3,
  timeout: 10000, // 10s timeout
  appInfo: {
    name: 'AutoFlow SaaS',
    version: '0.1.0',
  },
})
