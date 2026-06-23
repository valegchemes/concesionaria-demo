// app/api/chat/route.ts
// API route para el agente interno basado en reglas.
//
// AI SDK v6 espera SSE (Server-Sent Events) con este formato:
//   data: {"type":"start-step"}\n\n
//   data: {"type":"text-start","id":"..."}\n\n
//   data: {"type":"text-delta","id":"...","delta":"..."}\n\n
//   data: {"type":"text-end","id":"..."}\n\n
//   data: {"type":"finish-step"}\n\n
//   data: [DONE]\n\n
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { RuleBasedAgent } from '@/lib/ai/ruleAgent';
import { requireRateLimit } from '@/lib/shared/rate-limit-memory';
import { RateLimitError } from '@/lib/shared/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream' as const,
  'x-vercel-ai-ui-message-stream': 'v1' as const,
  'Cache-Control': 'no-cache' as const,
  'Connection': 'keep-alive' as const,
};

// Límites anti-DoS: máximo de mensajes en una sola request y tamaño máximo
// por contenido. Suficiente para una conversación de chat normal.
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 8000;

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.string().max(32),
        content: z.string().max(MAX_CONTENT_LENGTH),
      })
    )
    .min(1)
    .max(MAX_MESSAGES),
});

// Rate limit específico para chat (por usuario autenticado): 30 req/min.
const CHAT_RATE_LIMIT = { limit: 30, windowSeconds: 60, prefix: 'rl:chat' } as const;

export async function POST(req: NextRequest) {
  // 1. Verificar sesión
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { companyId, id: userId } = session.user;

  // 2. Rate limiting por usuario (chat puede ser costoso)
  try {
    await requireRateLimit(`chat:${userId}`, CHAT_RATE_LIMIT);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return Response.json(
        { error: 'Demasiados mensajes. Esperá un minuto e intentá de nuevo.' },
        { status: 429 }
      );
    }
    throw err;
  }

  // 3. Parsear y validar el body con Zod (antes se aceptaba sin validar).
  let messages: { role: string; content: string }[];
  try {
    const body = await req.json();
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Cuerpo de la solicitud inválido', details: parsed.error.issues },
        { status: 400 }
      );
    }
    messages = parsed.data.messages;
  } catch {
    return Response.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  // 4. Procesar el mensaje con el RuleBasedAgent
  let responseText: string;
  try {
    responseText = await RuleBasedAgent.handleRequest(messages, companyId, userId);
  } catch (err) {
    // No filtrar el mensaje interno crudo al cliente; loguearlo acá si hace falta.
    const message = err instanceof Error ? err.message : 'Error interno al procesar el mensaje';
    return Response.json({ error: message }, { status: 400 });
  }

  // 5. Construir respuesta SSE (formato que AI SDK v6 entiende)
  //    Los errores HTTP (401/400) se manejan arriba con Response.json().
  //    Acá solo llegan respuestas exitosas → formato SSE.
  const encoder = new TextEncoder();
  const textId = `text_${Date.now()}`;

  const chunks = [
    `data: ${JSON.stringify({ type: 'start-step' })}\n\n`,
    `data: ${JSON.stringify({ type: 'text-start', id: textId })}\n\n`,
    `data: ${JSON.stringify({
      type: 'text-delta',
      id: textId,
      delta: responseText,
    })}\n\n`,
    `data: ${JSON.stringify({ type: 'text-end', id: textId })}\n\n`,
    `data: ${JSON.stringify({ type: 'finish-step' })}\n\n`,
    'data: [DONE]\n\n',
  ];

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: SSE_HEADERS,
  });
}
