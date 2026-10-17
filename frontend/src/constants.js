import { locale } from './i18n'

export const STATUS_KEYS = ['planned', 'unsure', 'applied', 'interview', 'rejected', 'offer']

export const today = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

export const fmt = (d) =>
  d
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d)
        .toLocaleDateString(locale.value === 'de' ? 'de-DE' : 'en-GB')
    : '–'

export const KIND_KEYS = ['cover_letter', 'cv', 'certificate', 'other']