'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle,
  ArrowLeft, Download, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Expected CSV column mapping
const COLUMNS = ['Título', 'Tipo', 'Estado', 'Precio ARS', 'Precio USD', 'Año', 'VIN', 'Dominio', 'Ubicación', 'Descripción']
const TYPE_MAP: Record<string, string> = {
  'auto': 'CAR', 'car': 'CAR', 'carro': 'CAR',
  'moto': 'MOTORCYCLE', 'motorcycle': 'MOTORCYCLE',
  'lancha': 'BOAT', 'boat': 'BOAT', 'náutica': 'BOAT',
}
const STATUS_MAP: Record<string, string> = {
  'disponible': 'AVAILABLE', 'available': 'AVAILABLE',
  'en prep': 'IN_PREP', 'in_prep': 'IN_PREP', 'preparacion': 'IN_PREP',
  'reservado': 'RESERVED', 'reserved': 'RESERVED',
  'vendido': 'SOLD', 'sold': 'SOLD',
}

interface ParsedRow {
  title: string
  type: string
  status: string
  priceArs: number | null
  priceUsd: number | null
  year: number | null
  vin: string
  domain: string
  location: string
  description: string
  _errors: string[]
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const rows = lines.slice(1) // skip header

  return rows.map((line, idx) => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const errors: string[] = []

    const title = cols[0] ?? ''
    if (!title) errors.push('Título requerido')

    const rawType = (cols[1] ?? '').toLowerCase()
    const type = TYPE_MAP[rawType] ?? 'CAR'
    if (!TYPE_MAP[rawType]) errors.push(`Tipo desconocido: "${cols[1]}" — se usará CAR`)

    const rawStatus = (cols[2] ?? '').toLowerCase()
    const status = STATUS_MAP[rawStatus] ?? 'AVAILABLE'

    const priceArs = cols[3] ? parseFloat(cols[3].replace(/[^0-9.]/g, '')) || null : null
    const priceUsd = cols[4] ? parseFloat(cols[4].replace(/[^0-9.]/g, '')) || null : null

    const yearRaw = parseInt(cols[5] ?? '')
    const year = !isNaN(yearRaw) && yearRaw >= 1800 && yearRaw <= 2100 ? yearRaw : null

    return {
      title,
      type,
      status,
      priceArs,
      priceUsd,
      year,
      vin: cols[6] ?? '',
      domain: cols[7] ?? '',
      location: cols[8] ?? '',
      description: cols[9] ?? '',
      _errors: errors,
    }
  })
}

function downloadTemplate() {
  const header = COLUMNS.join(',')
  const example = [
    'Toyota Corolla 2023,Auto,Disponible,15000000,15000,2023,ABC123456,ABC123,Sucursal Centro,Excelente estado',
    'Honda CB500,Moto,Disponible,3500000,,2022,,,Depósito,',
  ].join('\n')
  const csv = `${header}\n${example}`
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'plantilla_importacion.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function BulkImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { alert('Solo se aceptan archivos .csv'); return }
    setFileName(file.name)
    setResults(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setRows(parseCSV(text))
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.title && r._errors.filter(e => !e.includes('usará')).length === 0)
    if (validRows.length === 0) { alert('No hay filas válidas para importar'); return }
    setImporting(true)
    const errors: string[] = []
    let success = 0

    for (const row of validRows) {
      try {
        const res = await fetch('/api/units', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: row.title,
            type: row.type,
            status: row.status,
            priceArs: row.priceArs,
            priceUsd: row.priceUsd,
            year: row.year,
            vin: row.vin || undefined,
            domain: row.domain || undefined,
            location: row.location || undefined,
            description: row.description || undefined,
          }),
        })
        if (res.ok) { success++ }
        else { const d = await res.json(); errors.push(`"${row.title}": ${d.error ?? res.status}`) }
      } catch { errors.push(`"${row.title}": Error de conexión`) }
    }

    setResults({ success, errors })
    setImporting(false)
    if (success > 0) {
      setTimeout(() => router.push('/app/units'), 2500)
    }
  }

  const hasRows = rows.length > 0
  const validCount = rows.filter(r => r.title && r._errors.filter(e => !e.includes('usará')).length === 0).length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/app/units">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Inventario
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            Importación Masiva de Unidades
          </h1>
          <p className="text-sm text-muted-foreground">
            Subí un CSV con múltiples unidades para crearlas en bloque.
          </p>
        </div>
      </div>

      {/* Template download */}
      <Card className="bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">¿Primer importación?</p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
              Descargá la plantilla CSV con las columnas correctas y el formato esperado.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 border-blue-300 text-blue-700" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Descargar Plantilla
          </Button>
        </CardContent>
      </Card>

      {/* Drop zone */}
      <Card
        className={cn(
          'border-2 border-dashed transition-all cursor-pointer',
          dragOver ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400'
        )}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <CardContent className="py-12 text-center">
          <Upload className={cn('h-10 w-10 mx-auto mb-3 transition-colors', dragOver ? 'text-emerald-500' : 'text-slate-400')} />
          <p className="font-semibold text-slate-600 dark:text-slate-300">
            {fileName || 'Arrastrá tu CSV aquí o hacé click para seleccionar'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Solo archivos .csv · UTF-8</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
        </CardContent>
      </Card>

      {/* Preview table */}
      {hasRows && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Vista Previa — {rows.length} filas</CardTitle>
                <CardDescription>
                  <span className="text-emerald-600 font-medium">{validCount} válidas</span>
                  {rows.length - validCount > 0 && <span className="text-red-500 font-medium ml-2">{rows.length - validCount} con errores</span>}
                </CardDescription>
              </div>
              <Button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? 'Importando...' : `Importar ${validCount} unidades`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-900">
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">#</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Título</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Tipo</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Estado</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Precio ARS</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Año</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-500">Advertencias</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const hasError = row._errors.filter(e => !e.includes('usará')).length > 0
                  return (
                    <tr key={i} className={cn('border-b', hasError ? 'bg-red-50/60 dark:bg-red-950/20' : i % 2 === 0 ? '' : 'bg-muted/10')}>
                      <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200">{row.title || <span className="text-red-500 italic">Vacío</span>}</td>
                      <td className="py-2 px-3 text-slate-500">{row.type}</td>
                      <td className="py-2 px-3 text-slate-500">{row.status}</td>
                      <td className="py-2 px-3 text-slate-500">{row.priceArs?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 px-3 text-slate-500">{row.year ?? '—'}</td>
                      <td className="py-2 px-3">
                        {row._errors.map((e, j) => (
                          <span key={j} className={cn('inline-flex items-center gap-1 text-[10px] mr-1', e.includes('usará') ? 'text-amber-600' : 'text-red-600')}>
                            {e.includes('usará') ? <AlertCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {e}
                          </span>
                        ))}
                        {row._errors.length === 0 && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card className={cn(
          'border',
          results.errors.length === 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'
        )}>
          <CardContent className="p-4 space-y-2">
            <p className="font-semibold flex items-center gap-2 text-emerald-700">
              <CheckCircle className="h-4 w-4" /> {results.success} unidades creadas exitosamente.
              {results.success > 0 && <span className="text-xs font-normal">Redirigiendo al inventario...</span>}
            </p>
            {results.errors.map((e, i) => (
              <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 shrink-0" /> {e}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
