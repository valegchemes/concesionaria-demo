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

export function exportToExcel(
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

  // Colores para estados si son celdas individuales
  const statusColors: Record<string, { bg: string; text: string }> = {
    'Disponible': { bg: '#dcfce7', text: '#15803d' },
    'Disponible ✅': { bg: '#dcfce7', text: '#15803d' },
    'En Preparación': { bg: '#fef3c7', text: '#b45309' },
    'Reservado': { bg: '#ffedd5', text: '#c2410c' },
    'Reservado ✅': { bg: '#ffedd5', text: '#c2410c' },
    'Vendido': { bg: '#f1f5f9', text: '#475569' },
    'Negociación': { bg: '#dbeafe', text: '#1e40af' },
    'Aprobado': { bg: '#f3e8ff', text: '#6b21a8' },
    'Aprobado ✅': { bg: '#f3e8ff', text: '#6b21a8' },
    'En Proceso de Pago': { bg: '#fef9c3', text: '#854d0e' },
    'En proceso de pago 💳': { bg: '#fef9c3', text: '#854d0e' },
    'Entregado': { bg: '#dcfce7', text: '#15803d' },
    'Entregado 🎉': { bg: '#dcfce7', text: '#15803d' },
    'Cancelado': { bg: '#fee2e2', text: '#991b1b' },
    'Cancelado ❌': { bg: '#fee2e2', text: '#991b1b' },
  }

  const headers = Object.keys(data[0])

  // Generamos las filas en formato HTML
  const rowsHtml = data.map((row) => {
    const cellsHtml = headers.map((header) => {
      let rawVal = row[header]
      
      // Traducir valores conocidos
      if (rawVal && typeof rawVal === 'string' && translationMap[rawVal]) {
        rawVal = translationMap[rawVal]
      }

      const valStr = rawVal === null || rawVal === undefined ? '' : String(rawVal)

      // Identificar tipos de columnas para aplicar clases y estilos
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

      // Generar celda formateada
      let style = 'border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; color: #334155;'
      
      if (isPrice) {
        style += " text-align: right; mso-number-format: '\\$\\#\\,\\#\\#0';"
        const num = Number(rawVal)
        return `<td style="${style}">${isNaN(num) ? valStr : num}</td>`
      } else if (isNumber) {
        style += " text-align: center; mso-number-format: '0';"
        return `<td style="${style}">${rawVal}</td>`
      } else if (isDate) {
        style += ' text-align: center;'
        let formattedDate = valStr
        if (valStr && !isNaN(Date.parse(valStr))) {
          formattedDate = new Date(valStr).toLocaleDateString('es-AR')
        }
        return `<td style="${style}">${formattedDate}</td>`
      } else if (isStatus) {
        const color = statusColors[valStr]
        if (color) {
          style += ` text-align: center; background-color: ${color.bg}; color: ${color.text}; font-weight: bold;`
        } else {
          style += ' text-align: center; font-weight: bold;'
        }
        return `<td style="${style}">${valStr}</td>`
      } else {
        style += " text-align: left; mso-number-format: '\\@';"
        // Hacer el título o nombres más legibles
        if (header.toLowerCase() === 'título' || header.toLowerCase() === 'cliente' || header.toLowerCase() === 'vehículo') {
          style += ' font-weight: bold;'
        }
        return `<td style="${style}">${valStr}</td>`
      }
    }).join('')

    return `<tr>${cellsHtml}</tr>`
  }).join('')

  // Cabecera y estructura de Excel
  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${sheetName}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 10px; text-align: center; font-size: 12px; }
        .header-title { font-size: 18px; font-weight: bold; color: #0f172a; padding: 15px 0; text-align: left; }
        .header-meta { font-size: 11px; color: #64748b; padding-bottom: 15px; text-align: left; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            <th colspan="${headers.length}" style="background-color: transparent; border: none;" class="header-title">INFORME DE ${sheetName.toUpperCase()} - AUTOMANAGER CRM</th>
          </tr>
          <tr>
            <th colspan="${headers.length}" style="background-color: transparent; border: none; font-weight: normal;" class="header-meta">
              Generado el: ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')} | Total: ${data.length} registros
            </th>
          </tr>
          <tr>
            ${headers.map(h => `<th style="min-width: 120px;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `

  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xls`
  a.click()
  URL.revokeObjectURL(url)
}
