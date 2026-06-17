// app/api/chat/route.ts
// API route para el agente interno basado en reglas.
// Devuelve la respuesta en el formato "data stream" que AI SDK v6 espera.
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { RuleBasedAgent } from '@/lib/ai/ruleAgent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // 1. Verificar sesión
  const session = await getServerSession(authOptions);
  if (!session?.user?.companyId) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const { companyId, id: userId } = session.user;

  // 2. Parsear el body
  let messages: { role: string; content: string }[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages)) throw new Error('Invalid messages format');
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la solicitud inválido' }), { status: 400 });
  }

  // 3. Procesar el mensaje con el RuleBasedAgent
  let responseText: string;
  try {
    responseText = await RuleBasedAgent.handleRequest(messages, companyId, userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno al procesar el mensaje';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }

  // 4. AI SDK v6 espera un stream en formato "data stream protocol".
  // Para texto plano, el formato es: 0:"texto"\n
  // Creamos un ReadableStream que emite el texto en el formato correcto.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`0:${JSON.stringify(responseText)}\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Connection': 'keep-alive',
    },
  });
}