import { describe, expect, it } from 'vitest'
import { checkCompany, checkEmail, checkLink } from '../src/validate'

describe('checkCompany', () => {
  it('needs a name', () => {
    expect(checkCompany('')).toBe('validate.company')
    expect(checkCompany('   ')).toBe('validate.company')
    expect(checkCompany(null)).toBe('validate.company')
    expect(checkCompany(' Acme ')).toBe('')
  })
})

describe('checkLink', () => {
  it('accepts empty, addresses with and without protocol, mail and phone links', () => {
    for (const ok of ['', '  ', 'firma.de/jobs', 'https://www.firma.de/x?a=1', 'http://firma.de', 'mailto:a@b.de', 'tel:+49123']) {
      expect(checkLink(ok)).toBe('')
    }
  })
  it('rejects text that is not an address', () => {
    for (const bad of ['firma punkt de', 'irgendwas', 'ftp://firma.de', 'https://localhost']) {
      expect(checkLink(bad)).toBe('validate.link')
    }
  })
})

describe('checkEmail', () => {
  it('accepts empty and valid, rejects the rest', () => {
    expect(checkEmail('')).toBe('')
    expect(checkEmail('name@firma.de')).toBe('')
    for (const bad of ['name', 'name@', '@firma.de', 'name@firma', 'na me@firma.de']) expect(checkEmail(bad)).toBe('validate.email')
  })
})
