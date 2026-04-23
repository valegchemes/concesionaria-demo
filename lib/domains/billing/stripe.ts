import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-04-10', // Pinned to installed types version
  appInfo: {
    name: 'AutoFlow SaaS',
    version: '0.1.0',
  },
})
