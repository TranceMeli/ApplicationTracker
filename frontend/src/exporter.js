import { today } from './constants'
import { visibleFormFields } from './fields'
import { t } from './i18n'

// Quote a value if it contains the separator, a quote or a line break.
const quote = (value) => {
  const text = String(value ?? '')
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function valueOf(field, item) {
  const value = item[field.key]
  if (value === null || value === undefined || value === '') return ''
  if (field.type === 'select') return t(`${field.optionsPrefix}.${value}`)
  return value
}

// Same columns as the import template (the fields shown in the form), plus the favorite flag.
export function buildCsv(items = []) {
  const fields = visibleFormFields.value
  const header = [...fields.map((f) => t(f.label)), t('field.favorite')]
  const rows = items.map((item) => [
    ...fields.map((f) => valueOf(f, item)),
    item.is_favorite ? t('detail.yes') : '',
  ])
  return [header, ...rows].map((row) => row.map(quote).join(';')).join('\r\n') + '\r\n'
}

function downloadCsv(filename, csv) {
  // The BOM makes Excel and LibreOffice read the file as UTF-8 (umlauts).
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export const downloadTemplate = () => downloadCsv('applications-template.csv', buildCsv([]))
export const downloadApplications = (items) => downloadCsv(`applications-${today()}.csv`, buildCsv(items))