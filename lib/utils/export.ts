/**
 * lib/utils/export.ts
 * Utility functions for exporting data to Excel / CSV.
 *
 * NOTE: The xlsx dependency was removed (CVE-2023-30533).
 * If Excel export is needed, install exceljs: `npm install exceljs`
 * and replace the exportToExcel implementation.
 */

/**
 * Export data to CSV file (client-side, browser only).
 * Includes BOM for correct UTF-8 encoding in Excel.
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = String(val).replace(/"/g, '""')
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

import ExcelJS from 'exceljs'

export async function exportToExcel(
  data: Record<string, any>[],
  filename: string,
  sheetName = 'Datos'
) {
  if (!data.length) return

  // Mapeamos los nombres de los tipos de vehículos y estados a español si existen
  const translationMap: Record<string, string> = {
    // Tipos de vehículos
    CAR: 'Automóvil',
    MOTORCYCLE: 'Motocicleta',
    BOAT: 'Náutica / Embarcación',
    // Estados de vehículos
    AVAILABLE: 'Disponible',
    IN_PREP: 'En Preparación',
    RESERVED: 'Reservado',
    SOLD: 'Vendido',
    // Estados de operaciones
    NEGOTIATION: 'Negociación',
    APPROVED: 'Aprobado',
    IN_PAYMENT: 'En Proceso de Pago',
    DELIVERED: 'Entregado',
    CANCELED: 'Cancelado',
    // Tipos de adquisición
    PURCHASE: 'Compra Directa',
    CONSIGNMENT: 'Consignación',
    TRADE_IN: 'Toma Usado / Permuta'
  }

  // Colores para estados (formato ARGB sin el #, ej: AARRGGBB)
  const statusColors: Record<string, { bg: string; text: string }> = {
    'Disponible': { bg: 'FFDCFCE7', text: 'FF15803D' },
    'Disponible ✅': { bg: 'FFDCFCE7', text: 'FF15803D' },
    'En Preparación': { bg: 'FFFFF3C7', text: 'FFB45309' },
    'Reservado': { bg: 'FFFFEDD5', text: 'FFC2410C' },
    'Reservado ✅': { bg: 'FFFFEDD5', text: 'FFC2410C' },
    'Vendido': { bg: 'FFF1F5F9', text: 'FF475569' },
    'Negociación': { bg: 'FFDBEAFE', text: 'FF1E40AF' },
    'Aprobado': { bg: 'FFF3E8FF', text: 'FF6B21A8' },
    'Aprobado ✅': { bg: 'FFF3E8FF', text: 'FF6B21A8' },
    'En Proceso de Pago': { bg: 'FFFFF9C3', text: 'FF854D0E' },
    'En proceso de pago 💳': { bg: 'FFFFF9C3', text: 'FF854D0E' },
    'Entregado': { bg: 'FFDCFCE7', text: 'FF15803D' },
    'Entregado 🎉': { bg: 'FFDCFCE7', text: 'FF15803D' },
    'Cancelado': { bg: 'FFFEE2E2', text: 'FF991B1B' },
    'Cancelado ❌': { bg: 'FFFEE2E2', text: 'FF991B1B' },
  }

  // Crear libro de trabajo y hoja
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  })

  // Obtener nombres de columnas
  const headers = Object.keys(data[0])

  // Fila 1: Título del informe
  worksheet.mergeCells(1, 1, 1, headers.length)
  const titleRow = worksheet.getRow(1)
  titleRow.height = 35
  const titleCell = titleRow.getCell(1)
  titleCell.value = `INFORME DE ${sheetName.toUpperCase()} - AUTOMANAGER CRM`
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0F172A' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }

  // Fila 2: Metadatos
  worksheet.mergeCells(2, 1, 2, headers.length)
  const metaRow = worksheet.getRow(2)
  metaRow.height = 20
  const metaCell = metaRow.getCell(1)
  metaCell.value = `Generado el: ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')} | Total: ${data.length} registros`
  metaCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } }
  metaCell.alignment = { vertical: 'middle', horizontal: 'left' }

  // Fila 3: Espacio vacío de separación
  worksheet.getRow(3).height = 10

  // Fila 4: Encabezados de tabla
  const headerRow = worksheet.getRow(4)
  headerRow.height = 25
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = header
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    }
  })

  // Rellenar filas de datos
  data.forEach((row, rowIndex) => {
    const excelRowIndex = rowIndex + 5
    const excelRow = worksheet.getRow(excelRowIndex)
    excelRow.height = 20

    headers.forEach((header, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1)
      let rawVal = row[header]

      // Traducir valores conocidos
      if (rawVal && typeof rawVal === 'string' && translationMap[rawVal]) {
        rawVal = translationMap[rawVal]
      }

      const valStr = rawVal === null || rawVal === undefined ? '' : String(rawVal)

      // Identificar tipos de columnas
      const isPrice = header.toLowerCase().includes('precio') || 
                      header.toLowerCase().includes('costo') || 
                      header.toLowerCase().includes('monto') || 
                      header.toLowerCase().includes('revenue') || 
                      header.toLowerCase().includes('saldo') || 
                      header.toLowerCase().includes('seña') || 
                      header.toLowerCase().includes('anticipo')

      const isDate = header.toLowerCase().includes('fecha') || 
                     header.toLowerCase().includes('date') || 
                     header.toLowerCase().includes('registro') || 
                     header.toLowerCase().includes('creado')

      const isStatus = header.toLowerCase().includes('estado') || 
                       header.toLowerCase().includes('status')

      const isNumber = typeof rawVal === 'number' && !isPrice

      // Formatear celda
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }

      if (isPrice) {
        const num = Number(rawVal)
        if (!isNaN(num) && rawVal !== '') {
          cell.value = num
          cell.numFmt = '$#,##0'
        } else {
          cell.value = ''
        }
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
      } else if (isNumber) {
        cell.value = rawVal
        cell.numFmt = '0'
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (isDate) {
        if (valStr && !isNaN(Date.parse(valStr))) {
          cell.value = new Date(valStr)
          cell.numFmt = 'dd/mm/yyyy'
        } else {
          cell.value = '-'
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (isStatus) {
        cell.value = valStr
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        
        const color = statusColors[valStr]
        if (color) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: color.bg }
          }
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: color.text } }
        }
      } else {
        cell.value = valStr
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
        
        // Destacar columnas principales
        if (header.toLowerCase() === 'título' || header.toLowerCase() === 'cliente' || header.toLowerCase() === 'vehículo') {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } }
        }
      }
    })
  })

  // Auto-ajustar ancho de columnas de manera inteligente
  worksheet.columns.forEach((column) => {
    let maxLength = 12
    if (column.values) {
      column.values.forEach((value, idx) => {
        if (idx > 3 && value) { // Omitir el título de la hoja y el meta en la medición
          let length = 0
          if (value instanceof Date) {
            length = 10
          } else if (typeof value === 'number') {
            length = value.toLocaleString('es-AR').length + 2
          } else {
            length = String(value).length
          }
          if (length > maxLength) {
            maxLength = length
          }
        }
      })
    }
    column.width = Math.min(maxLength + 4, 35) // Margen holgado, límite máximo 35
  })

  // Generar archivo y disparar descarga
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
