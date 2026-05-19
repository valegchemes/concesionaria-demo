import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number | null | undefined, currency: string = 'ARS'): string {
  if (amount === null || amount === undefined) return '-'
  
  if (currency === 'ARS') {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount)
  }
  
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '')
  
  // Ensure it starts with country code
  if (cleaned.startsWith('54')) {
    return cleaned
  }
  
  if (cleaned.startsWith('0')) {
    return `54${cleaned.slice(1)}`
  }
  
  if (cleaned.startsWith('9')) {
    return `54${cleaned}`
  }
  
  return `54${cleaned}`
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = formatPhoneForWhatsApp(phone)
  // Normalize to NFC to ensure emojis are stored as proper UTF-8 codepoints,
  // then encode for use in the URL query string.
  const normalizedMessage = message.normalize('NFC')
  const encodedMessage = encodeURIComponent(normalizedMessage)
  return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedMessage}`
}

export function processTemplate(template: string, variables: Record<string, string | number | undefined>): string {
  let result = template
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`
    const stringValue = value !== undefined ? String(value) : ''
    result = result.replace(new RegExp(placeholder, 'g'), stringValue)
  }
  
  return result
}
