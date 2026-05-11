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

/**
 * @deprecated Excel export requires exceljs. Use exportToCSV instead.
 * Install: npm install exceljs && npm install --save-dev @types/exceljs
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  _sheetName = 'Datos'
) {
  console.warn('[export] Excel export via xlsx has been removed (CVE-2023-30533). Falling back to CSV.')
  exportToCSV(data, filename)
}
