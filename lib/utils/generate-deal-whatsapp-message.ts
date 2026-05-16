/**
 * Generates a WhatsApp message from a Deal's data.
 * All sections are conditional — missing data is simply omitted.
 */

const DEAL_STATUS_LABELS: Record<string, string> = {
  NEGOTIATION: 'En negociación',
  RESERVED: 'Reservado ✅',
  APPROVED: 'Aprobado ✅',
  IN_PAYMENT: 'En proceso de pago 💳',
  DELIVERED: 'Entregado 🎉',
  CANCELED: 'Cancelado ❌',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia bancaria',
  CHECK: 'Cheque',
  CREDIT_CARD: 'Tarjeta de crédito',
  FINANCING: 'Financiamiento',
  CRYPTO: 'Cripto',
  OTHER: 'Otro',
}

function formatCurrency(amount: number | string | null, currency: string): string {
  const value = Number(amount || 0)
  const symbol = currency === 'USD' ? 'USD' : 'ARS'
  return `${symbol} ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface DealForMessage {
  id: string
  status: string
  finalPrice: number | string
  finalPriceCurrency: string
  depositAmount: number | string | null
  depositDate: string | null
  depositMethod: string | null
  notes: string | null
  unit: { id: string; title: string }
  seller: { id: string; name: string; whatsappNumber: string | null } | null
  payments?: {
    id: string
    amount: number | string
    currency: string
    method: string
    receivedAt: string
    notes: string | null
  }[]
}

export interface TaskForMessage {
  id: string
  title: string
  dueDate: string
  assignedTo: { name: string } | null
}

export interface LeadForMessage {
  name: string
  phone: string
}

export function generateDealWhatsAppMessage({
  lead,
  deal,
  tasks,
  companyName,
}: {
  lead: LeadForMessage
  deal: DealForMessage
  tasks: TaskForMessage[]
  companyName: string
}): string {
  const lines: string[] = []

  // Greeting
  lines.push(`Hola *${lead.name}* 👋`)
  lines.push('')
  lines.push(`Aquí un resumen de tu operación en *${companyName}*:`)
  lines.push('')

  // Vehicle
  lines.push(`🚗 *Vehículo:* ${deal.unit.title}`)

  // Status
  const statusLabel = DEAL_STATUS_LABELS[deal.status] ?? deal.status
  lines.push(`📋 *Estado:* ${statusLabel}`)

  // Price (respects currency)
  const price = formatCurrency(deal.finalPrice, deal.finalPriceCurrency)
  lines.push(`💰 *Precio acordado:* ${price}`)

  // Deposit / seña
  const depositVal = Number(deal.depositAmount || 0)
  if (depositVal > 0) {
    const depositStr = formatCurrency(deal.depositAmount, deal.finalPriceCurrency)
    const methodStr = deal.depositMethod ? PAYMENT_METHOD_LABELS[deal.depositMethod] ?? deal.depositMethod : ''
    const dateStr = formatDate(deal.depositDate)
    const methodPart = methodStr ? ` (${methodStr}${dateStr ? ` — ${dateStr}` : ''})` : dateStr ? ` (${dateStr})` : ''
    lines.push(`💵 *Seña / Anticipo:* ${depositStr}${methodPart}`)
  }

  // Additional payments
  const payments = deal.payments || []
  if (payments.length > 0) {
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    if (totalPaid > 0) {
      lines.push(`💳 *Pagos registrados:* ${formatCurrency(totalPaid, deal.finalPriceCurrency)}`)
    }
  }

  // Remaining balance
  const depositAmt = Number(deal.depositAmount || 0)
  const paymentTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const totalAbonado = depositAmt + paymentTotal
  const finalPriceVal = Number(deal.finalPrice || 0)
  const saldo = finalPriceVal - totalAbonado
  
  if (saldo > 0 && totalAbonado > 0) {
    lines.push(`📊 *Saldo pendiente:* ${formatCurrency(saldo, deal.finalPriceCurrency)}`)
  }

  // Next appointment from tasks
  const nextTask = tasks.find(t => new Date(t.dueDate) >= new Date())
  if (nextTask) {
    lines.push(`📅 *Próxima cita:* ${formatDateTime(nextTask.dueDate)}`)
    lines.push(`   📝 ${nextTask.title}`)
  }

  // Seller
  if (deal.seller) {
    lines.push(`👤 *Tu asesor:* ${deal.seller.name}`)
  }

  // Deal notes
  if (deal.notes) {
    lines.push('')
    lines.push(`📌 *Notas:* ${deal.notes}`)
  }

  lines.push('')
  lines.push('Cualquier consulta, estamos a tu disposición. ¡Gracias por elegirnos! 🙏')

  return lines.join('\n')
}
