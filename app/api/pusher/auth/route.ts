/**
 * POST /api/pusher/auth
 * Endpoint de autenticación para canales privados de Pusher.
 * 
 * Pusher llama a este endpoint cuando el cliente intenta suscribirse a
 * un canal `private-*`. Aquí validamos que el usuario está autenticado
 * y que el canal que solicita corresponde a su propia empresa (multi-tenant).
 * 
 * Docs: https://pusher.com/docs/channels/server_api/authenticating-users/
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Pusher from 'pusher'
import { getCurrentUser } from '@/lib/shared/auth-helpers'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('PusherAuth')

function getPusherServer(): Pusher | null {
  const appId = process.env.PUSHER_APP_ID
  const key = process.env.PUSHER_KEY
  const secret = process.env.PUSHER_SECRET
  const cluster = process.env.PUSHER_CLUSTER ?? 'us2'

  if (!appId || !key || !secret) return null

  return new Pusher({ appId, key, secret, cluster, useTLS: true })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const pusher = getPusherServer()

  if (!pusher) {
    log.warn({}, 'Pusher not configured — auth endpoint unavailable')
    return NextResponse.json({ error: 'Realtime not configured' }, { status: 503 })
  }

  // 1. Validar sesión activa y re-verificar en DB que el usuario y la empresa
  //    siguen activos. Antes se usaba getServerSession directo (solo JWT),
  //    lo que permitía a un usuario recién desactivado por el cron mantener
  //    acceso realtime hasta que expirara su token (24h).
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Leer el cuerpo del request (Pusher envía socket_id y channel_name como form-data)
  const body = await request.text()
  const params = new URLSearchParams(body)
  const socketId = params.get('socket_id')
  const channelName = params.get('channel_name')

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
  }

  // 3. Validar que el canal solicitado corresponde a la empresa del usuario (multi-tenant security)
  const expectedChannel = `private-company-${user.companyId}`
  if (channelName !== expectedChannel) {
    log.warn(
      {
        userId: user.id,
        companyId: user.companyId,
        requestedChannel: channelName,
        expectedChannel,
      },
      'Pusher auth denied — channel mismatch (potential cross-tenant attempt)'
    )
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. Generar la firma de autenticación de Pusher
  try {
    const authResponse = pusher.authorizeChannel(socketId, channelName, {
      user_id: user.id,
      user_info: {
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
    })

    log.debug(
      { userId: user.id, channelName },
      'Pusher channel authorized'
    )

    return NextResponse.json(authResponse)
  } catch (err) {
    log.error(
      { error: err instanceof Error ? err.message : String(err) },
      'Pusher auth failed'
    )
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 })
  }
}
