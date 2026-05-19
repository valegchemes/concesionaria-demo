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
  const statusLabel = DEAL_STATUS_LABELS[deal.status] ?? deal.status
  const price = formatCurrency(deal.finalPrice, deal.finalPriceCurrency)
  const sellerName = deal.seller?.name ?? 'Tu asesor'

  // Core summary block — exact format as requested
  let message = `Hola ${lead.name} 👋\n\nAquí un resumen de tu operación en ${companyName}:\n\n🚗 Vehículo: ${deal.unit.title}\n🤝 Estado: ${statusLabel}\n💰 Precio acordado: ${price}\n👤 Tu asesor: ${sellerName}`

  // Optional: deposit / seña
  const depositVal = Number(deal.depositAmount || 0)
  if (depositVal > 0) {
    const depositStr = formatCurrency(deal.depositAmount, deal.finalPriceCurrency)
    const methodStr = deal.depositMethod ? PAYMENT_METHOD_LABELS[deal.depositMethod] ?? deal.depositMethod : ''
    const dateStr = formatDate(deal.depositDate)
    const methodPart = methodStr ? ` (${methodStr}${dateStr ? ` — ${dateStr}` : ''})` : dateStr ? ` (${dateStr})` : ''
    message += `\n💵 Seña / Anticipo: ${depositStr}${methodPart}`
  }

  // Optional: additional payments
  const payments = deal.payments || []
  const paymentTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  if (paymentTotal > 0) {
    message += `\n💳 Pagos registrados: ${formatCurrency(paymentTotal, deal.finalPriceCurrency)}`
  }

  // Optional: remaining balance
  const totalAbonado = Number(deal.depositAmount || 0) + paymentTotal
  const saldo = Number(deal.finalPrice || 0) - totalAbonado
  if (saldo > 0 && totalAbonado > 0) {
    message += `\n📊 Saldo pendiente: ${formatCurrency(saldo, deal.finalPriceCurrency)}`
  }

  // Optional: next appointment
  const nextTask = tasks.find(t => new Date(t.dueDate) >= new Date())
  if (nextTask) {
    message += `\n📅 Próxima cita: ${formatDateTime(nextTask.dueDate)}\n   📝 ${nextTask.title}`
  }

  // Optional: notes
  if (deal.notes) {
    message += `\n\n📌 Notas: ${deal.notes}`
  }

  message += `\n\nCualquier consulta, estamos a tu disposición. ¡Gracias por elegirnos! ✨`

  return message.normalize('NFC')
}

