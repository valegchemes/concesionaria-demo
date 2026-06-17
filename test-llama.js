const { streamText, stepCountIs, tool } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { z } = require('zod');

const nvidia = createOpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function main() {
  const result = streamText({
    model: nvidia.chat('meta/llama-3.1-8b-instruct'),
    system: `Sos el Copiloto IA. Reglas: Respondé directamente con los datos exactos que te devolvió la base de datos (ej: "Este mes tuvimos 15 ventas").`,
    messages: [{ role: 'user', content: 'Mostrame las estadisticas del negocio' }],
    tools: {
      getDashboardStats: tool({
        description: 'Estadísticas: autos disponibles, clientes activos, ventas del mes.',
        parameters: z.object({}),
        execute: async () => {
          console.log('>>> TOOL CALLED <<<');
          return {
            inventario: { disponibles: 5, vendidos: 10 },
            clientes: { activos: 20, nuevos_sin_contactar: 3 },
            operaciones: { este_mes: 15 }
          };
        }
      })
    },
    stopWhen: stepCountIs(5),
    onFinish: (r) => console.log('\n[FINISH]', r.finishReason, r.steps.length)
  });

  for await (const chunk of result.fullStream) {
    if (chunk.type === 'text-delta') {
      if (chunk.textDelta) process.stdout.write(chunk.textDelta);
    } else if (chunk.type === 'tool-call') {
      console.log('\n[TOOL CALL]', chunk.toolName);
    } else if (chunk.type === 'tool-result') {
      console.log('\n[TOOL RESULT]', chunk.toolName, JSON.stringify(chunk.result));
    } else {
      console.log('\n[OTHER CHUNK]', chunk.type);
    }
  }
}

main().catch(console.error);
