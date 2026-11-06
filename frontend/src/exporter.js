import { today } from './constants'
import { FORM_FIELDS, visibleFormFields } from './fields'
import { t } from './i18n'
import { buildIcs } from './calendar'
import { kindName } from './kind'

// Quote a value if it contains the separator, a quote or a line break.
const quote = (value) => {
  const text = String(value ?? '')
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function valueOf(field, item) {
  const value = item[field.key]
  if (value === null || value === undefined || value === '') return ''
  if (field.key === 'kind') return kindName(value)
  if (field.type === 'select') return t(`${field.optionsPrefix}.${value}`)
  return value
}

// Same columns as the import, plus the favorite flag. The template offers the fields shown
// in the form; an export contains every field, so hidden data is not lost in a backup.
export function buildCsv(items = [], fields = FORM_FIELDS) {
  const header = [...fields.map((f) => t(f.label)), t('field.favorite')]
  const rows = items.map((item) => [
    ...fields.map((f) => valueOf(f, item)),
    item.is_favorite ? t('detail.yes') : '',
  ])
  return [header, ...rows].map((row) => row.map(quote).join(';')).join('\r\n') + '\r\n'
}

function download(filename, blob) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  // Revoking right away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

// The BOM makes Excel and LibreOffice read the file as UTF-8 (umlauts).
const downloadCsv = (filename, csv) =>
  download(filename, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))

// Follow up dates and interviews as calendar entries. Returns false when there is nothing to export.
export function downloadCalendar(items) {
  const ics = buildIcs(items, {
    followUp: (name) => t('calendar.followUp', { name }),
    interview: (name) => t('calendar.interview', { name }),
    calendar: t('calendar.name'),
  })
  if (!ics) return false
  download(`applications-${today()}.ics`, new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  return true
}

export const downloadTemplate = () =>
  downloadCsv('applications-template.csv', buildCsv([], visibleFormFields.value))
export const downloadApplications = (items) => downloadCsv(`applications-${today()}.csv`, buildCsv(items))