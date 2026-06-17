// app/api/chat/route.ts
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

  // Usamos el nuevo agente basado en reglas (100% interno, sin APIs externas)
  const response = await RuleBasedAgent.handleRequest(messages, companyId, userId);

  return response;
}