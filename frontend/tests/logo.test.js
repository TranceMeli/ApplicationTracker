import { describe, expect, it } from 'vitest'
import { companyFromLink, domainOf, initials, normalizeLink } from '../src/logo'

describe('domainOf', () => {
  it('uses the link unless it is a job board', () => {
    expect(domainOf({ link: 'https://www.firma.de/jobs/1' })).toBe('firma.de')
    expect(domainOf({ link: 'https://www.linkedin.com/jobs/1' })).toBe('')
  })

  it('falls back to the e-mail unless it is a free provider', () => {
    expect(domainOf({ email: 'hr@firma.de' })).toBe('firma.de')
    expect(domainOf({ email: 'ich@gmail.com' })).toBe('')
    expect(domainOf({ link: 'https://stepstone.de/x', email: 'hr@firma.de' })).toBe('firma.de')
    expect(domainOf({})).toBe('')
  })
})

describe('initials', () => {
  it('takes the first letters of two words', () => {
    expect(initials('Kiez Code GmbH')).toBe('KC')
    expect(initials('ägir')).toBe('Ä')
    expect(initials('')).toBe('?')
    expect(initials(null)).toBe('?')
  })
})

describe('normalizeLink', () => {
  it('adds https only to things that look like addresses', () => {
    expect(normalizeLink(' firma.de/jobs ')).toBe('https://firma.de/jobs')
    expect(normalizeLink('http://a.de')).toBe('http://a.de')
    expect(normalizeLink('mailto:a@b.de')).toBe('mailto:a@b.de')
    expect(normalizeLink('kein link')).toBe('kein link')
    expect(normalizeLink('')).toBe('')
  })
})

describe('companyFromLink', () => {
  it('guesses the name from the domain', () => {
    expect(companyFromLink('https://www.kiez-code.de/karriere')).toEqual({ domain: 'kiez-code.de', name: 'Kiez Code' })
    expect(companyFromLink('firma.co.uk')).toEqual({ domain: 'firma.co.uk', name: 'Firma' })
  })

  it('reads the company from an applicant portal and ignores job boards', () => {
    expect(companyFromLink('https://acme.recruitee.com/o/dev')).toEqual({ domain: '', name: 'Acme' })
    expect(companyFromLink('https://jobs.personio.de/x')).toEqual({ domain: '', name: '' })
    expect(companyFromLink('https://www.xing.com/jobs/1')).toEqual({ domain: '', name: '' })
    expect(companyFromLink('nonsense')).toEqual({ domain: '', name: '' })
  })
})
