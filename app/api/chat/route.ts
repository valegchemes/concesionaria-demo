/**
 * app/api/chat/route.ts
 * Endpoint principal del Agente IA Copilot.
 *
 * Usa el Vercel AI SDK v6 con streamText para enviar respuestas en tiempo real.
 * Soporta múltiples proveedores (NVIDIA NIM, OpenAI, Anthropic) via AI_PROVIDER env var.
 *
 * Cambios v6 respecto a v4:
 *  - maxSteps → stopWhen: stepCountIs(N)
 *  - toDataStreamResponse() → toUIMessageStreamResponse()
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { streamText, convertToModelMessages } from 'ai'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { getActiveModel } from '@/lib/ai/providers'
import { buildCopilotTools } from '@/lib/ai/tools'

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sos el Copiloto IA de AutoManager CRM, un sistema de gestión para concesionarias de vehículos en Argentina.

Tu rol es ayudar al equipo de la concesionaria a:
- Consultar y gestionar el inventario de vehículos (autos, motos, lanchas)
- Buscar y gestionar clientes (leads/prospectos)
- Ver estadísticas del negocio
- Registrar nuevos clientes
- Actualizar estados de clientes y vehículos

Reglas importantes:
1. Respondé siempre en español, usando el voseo argentino.
2. Cuando el usuario pide datos, SIEMPRE usá las herramientas disponibles para consultar la base de datos real. Nunca inventes datos.
3. Para operaciones de MODIFICACIÓN (crear/actualizar), confirmá brevemente qué vas a hacer antes de ejecutar, excepto que el usuario haya sido muy explícito.
4. Formateá los resultados de forma clara. Usá emojis con moderación (✅, 🚗, 👤, 📊).
5. Si no podés realizar una acción, indicalo claramente y sugerí cómo el usuario puede hacerlo manualmente.
6. Sos conciso pero completo.

Estados de vehículos: AVAILABLE=Disponible, IN_PREP=En preparación, RESERVED=Reservado, SOLD=Vendido
Estados de clientes: NEW=Nuevo, CONTACTED=Contactado, VISIT_SCHEDULED=Visita agendada, OFFER=En negociación, RESERVED=Reservado, SOLD=Vendido, LOST=Perdido`

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Verificar sesión
  const session = await getServerSession(authOptions)
  if (!session?.user?.companyId) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  const { companyId, id: userId } = session.user

  // 2. Parsear el body
  let messages: { role: string; content: string }[]
  try {
    const body = await req.json()
    messages = body.messages
    if (!Array.isArray(messages)) throw new Error('Invalid messages format')
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la solicitud inválido' }), { status: 400 })
  }

  // 3. Obtener el modelo activo (multi-proveedor)
  const model = getActiveModel()

  // 4. Construir las herramientas con el contexto del usuario (tenant-safe)
  const tools = buildCopilotTools(companyId, userId)

  // Convertir los mensajes del cliente al formato del modelo
  let coreMessages = await convertToModelMessages(messages as any)

  // FIX: NVIDIA NIM (LLaMA 3.1) rechaza los arrays multimodales en el role 'user'.
  // Necesitamos aplanar el 'content' a un simple string si es un array de partes de texto.
  coreMessages = coreMessages.map(msg => {
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\\n')
      }
    }
    return msg
  })

  // 5. Stream de texto con function calling (AI SDK v6)
  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: coreMessages as any,
    tools: tools as any,
    temperature: 0.3,
    onError: ({ error }) => {
      console.error('[AI Copilot] Stream error:', error)
    },
  })

  // Usamos el formato soportado por AI SDK v6
  return result.toUIMessageStreamResponse()
}
