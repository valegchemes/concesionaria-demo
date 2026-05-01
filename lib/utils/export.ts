/**
 * lib/utils/export.ts
 * Utility functions for exporting data to Excel / CSV
 */

export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Datos'
) {
  // Dynamic import to avoid adding xlsx to the server bundle
  import('xlsx').then(({ utils, writeFile }) => {
    const ws = utils.json_to_sheet(data)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, sheetName)
    writeFile(wb, `${filename}.xlsx`)
  })
}

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
