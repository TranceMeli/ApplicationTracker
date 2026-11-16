import { normalizeLink } from './logo'

// Rules for the fields of the application form. Each returns '' when the value is fine, otherwise the key of the
// message to show next to the field. Empty optional fields are fine.
export function checkLink(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const link = normalizeLink(text)
  if (/^(mailto|tel):/i.test(link)) return ''
  try {
    const url = new URL(link)
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? '' : 'validate.link'
  } catch {
    return 'validate.link'
  }
}

export const checkEmail = (value) => {
  const text = String(value ?? '').trim()
  return !text || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? '' : 'validate.email'
}

export const checkCompany = (value) => (String(value ?? '').trim() ? '' : 'validate.company')

export const RULES = { company: checkCompany, link: checkLink, email: checkEmail }
