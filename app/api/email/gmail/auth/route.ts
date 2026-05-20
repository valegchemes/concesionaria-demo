export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { getPlanLimits } from '@/lib/shared/plan-limits'
import { generateAuthUrl } from '@/lib/email/gmail'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    
    const limits = await getPlanLimits(session.user.companyId)
    if (!limits.aiEnabled) {
      return NextResponse.json({ error: 'Tu plan no incluye las funciones de Inteligencia Artificial.' }, { status: 403 })
    }

    const url = generateAuthUrl(session.user.companyId)
    
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Error initiating Google OAuth:', error)
    return NextResponse.json({ error: 'Failed to initiate authentication' }, { status: 500 })
  }
}
