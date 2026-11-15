import { beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from '../src/i18n'
import { buildCsv } from '../src/exporter'

beforeEach(() => setLocale('de'))

describe('buildCsv', () => {
  it('writes only the header for the template', () => {
    const csv = buildCsv([])
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.trim().split('\r\n')).toHaveLength(1)
    expect(csv).toContain('Unternehmen;Stelle')
  })

  it('translates statuses and types, quotes special characters and marks favourites', () => {
    const csv = buildCsv([
      { id: 1, company: 'Acme; "Test"', status: 'applied', kind: 'agency', is_favorite: true, notes: 'a\nb' },
      { id: 2, company: 'Zwei', status: 'planned', kind: 'Messe', is_favorite: false },
    ])
    expect(csv).toContain('"Acme; ""Test"""')
    expect(csv).toContain('Beworben')
    expect(csv).toContain('Vermittler')
    expect(csv).toContain('"a\nb"')
    expect(csv).toContain('Messe')
    const rows = csv.split('\r\n')
    expect(rows[1].endsWith(';Ja')).toBe(true)
    expect(rows[2].endsWith(';')).toBe(true)
  })
})
