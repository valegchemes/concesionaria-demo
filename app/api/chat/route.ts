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

import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { getActiveModel } from '@/lib/ai/providers'
import { buildCopilotTools } from '@/lib/ai/tools'

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sos el Copiloto IA de AutoManager CRM, un sistema de gestión para concesionarias de vehículos en Argentina.

Tu rol es ayudar al equipo de la concesionaria a consultar inventario, clientes, ventas y estadísticas.

Reglas CRÍTICAS:
1. Respondé siempre en español, usando el voseo argentino.
2. Cuando el usuario pide estadísticas, ventas, o GANANCIAS, SIEMPRE ejecutá las herramientas necesarias (getDashboardStats o getDeals).
3. Para calcular GANANCIAS (ingresos netos), usá getDeals para obtener las ventas recientes y sumá los valores.
4. IMPORTANTE: Cuando uses una herramienta, NUNCA digas "la herramienta muestra...". RESPONDÉ DIRECTAMENTE CON LOS DATOS EXACTOS que te devolvió la base de datos (ej: "Este mes tuvimos 15 ventas").
5. Formateá los datos usando listas con guiones, viñetas y emojis para que sea fácil de leer, ya que es la única interfaz visual.
6. Nunca inventes datos. Si no tenés la info, pedí disculpas.

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
    // Permitir múltiples pasos para que el agente pueda usar herramientas y luego responder
    stopWhen: stepCountIs(5),
    temperature: 0.3,
    onError: ({ error }) => {
      console.error('[AI Copilot] Stream error:', error)
    },
  })

  // Usamos el formato soportado por AI SDK v6
  return result.toUIMessageStreamResponse()
}
