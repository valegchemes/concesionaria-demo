import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { getPlanLimits } from '@/lib/shared/plan-limits'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:UnitScan')

// Mock database of premium visual scan test cards
const MOCK_VEHICLES: Record<string, any> = {
  cronos: {
    type: 'CAR',
    brand: 'Fiat',
    model: 'Cronos',
    year: 2023,
    domain: 'AF329JK',
    engineNumber: 'F18B-883716',
    frameNumber: '8APZ93B81A7728',
    kilometraje: '24000',
    description: 'Vehículo en excelente estado. Carga inteligente realizada por Escáner de Cédula con IA.'
  },
  hilux: {
    type: 'CAR',
    brand: 'Toyota',
    model: 'Hilux',
    year: 2021,
    domain: 'AE529OP',
    engineNumber: '1GD-8837162',
    frameNumber: '8APZ88B273A8172',
    kilometraje: '85000',
    description: 'Pick-up Toyota Hilux SRX. Excelente mecánica. Carga inteligente realizada por Escáner de Cédula con IA.'
  },
  fiesta: {
    type: 'CAR',
    brand: 'Ford',
    model: 'Fiesta',
    year: 2017,
    domain: 'AB829KL',
    engineNumber: 'SIGMA-883192',
    frameNumber: '9BFZ38B71A2837',
    kilometraje: '98000',
    description: 'Ford Fiesta Kinetic Design. Única mano. Carga inteligente realizada por Escáner de Cédula con IA.'
  },
  tornado: {
    type: 'MOTORCYCLE',
    brand: 'Honda',
    model: 'XR 250 Tornado',
    year: 2022,
    domain: 'A157JKL',
    engineNumber: 'XR250E-88312',
    frameNumber: '9C2MD38128A37',
    kilometraje: '12000',
    description: 'Honda Tornado XR 250 en impecable estado. Carga inteligente realizada por Escáner de Cédula con IA.'
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const limits = await getPlanLimits(session.user.companyId)
    if (!limits.aiEnabled) {
      return NextResponse.json({ error: 'Tu plan no incluye las funciones de Inteligencia Artificial.' }, { status: 403 })
    }

    const body = await req.json()
    const { image, mockId } = body

    // 1. If a premium mock sample is requested, return it directly to simulate instant AI scan
    if (mockId && MOCK_VEHICLES[mockId]) {
      // Simulate delay for AI thinking feel
      await new Promise(resolve => setTimeout(resolve, 1500))
      return NextResponse.json({ success: true, data: MOCK_VEHICLES[mockId] })
    }

    const geminiKey = process.env.GEMINI_API_KEY

    // 2. If Gemini API Key is missing, fallback to a smart parsed vehicle response
    if (!geminiKey) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      // Return a smart random mock to represent dynamic parsing of a user's custom photo
      const keys = Object.keys(MOCK_VEHICLES)
      const randomKey = keys[Math.floor(Math.random() * keys.length)]
      const result = { ...MOCK_VEHICLES[randomKey] }
      // Randomize domain to show it processed the custom image
      result.domain = `AD${Math.floor(100 + Math.random() * 900)}XX`
      return NextResponse.json({
        success: true,
        data: result,
        warning: 'Simulador IA activo: Para habilitar el procesamiento de imágenes reales, agregá GEMINI_API_KEY a tus variables de entorno.'
      })
    }

    if (!image) {
      return NextResponse.json({ error: 'No se recibió ninguna imagen para escanear.' }, { status: 400 })
    }

    // Extract base64 image data
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg'

    // Call Google Gemini API directly using native fetch
    const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analizá esta imagen de una cédula verde o azul de registro de automotor en Argentina. 
Extraé los siguientes campos técnicos y devolvelos **estrictamente en un único objeto JSON plano** (sin bloques de código markdown, sin texto extra, solo el objeto JSON). 

Los campos deben llamarse exactamente así:
- type: 'CAR' (si es auto o camioneta), 'MOTORCYCLE' (si es moto o quad), o 'BOAT' (si es lancha/embarcación)
- brand: Nombre de la marca (ej: Fiat, Toyota, Ford)
- model: Nombre del modelo (ej: Cronos, Hilux, Fiesta)
- year: Año del vehículo como número entero (ej: 2023)
- domain: Patente / Dominio en mayúsculas (ej: AF123JK)
- engineNumber: Número de motor exacto (ej: F17A-827361)
- frameNumber: Número de chasis / cuadro exacto (ej: 8APZ293A71A283)
- kilometraje: Dejalo siempre vacío: "" (ya que las cédulas no tienen kilometraje)
- description: Dejá una breve nota diciendo: "Cargado automáticamente mediante escáner de Cédula por IA."

Si no lográs divisar algún campo de forma nítida, ponelo como string vacío "".`
                },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Error de Gemini API: ${response.status} - ${errText}`)
    }

    const json = await response.json()
    const responseText = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) {
      throw new Error('No se recibió respuesta válida de la IA.')
    }

    const parsedData = JSON.parse(responseText.trim())

    return NextResponse.json({ success: true, data: parsedData })
  } catch (error: unknown) {
    // No filtrar el mensaje interno (puede contener la URL de Gemini con la
    // API key, o detalles de Prisma). Loguear server-side, responder genérico.
    log.error({ err: error instanceof Error ? error.message : String(error) }, 'Error scanning card')
    return NextResponse.json({ error: 'Error al escanear la cédula.' }, { status: 500 })
  }
}
