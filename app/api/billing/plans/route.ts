export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { billingService } from '@/lib/domains/billing/service'

export async function GET() {
  try {
    await getCurrentUser()

    const plans = await billingService.getAllowedPlans()
    return NextResponse.json({ plans })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
