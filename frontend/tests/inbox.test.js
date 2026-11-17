import { describe, expect, it } from 'vitest'
import { buildName, checkFile, companyKey, findCompany, guessCompany, guessKind, uniqueNames } from '../src/inbox'

const companies = [
  { id: 1, company: 'Müller GmbH' },
  { id: 2, company: 'Müller Logistik AG' },
  { id: 3, company: 'Acme' },
  { id: 4, company: 'Müller GmbH' },
  { id: 5, company: 'AB' },
]

describe('companyKey', () => {
  it('ignores case, umlauts, spaces and legal forms', () => {
    expect(companyKey('Müller GmbH & Co. KG')).toBe('mueller')
    expect(companyKey('  MUELLER  ')).toBe('mueller')
    expect(companyKey('Straße AG')).toBe('strasse')
  })
})

describe('guessKind', () => {
  it('reads the kind of document from the file name', () => {
    expect(guessKind('Anschreiben_final_v2 (3).pdf')).toBe('cover_letter')
    expect(guessKind('Lebenslauf_neu.pdf')).toBe('cv')
    expect(guessKind('CV Max Muster.pdf')).toBe('cv')
    expect(guessKind('Arbeitszeugnis Alpha.pdf')).toBe('certificate')
    expect(guessKind('Bewerbung komplett.pdf')).toBe('complete')
    expect(guessKind('Bildschirmfoto 2026-11-17.png')).toBe('other')
  })

  it('does not mistake words that only contain "cv"', () => {
    expect(guessKind('dvcvx.pdf')).toBe('other')
  })
})

describe('guessCompany', () => {
  it('finds the company in the file name', () => {
    expect(guessCompany('Anschreiben_Acme.pdf', companies)).toEqual({ id: 3, company: 'Acme' })
    expect(guessCompany('lebenslauf-acme-2026.pdf', companies)).toEqual({ id: 3, company: 'Acme' })
  })

  it('ignores umlauts and legal forms', () => {
    expect(guessCompany('Anschreiben Mueller.pdf', companies)?.company).toBe('Müller GmbH')
  })

  it('prefers the longer company name and the newer application', () => {
    expect(guessCompany('Anschreiben Müller Logistik.pdf', companies)?.id).toBe(2)
    expect(guessCompany('Anschreiben Müller.pdf', companies)?.id).toBe(4)
  })

  it('returns null without a match and ignores names that are too short', () => {
    expect(guessCompany('Lebenslauf.pdf', companies)).toBeNull()
    expect(guessCompany('abc.pdf', companies)).toBeNull()
  })
})

describe('findCompany', () => {
  it('matches typed text to an existing company, newest first', () => {
    expect(findCompany('müller gmbh', companies)?.id).toBe(4)
    expect(findCompany('Unbekannt', companies)).toBeNull()
    expect(findCompany('  ', companies)).toBeNull()
  })
})

describe('buildName', () => {
  it('joins date, company and kind and keeps the extension', () => {
    expect(buildName({ date: '2026-11-17', company: 'Müller GmbH', kindLabel: 'Anschreiben', filename: 'x (3).PDF' })).toBe(
      '2026-11-17_Müller_GmbH_Anschreiben.pdf',
    )
  })

  it('removes characters that file systems do not accept', () => {
    expect(buildName({ date: '2026-11-17', company: 'A/B: "Test" <1>', kindLabel: 'Lebenslauf', filename: 'a.pdf' })).toBe(
      '2026-11-17_AB_Test_1_Lebenslauf.pdf',
    )
  })
})

describe('uniqueNames', () => {
  it('numbers equal names in a batch and against names already attached', () => {
    expect(uniqueNames(['a.pdf', 'a.pdf', 'b.pdf'])).toEqual(['a.pdf', 'a (2).pdf', 'b.pdf'])
    expect(uniqueNames(['a.pdf'], ['A.pdf', 'a (2).pdf'])).toEqual(['a (3).pdf'])
  })
})

describe('checkFile', () => {
  it('rejects unknown types and files over 10 MB', () => {
    expect(checkFile({ name: 'a.pdf', size: 100 })).toBe('')
    expect(checkFile({ name: 'a.exe', size: 100 })).toBe('file_type')
    expect(checkFile({ name: 'noextension', size: 100 })).toBe('file_type')
    expect(checkFile({ name: 'a.pdf', size: 11 * 1024 * 1024 })).toBe('file_size')
  })
})
