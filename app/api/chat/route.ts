// app/api/chat/route.ts
// API route para el agente interno basado en reglas.
// 
// AI SDK v6 espera SSE (Server-Sent Events) con este formato:
//   data: {"type":"text-start","id":"..."}\n\n
//   data: {"type":"text-delta","id":"...","delta":"..."}\n\n
//   data: {"type":"text-end","id":"..."}\n\n
//   data: {"type":"finish","finishReason":{...},"usage":{...}}\n\n
//   data: [DONE]\n\n
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { RuleBasedAgent } from '@/lib/ai/ruleAgent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream' as const,
  'x-vercel-ai-ui-message-stream': 'v1' as const,
  'Cache-Control': 'no-cache' as const,
  'Connection': 'keep-alive' as const,
};

export async function POST(req: NextRequest) {
  // 1. Verificar sesión
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { companyId, id: userId } = session.user;

  // 2. Parsear el body
  let messages: { role: string; content: string }[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages)) throw new Error('Invalid messages format');
  } catch {
    return Response.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  // 3. Procesar el mensaje con el RuleBasedAgent
  let responseText: string;
  try {
    responseText = await RuleBasedAgent.handleRequest(messages, companyId, userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno al procesar el mensaje';
    return Response.json({ error: message }, { status: 400 });
  }

  // 4. Construir respuesta SSE (formato que AI SDK v6 entiende)
  //    Los errores HTTP (401/400) se manejan arriba con Response.json().
  //    Acá solo llegan respuestas exitosas → formato SSE.
  const encoder = new TextEncoder();
  const textId = `text_${Date.now()}`;

  const chunks = [
    `data: ${JSON.stringify({ type: 'text-start', id: textId })}\n\n`,
    `data: ${JSON.stringify({
      type: 'text-delta',
      id: textId,
      delta: responseText,
    })}\n\n`,
    `data: ${JSON.stringify({ type: 'text-end', id: textId })}\n\n`,
    `data: ${JSON.stringify({
      type: 'finish',
      finishReason: { type: 'stop' },
      usage: { promptTokens: 0, completionTokens: 0 },
    })}\n\n`,
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