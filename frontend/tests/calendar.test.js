import { describe, expect, it } from 'vitest'
import { buildIcs } from '../src/calendar'

const labels = { followUp: (n) => `Nachfassen: ${n}`, interview: (n) => `Gespräch: ${n}`, calendar: 'Bewerbungen' }
const now = new Date('2026-03-01T10:00:00Z')

describe('buildIcs', () => {
  it('returns nothing without dates', () => {
    expect(buildIcs([{ id: 1, company: 'A', status: 'planned' }], labels, now)).toBe('')
  })

  it('exports follow ups only while an answer is awaited, and interviews always', () => {
    const ics = buildIcs([
      { id: 1, company: 'Offen', status: 'applied', follow_up: '2026-03-10' },
      { id: 2, company: 'Absage', status: 'rejected', follow_up: '2026-03-11' },
      { id: 3, company: 'Gespräch', status: 'interview', interview_date: '2026-03-31' },
    ], labels, now)
    expect(ics).toContain('SUMMARY:Nachfassen: Offen')
    expect(ics).not.toContain('Absage')
    expect(ics).toContain('SUMMARY:Gespräch: Gespräch')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260310')
    expect(ics).toContain('DTEND;VALUE=DATE:20260311')
    expect(ics).toContain('DTEND;VALUE=DATE:20260401')
    expect(ics).toContain('DTSTAMP:20260301T100000Z')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('escapes special characters and adds the position as description', () => {
    const ics = buildIcs([{ id: 1, company: 'A, B; C', status: 'applied', follow_up: '2026-12-31', position: 'Dev\nOps' }], labels, now)
    expect(ics).toContain('Nachfassen: A\\, B\\; C')
    expect(ics).toContain('DESCRIPTION:Dev\\nOps')
    expect(ics).toContain('DTEND;VALUE=DATE:20270101')
  })

  it('folds long lines to at most 75 bytes', () => {
    const ics = buildIcs([{ id: 1, company: 'Ä'.repeat(200), status: 'applied', follow_up: '2026-03-10' }], labels, now)
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(ics.replace(/\r\n /g, '')).toContain('Ä'.repeat(200))
  })
})
