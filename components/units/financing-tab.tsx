'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'
import { 
  Sparkles, DollarSign, Calculator, Send, Download, 
  Calendar, Percent, TrendingUp, Info 
} from 'lucide-react'
import { jsPDF } from 'jspdf'

interface FinancingTabProps {
  unit: {
    id: string
    title: string
    priceArs: number | null
    priceUsd: number | null
    year: number | null
    domain: string | null
  }
  company: {
    name: string
    phone: string | null
    email: string | null
    logoUrl: string | null
  } | null
}

export function FinancingTab({ unit, company }: FinancingTabProps) {
  // Determine starting currency and price
  const isUsdDefault = !unit.priceArs && !!unit.priceUsd
  const initialPrice = isUsdDefault ? (unit.priceUsd || 0) : (unit.priceArs || 0)
  const currencySymbol = isUsdDefault ? 'USD' : 'ARS'

  const [price, setPrice] = useState<number>(initialPrice)
  const [downPayment, setDownPayment] = useState<number>(Math.round(initialPrice * 0.4)) // 40% down payment as starting default
  const [months, setMonths] = useState<number>(36)
  const [interestRate, setInterestRate] = useState<number>(48) // 48% TNA as standard starting default
  const [financingType, setFinancingType] = useState<'fixed' | 'uva' | 'usd'>(isUsdDefault ? 'usd' : 'fixed')

  // Financial calculations
  const totalToFinance = Math.max(0, price - downPayment)
  const downPaymentPercent = price > 0 ? Math.round((downPayment / price) * 100) : 0

  // Standard French System Amortization Formula
  // r = monthly rate (TNA / 12 / 100)
  const getMonthlyInstallment = () => {
    if (totalToFinance <= 0) return 0
    if (interestRate <= 0) return totalToFinance / months

    const monthlyRate = (interestRate / 12) / 100
    const installment = totalToFinance * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
    
    return isNaN(installment) || !isFinite(installment) ? 0 : Math.round(installment)
  }

  const monthlyInstallment = getMonthlyInstallment()
  const totalRepayment = monthlyInstallment * months
  const totalInterest = Math.max(0, totalRepayment - totalToFinance)

  const handleDownPaymentSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = Number(e.target.value)
    setDownPayment(Math.round((price * percent) / 100))
  }

  // Generate WhatsApp Message
  const shareOnWhatsApp = () => {
    const installmentFormatted = financingType === 'usd'
      ? `*US$ ${monthlyInstallment.toLocaleString('es-AR')}*`
      : `*${formatPrice(monthlyInstallment, 'ARS')}*`

    const priceFormatted = financingType === 'usd'
      ? `*US$ ${price.toLocaleString('es-AR')}*`
      : `*${formatPrice(price, 'ARS')}*`

    const downPaymentFormatted = financingType === 'usd'
      ? `*US$ ${downPayment.toLocaleString('es-AR')}* (${downPaymentPercent}%)`
      : `*${formatPrice(downPayment, 'ARS')}* (${downPaymentPercent}%)`

    const financeFormatted = financingType === 'usd'
      ? `*US$ ${totalToFinance.toLocaleString('es-AR')}*`
      : `*${formatPrice(totalToFinance, 'ARS')}*`

    const typeText = financingType === 'fixed' 
      ? 'Cuotas Fijas en Pesos (TNA ' + interestRate + '%)'
      : financingType === 'uva'
      ? 'Cuotas UVA Preajustadas'
      : 'Cuotas fijas en Dólares Billete'

    const message = `*Simulación de Financiación - AutoManager CRM* 🚗💨

Hola, te hacemos llegar la simulación de financiación armada especialmente para el vehículo *${unit.title}*:

💰 *Precio de la Unidad*: ${priceFormatted}
💵 *Entrega / Anticipo*: ${downPaymentFormatted}
📝 *Saldo a Financiar*: ${financeFormatted}

🗓️ *Plan de Pago*: ${months} cuotas mensuales de ${installmentFormatted}
🔒 *Modalidad*: ${typeText}

_Los montos son simulados y sujetos a aprobación crediticia. Cualquier duda, estamos a tu entera disposición. ¡Saludos!_`

    const encodedText = encodeURIComponent(message)
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank')
  }

  // Generate a jaw-dropping PDF using vector shapes in jsPDF for maximum resolution and premium quality
  const downloadFinancingPdf = () => {
    const doc = new jsPDF()

    // Color Palette
    const slate800 = [30, 41, 59]
    const indigo700 = [67, 56, 202]
    const slate600 = [71, 85, 105]
    const textGray = [51, 65, 85]

    // Brand header banner
    doc.setFillColor(indigo700[0], indigo700[1], indigo700[2])
    doc.rect(0, 0, 210, 40, 'F')

    // Document Title
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('PROPUESTA DE FINANCIACIÓN', 15, 25)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(company?.name || 'AUTOMANAGER CRM', 150, 25)

    // Divider Line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(15, 48, 195, 48)

    // Unit info section
    doc.setTextColor(slate800[0], slate800[1], slate800[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('Vehículo Seleccionado', 15, 60)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(textGray[0], textGray[1], textGray[2])
    doc.text(`Unidad: ${unit.title}`, 15, 68)
    if (unit.year) doc.text(`Año: ${unit.year}`, 15, 75)
    if (unit.domain) doc.text(`Patente / Dominio: ${unit.domain.toUpperCase()}`, 15, 82)

    // Visual Box for financial summaries
    doc.setFillColor(248, 250, 252) // Light Gray
    doc.roundedRect(15, 92, 180, 75, 4, 4, 'F')
    doc.setDrawColor(203, 213, 225)
    doc.roundedRect(15, 92, 180, 75, 4, 4, 'D')

    doc.setTextColor(slate800[0], slate800[1], slate800[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Detalles del Financiamiento', 22, 104)

    // Simulation numbers
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(textGray[0], textGray[1], textGray[2])
    doc.text('Precio de la unidad:', 22, 114)
    doc.text('Anticipo / Entrega acordada:', 22, 122)
    doc.text('Saldo neto a financiar:', 22, 130)
    doc.text('Plazo del préstamo:', 22, 138)
    doc.text('Tasa Nominal Anual (TNA):', 22, 146)
    doc.text('Tipo de Financiación:', 22, 154)

    doc.setFont('helvetica', 'bold')
    const formatValue = (val: number) => financingType === 'usd' ? `US$ ${val.toLocaleString('es-AR')}` : formatPrice(val, 'ARS')
    doc.text(formatValue(price), 100, 114)
    doc.text(`${formatValue(downPayment)} (${downPaymentPercent}%)`, 100, 122)
    doc.text(formatValue(totalToFinance), 100, 130)
    doc.text(`${months} meses`, 100, 138)
    doc.text(`${interestRate}% TNA`, 100, 146)
    doc.text(financingType === 'fixed' ? 'Pesos - Cuotas Fijas' : financingType === 'uva' ? 'Pesos - Cuotas UVA' : 'Dólares Billete', 100, 154)

    // Grand display: Monthly installment box
    doc.setFillColor(67, 56, 202) // Indigo
    doc.roundedRect(15, 178, 180, 25, 4, 4, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('CUOTA MENSUAL ESTIMADA:', 22, 194)
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(formatValue(monthlyInstallment), 110, 194)

    // Legal Footer notes
    doc.setTextColor(slate600[0], slate600[1], slate600[2])
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.text('* Esta cotización es un simulador preliminar y no implica aprobación crediticia definitiva.', 15, 225)
    doc.text('* Cuotas e intereses calculados bajo amortización de Sistema Francés.', 15, 230)
    if (company?.phone || company?.email) {
      doc.setFont('helvetica', 'bold')
      doc.text(`Consultas o contacto: ${company.phone || ''} | ${company.email || ''}`, 15, 245)
    }

    doc.save(`Cotizacion_${unit.title.replace(/\s+/g, '_')}.pdf`)
  }

  return (
    <Card className="border border-border">
      <CardHeader className="bg-muted/40 pb-4 border-b border-border">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Calculator className="h-5 w-5 text-primary animate-pulse" />
          Simulador Inteligente de Financiación
        </CardTitle>
        <p className="text-xs text-muted-foreground">Calculá cuotas francesas en segundos y compartilas con tu cliente por WhatsApp o PDF.</p>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls Panel */}
          <div className="space-y-5">
            {/* Price Selection */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="price-input" className="text-sm font-semibold">Valor del Vehículo</Label>
                <div className="flex bg-muted p-0.5 rounded-lg border border-border">
                  <button 
                    onClick={() => {
                      setFinancingType(isUsdDefault ? 'usd' : 'fixed')
                      setPrice(isUsdDefault ? (unit.priceUsd || 0) : (unit.priceArs || 0))
                      setDownPayment(Math.round((isUsdDefault ? (unit.priceUsd || 0) : (unit.priceArs || 0)) * 0.4))
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      financingType !== 'usd' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    ARS
                  </button>
                  <button 
                    onClick={() => {
                      setFinancingType('usd')
                      setPrice(unit.priceUsd || 0)
                      setDownPayment(Math.round((unit.priceUsd || 0) * 0.4))
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      financingType === 'usd' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    USD
                  </button>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-medium">
                  {financingType === 'usd' ? 'US$' : '$'}
                </span>
                <Input
                  id="price-input"
                  type="number"
                  value={price || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setPrice(val)
                    setDownPayment(Math.round(val * 0.4))
                  }}
                  className="pl-8 font-bold text-foreground text-base"
                />
              </div>
            </div>

            {/* Down payment control */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <Label className="font-semibold">Entrega / Anticipo</Label>
                <span className="font-bold text-primary">{downPaymentPercent}% ({financingType === 'usd' ? `US$ ${downPayment.toLocaleString('es-AR')}` : formatPrice(downPayment, 'ARS')})</span>
              </div>
              
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={downPaymentPercent}
                onChange={handleDownPaymentSliderChange}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />

              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">
                  {financingType === 'usd' ? 'US$' : '$'}
                </span>
                <Input
                  type="number"
                  value={downPayment || ''}
                  onChange={(e) => {
                    const val = Math.min(price, Number(e.target.value))
                    setDownPayment(val)
                  }}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            {/* Term of loan (Months) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Plazo (Cuotas)</Label>
              <div className="grid grid-cols-5 gap-2">
                {[12, 24, 36, 48, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonths(m)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      months === m
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            {/* Interest Rate */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <Label className="font-semibold">Tasa de Interés Anual (TNA)</Label>
                <span className="font-bold text-primary">{interestRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="120"
                step="2"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="relative mt-2">
                <span className="absolute right-3 top-2.5 text-muted-foreground text-sm">%</span>
                <Input
                  type="number"
                  value={interestRate || ''}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="pr-8 text-sm"
                />
              </div>
            </div>

            {/* Type selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Modalidad de Financiación</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'fixed', label: 'Cuota Fija' },
                  { id: 'uva', label: 'Cuota UVA' },
                  { id: 'usd', label: 'Dólar Fijo' },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    disabled={financingType === 'usd' && type.id !== 'usd'}
                    onClick={() => setFinancingType(type.id as any)}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border text-center transition-all ${
                      financingType === type.id
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-muted border-border text-muted-foreground'
                    } disabled:opacity-40`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Diagnostics Display Card */}
          <div className="flex flex-col justify-between h-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl space-y-6">
            <div className="space-y-4">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-300 tracking-wider">Simulación Consolidada</span>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{unit.title}</h4>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Saldo neto a financiar:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {financingType === 'usd' ? `US$ ${totalToFinance.toLocaleString('es-AR')}` : formatPrice(totalToFinance, 'ARS')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Tasa de interés:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{interestRate}% TNA / French</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Plazo elegido:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{months} meses</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-800 pt-3">
                  <span className="text-slate-500 dark:text-slate-400">Intereses Totales:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {financingType === 'usd' ? `US$ ${totalInterest.toLocaleString('es-AR')}` : formatPrice(totalInterest, 'ARS')}
                  </span>
                </div>
              </div>

              {/* Master master display for cuota amount */}
              <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-md text-center space-y-1 mt-4">
                <span className="text-xs text-white/80 font-medium tracking-wide uppercase">Cuota Mensual Estimada</span>
                <p className="text-3xl font-black">
                  {financingType === 'usd' ? `US$ ${monthlyInstallment.toLocaleString('es-AR')}` : formatPrice(monthlyInstallment, 'ARS')}
                </p>
                <span className="text-[10px] text-white/70 block mt-1">
                  * Sistema Francés. Sujeto a variabilidad según tipo de cambio o UVA.
                </span>
              </div>
            </div>

            {/* Print & Share actions */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button
                onClick={shareOnWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-5 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-transform hover:scale-[1.02]"
              >
                <Send className="h-4 w-4" />
                WhatsApp
              </Button>
              
              <Button
                onClick={downloadFinancingPdf}
                variant="outline"
                className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl py-5 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-transform hover:scale-[1.02]"
              >
                <Download className="h-4 w-4 text-indigo-600" />
                Descargar PDF
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
