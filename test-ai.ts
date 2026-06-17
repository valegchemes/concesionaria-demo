import { streamText, tool } from 'ai'
import { createProviderRegistry } from '@ai-sdk/provider-registry'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

const registry = createProviderRegistry({
  openai: createOpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  })
})

async function main() {
  const result = streamText({
    model: registry.languageModel('openai:meta/llama-3.1-8b-instruct'),
    messages: [{ role: 'user', content: '¿Cuántas ventas tuvimos este mes?' }],
    tools: {
      getDeals: {
        description: 'Obtiene operaciones',
        parameters: z.object({ limit: z.number().optional() }),
        execute: async () => ({ deals: 5 }),
      },
    },
    maxSteps: 5,
  })

  for await (const chunk of result.fullStream) {
    console.log(chunk.type, chunk)
  }
}

main().catch(console.error)
