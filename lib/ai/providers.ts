/**
 * lib/ai/providers.ts
 * Configuración centralizada de proveedores de IA.
 *
 * Proveedores disponibles:
 *   - "nvidia"   → NVIDIA NIM (compatible con OpenAI API, Llama 3.1 70B)
 *   - "openai"   → OpenAI (GPT-4o)
 *   - "anthropic"→ Anthropic (Claude 3.5 Sonnet)
 *
 * El proveedor activo se controla con la variable de entorno AI_PROVIDER.
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'

// AI SDK v6 usa LanguageModel (sin V1 suffix)
export type AIProvider = 'nvidia' | 'openai' | 'anthropic'

// ─── NVIDIA NIM ─────────────────────────────────────────────────────────────
// NVIDIA NIM expone una API compatible con OpenAI en un endpoint diferente.
// API keys gratuitas en: https://build.nvidia.com
const nvidiaProvider = createOpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY ?? '',
})

// ─── OpenAI ──────────────────────────────────────────────────────────────────
const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? '',
})

// ─── Anthropic ───────────────────────────────────────────────────────────────
const anthropicProvider = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
})

// ─── Mapa de modelos ─────────────────────────────────────────────────────────
const MODEL_MAP = {
  nvidia: nvidiaProvider('meta/llama-3.1-70b-instruct'),
  openai: openaiProvider('gpt-4o'),
  anthropic: anthropicProvider('claude-3-5-sonnet-20241022'),
} as const

/**
 * Retorna el modelo de lenguaje activo según la variable AI_PROVIDER.
 * Default: nvidia (gratuito en el tier básico, rápido).
 */
export function getActiveModel() {
  const provider = (process.env.AI_PROVIDER ?? 'nvidia') as AIProvider
  const model = MODEL_MAP[provider]
  if (!model) {
    console.warn(`[AI] Proveedor "${provider}" no reconocido. Usando NVIDIA NIM.`)
    return MODEL_MAP.nvidia
  }
  return model
}
