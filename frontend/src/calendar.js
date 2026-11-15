import { OPEN_STATUSES } from './status'

// iCalendar text values: backslash, semicolon, comma and line breaks must be escaped.
const escapeText = (text) =>
  String(text).replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r?\n/g, '\\n')

// Lines are limited to 75 bytes, longer ones continue on the next line after a space. The limit counts bytes
// (UTF-8), not characters, so umlauts count twice. A character is never split.
const bytes = (char) => new TextEncoder().encode(char).length

function fold(line) {
  const chunks = []
  let current = ''
  let size = 0
  for (const char of line) {
    const limit = chunks.length ? 74 : 75 // continuation lines start with a space
    if (size + bytes(char) > limit) {
      chunks.push(current)
      current = ''
      size = 0
    }
    current += char
    size += bytes(char)
  }
  chunks.push(current)
  return chunks.map((chunk, i) => (i ? ' ' + chunk : chunk)).join('\r\n')
}

const compact = (isoDate) => isoDate.replaceAll('-', '')

function nextDay(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

// All-day events for open follow ups and for interviews. labels: { followUp(name), interview(name), calendar }
export function buildIcs(items, labels, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const events = []
  const add = (kind, item, isoDate, summary) =>
    events.push([
      'BEGIN:VEVENT',
      `UID:${kind}-${item.id}-${compact(isoDate)}@application-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(isoDate)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(isoDate))}`,
      `SUMMARY:${escapeText(summary)}`,
      ...(item.position ? [`DESCRIPTION:${escapeText(item.position)}`] : []),
      'END:VEVENT',
    ])

  for (const item of items) {
    if (item.follow_up && OPEN_STATUSES.includes(item.status)) add('followup', item, item.follow_up, labels.followUp(item.company))
    if (item.interview_date) add('interview', item, item.interview_date, labels.interview(item.company))
  }
  if (!events.length) return ''

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Application Tracker//DE',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(labels.calendar)}`,
    ...events.flat(),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
