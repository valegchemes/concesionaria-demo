export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/shared/logger'
import { getPlanLimits } from '@/lib/shared/plan-limits'
import { listUnreadEmails, sendReply, markAsRead } from '@/lib/email/gmail'

const log = createLogger('API:EmailResponderCron')

export async function GET(req: Request) {
  // 1. Verify Vercel Cron Secret for security
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  log.info({}, 'Starting email auto-responder cron job')

  try {
    // 2. Fetch all companies that have Gmail connected
    const connections = await prisma.gmailConnection.findMany({
      include: {
        company: true
      }
    })

    const results = []

    for (const connection of connections) {
      const company = connection.company
      
      // Use the centralized plan-limits function as the single source of truth.
      // This correctly handles dev bypasses, all subscription plans, and future plans automatically.
      const limits = await getPlanLimits(company.id)
      
      if (!limits.aiEnabled) {
        log.info({}, `Skipping company ${company.id} (${company.name}) - AI not enabled on their plan`)
        continue
      }

      log.info({}, `Checking emails for company: ${company.name} (${connection.emailAddress})`)

      try {
        const unreadEmails = await listUnreadEmails(company.id)
        
        if (unreadEmails.length === 0) {
          log.info({}, `No unread emails for ${company.name}`)
          results.push({ companyId: company.id, processed: 0 })
          continue
        }

        // Fetch active units to construct the catalog string
        const units = await prisma.unit.findMany({
          where: { companyId: company.id, status: 'AVAILABLE', isActive: true },
          select: { id: true, title: true, year: true, priceArs: true, priceUsd: true }
        })

        const availableUnitsList = units.map(u => {
          const priceStr = u.priceUsd ? `USD ${Number(u.priceUsd).toLocaleString('es-AR')}` : u.priceArs ? `$ ${Number(u.priceArs).toLocaleString('es-AR')} ARS` : 'Consultar'
          return `- **${u.title}** (${u.year ? `Año ${u.year}` : 'N/A'}) — Precio: ${priceStr} | Ficha pública: [Ver Ficha Técnica](/u/${u.id})`
        }).join('\n')

        const geminiKey = process.env.GEMINI_API_KEY
        if (!geminiKey) {
          log.error({}, 'GEMINI_API_KEY no está configurada.')
          continue
        }

        let processedCount = 0

        // SPAM / AUTO-SENDER FILTER: Only respond to real humans, never to automated senders
        const AUTOMATED_SENDER_PATTERNS = [
          'no-reply', 'noreply', 'do-not-reply', 'donotreply',
          'mailer-daemon', 'postmaster', 'bounce',
          'notifications@', 'notification@', 'alert@', 'alerts@',
          'newsletter@', 'news@', 'updates@', 'update@',
          'info@', 'support@', 'billing@', 'account@',
          'hello@ollama', 'microsoft-noreply', 'pubgmobile',
          'accounts.google.com', 'mail.pubgmobile', 'googleplay'
        ]

        // Process each unread email
        for (const email of unreadEmails) {
          // Skip automated senders
          const fromLower = email.from.toLowerCase()
          const isAutomated = AUTOMATED_SENDER_PATTERNS.some(pattern => fromLower.includes(pattern))
          if (isAutomated) {
            log.info({}, `Skipping automated sender: ${email.from}`)
            await markAsRead(company.id, email.id)
            continue
          }

          log.info({}, `Processing email from ${email.from} - Subject: ${email.subject}`)
          
          const prompt = `Actuá como el sistema de Respuesta Automática por Email con IA de la concesionaria de autos "${company.name}" (Argentina).
Tu email comercial de la concesionaria es "${company.email}".
Has recibido un correo electrónico de un cliente interesado en tu catálogo.

Detalles del correo recibido:
- De: ${email.from}
- Asunto original: ${email.subject}
- Mensaje:
"${email.body}"

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
3. Si el cliente menciona un vehículo específico del catálogo, dale el precio exacto que figura en el stock y pegá de forma literal el enlace de su Ficha pública (ej. [Ver fotos y detalles](/u/id-de-la-unidad)) para que pueda hacer clic y ver fotos oficiales y simular financiación.
4. Si pide financiación, comentale que contamos con el Sistema de Financiación interactivo en cuotas Fijas en pesos, UVA o USD, financiando hasta el 60% del valor del auto.
5. Si no hay una unidad exacta que coincida con lo solicitado, ofrécele las alternativas más cercanas del stock y decile que podemos conseguir la unidad que busca.
6. Presentá la información de forma muy estructurada con títulos en negrita y viñetas para que sea muy fácil de leer.
7. Finalizá la respuesta con tu firma comercial formal en representación de "${company.name}", indicando el WhatsApp central para coordinar una visita o test drive.

Devolvé únicamente el texto redactado de la propuesta de correo de respuesta (puede incluir formato HTML básico como <b>, <br>, <ul>, <li> o dejarlo en Markdown simple).`

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            }
          )

          if (!geminiRes.ok) {
            const errorBody = await geminiRes.text();
            log.error({ errorBody }, `Gemini API Error for company ${company.id}`)
            continue
          }

          const resJson = await geminiRes.json()
          let replyBody = resJson.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar respuesta'
          
          // Format basic Markdown to HTML just in case for email
          const htmlBody = replyBody
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br/>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')

          // 3. Send the reply using Gmail API (via Nodemailer OAuth)
          const replySubject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`
          await sendReply(company.id, email.from, replySubject, htmlBody, email.messageIdHeader ?? undefined, email.threadId ?? undefined)
          
          // 4. Mark the email as read in Gmail
          await markAsRead(company.id, email.id)

          // 5. Save the interaction in our database
          await prisma.emailInteraction.create({
            data: {
              companyId: company.id,
              fromEmail: email.from,
              toEmail: connection.emailAddress,
              subject: email.subject,
              messageBody: email.body,
              replyBody: htmlBody
            }
          })

          // 6. If this matches an existing lead, add a timeline activity!
          // Extract plain email from format like "Name <email@domain.com>"
          let leadEmail = email.from
          const match = leadEmail.match(/<(.+)>/)
          if (match) leadEmail = match[1]

          const matchedLead = await prisma.lead.findFirst({
            where: { email: leadEmail, companyId: company.id }
          })

          if (matchedLead) {
            // Find system or admin user to attribute the note to
            const firstUser = await prisma.user.findFirst({ where: { companyId: company.id } })
            
            await prisma.leadActivity.create({
              data: {
                leadId: matchedLead.id,
                type: 'EMAIL_SENT',
                notes: `Auto-responder IA: Se envió respuesta automática al correo "${email.subject}".\n\nCuerpo:\n${replyBody.substring(0, 300)}...`,
                createdById: firstUser?.id || '', // Fallback, shouldn't ideally be empty but fine for system actions if relationships allow
                companyId: company.id
              }
            })
          }

          processedCount++
        }
        
        results.push({ companyId: company.id, processed: processedCount })
      } catch (err) {
        log.error({ err: String(err) }, `Error processing company ${company.name}`)
        results.push({ companyId: company.id, error: String(err) })
      }
    }

    log.info({}, 'Cron job completed successfully')
    return NextResponse.json({ success: true, results })
  } catch (error) {
    log.error({ error: String(error) }, 'Fatal error in email cron')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
