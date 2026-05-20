export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/shared/auth-helpers'
import { getPlanLimits } from '@/lib/shared/plan-limits'
import { createLogger } from '@/lib/shared/logger'
import * as fs from 'fs'
import * as path from 'path'

const log = createLogger('API:EmailInbound')

// In-memory logs cache fallback for serverless runtimes like Vercel
let memoryLogs: any[] = []

function getLogsFilePath() {
  return path.join(process.env.TEMP || '/tmp', 'windsurf_email_logs.json')
}

function readLogs(): any[] {
  try {
    const filePath = getLogsFilePath()
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(data)
    }
  } catch (err) {
    log.error({ error: String(err) }, 'Error reading email logs from file')
  }
  return memoryLogs
}

function writeLogs(logs: any[]) {
  memoryLogs = logs
  try {
    const filePath = getLogsFilePath()
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf8')
  } catch (err) {
    log.error({ error: String(err) }, 'Error writing email logs to file')
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    const limits = await getPlanLimits(session.user.companyId)
    if (!limits.aiEnabled) {
      return NextResponse.json({ error: 'Tu plan no incluye las funciones de Inteligencia Artificial.' }, { status: 403 })
    }

    const allLogs = readLogs()
    // Filter logs for this company only
    const companyLogs = allLogs.filter(l => l.companyId === session.user.companyId)
    return NextResponse.json({ success: true, logs: companyLogs })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    
    // 1. Enforce Plan Pro
    const limits = await getPlanLimits(session.user.companyId)
    if (!limits.aiEnabled) {
      return NextResponse.json({ error: 'Tu plan no incluye las funciones de Inteligencia Artificial.' }, { status: 403 })
    }

    const body = await req.json()
    const { clientEmail, subject, message } = body

    if (!clientEmail || !subject || !message) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (clientEmail, subject, message)' }, { status: 400 })
    }

    // 2. Fetch company and active inventory catalog
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId }
    })

    if (!company) {
      return NextResponse.json({ error: 'Compañía no encontrada' }, { status: 404 })
    }

    const units = await prisma.unit.findMany({
      where: { companyId: company.id, status: 'AVAILABLE', isActive: true },
      select: {
        id: true,
        title: true,
        year: true,
        priceArs: true,
        priceUsd: true
      }
    })

    // Construct format list of vehicles
    const availableUnitsList = units.map(u => {
      const priceStr = u.priceUsd ? `USD ${Number(u.priceUsd).toLocaleString('es-AR')}` : u.priceArs ? `$ ${Number(u.priceArs).toLocaleString('es-AR')} ARS` : 'Consultar'
      return `- **${u.title}** (${u.year ? `Año ${u.year}` : 'N/A'}) — Precio: ${priceStr} | Ficha pública: [Ver Ficha Técnica](/u/${u.id})`
    }).join('\n')

    // 3. Call Gemini to draft the auto-reply
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json({ error: 'La clave GEMINI_API_KEY no está configurada.' }, { status: 500 })
    }

    const prompt = `Actuá como el sistema de Respuesta Automática por Email con IA de la concesionaria de autos "${company.name}" (Argentina).
Tu email comercial de la concesionaria es "${company.email}".
Has recibido un correo electrónico de un cliente interesado en tu catálogo.

Detalles del correo recibido:
- De: ${clientEmail}
- Asunto original: ${subject}
- Mensaje:
"${message}"

Aquí tenés el catálogo completo de vehículos disponibles actualmente en tu stock:
${availableUnitsList}

Información de contacto de la concesionaria:
- Nombre: ${company.name}
- Dirección: ${company.address || 'Consultar dirección'}
- WhatsApp Central: ${company.whatsappCentral || company.phone || 'No especificado'}

Tu objetivo:
Escribí un correo electrónico de respuesta automática comercial de alta conversión, sumamente profesional y personalizado que responda directamente a lo que el cliente solicita.

Reglas obligatorias:
1. Usá el voseo rioplatense argentino ("vos"), sé sumamente cálido, prolijo y atento.
2. Identificá qué vehículo o tipo de información solicita el cliente en su correo.
3. Si el cliente menciona un vehículo específico del catálogo (ej. "Cronos", "Hilux", "Fiesta", etc.), dale el precio exacto que figura en el stock y pegá de forma literal el enlace de su Ficha pública (ej. [Ver fotos y detalles](/u/id-de-la-unidad)) para que pueda hacer clic y ver fotos oficiales y simular financiación.
4. Si pide financiación, comentale que contamos con el Sistema de Financiación interactivo (Francés) en cuotas Fijas en pesos, UVA o USD, financiando hasta el 60% del valor del auto, y que puede hacer la simulación y descargar el PDF formal desde el enlace de la ficha del auto.
5. Si no hay una unidad exacta que coincida con lo solicitado, ofrécele las alternativas más cercanas del stock y decile que podemos conseguir la unidad que busca.
6. Presentá la información de forma muy estructurada con títulos en negrita y viñetas para que sea muy fácil de leer.
7. Finalizá la respuesta con tu firma comercial formal en representación de "${company.name}", indicando el WhatsApp central (${company.whatsappCentral || 'WhatsApp'}) para coordinar una visita o test drive.

Devolvé únicamente el texto redactado de la propuesta de correo de respuesta, con el formato de email final listo para ser enviado.`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      log.error({ errText }, 'Gemini API Error in Email Auto-responder')
      return NextResponse.json({ error: 'Error del servicio de IA de Gemini' }, { status: 500 })
    }

    const resJson = await geminiRes.json()
    const replyBody = resJson.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar respuesta'

    // 4. Save this interaction to our logs
    const newLog = {
      id: `mail_${Date.now()}`,
      companyId: company.id,
      clientEmail,
      subject,
      message,
      replySubject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
      replyBody,
      createdAt: new Date().toISOString()
    }

    const currentLogs = readLogs()
    currentLogs.unshift(newLog)
    writeLogs(currentLogs)

    // 5. Also register this inbound request as a Lead activity if there is a lead with this email
    const matchedLead = await prisma.lead.findFirst({
      where: { email: clientEmail, companyId: company.id }
    })

    if (matchedLead) {
      await prisma.leadActivity.create({
        data: {
          leadId: matchedLead.id,
          type: 'EMAIL_SENT',
          notes: `Auto-responder IA: Se envió respuesta automática al correo "${subject}".\n\nCuerpo:\n${replyBody.substring(0, 300)}...`,
          createdById: session.user.id,
          companyId: company.id
        }
      })
    }

    return NextResponse.json({
      success: true,
      log: newLog
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado'
    log.error({ error: String(err) }, 'Error in POST email inbound')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
