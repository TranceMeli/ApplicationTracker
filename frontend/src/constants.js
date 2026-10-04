import { locale } from './i18n'

export const STATUS_KEYS = ['planned', 'unsure', 'applied', 'interview', 'rejected', 'offer']

export const today = () => new Date().toISOString().slice(0, 10)

export const fmt = (d) =>
  d ? new Date(d).toLocaleDateString(locale.value === 'de' ? 'de-DE' : 'en-GB') : '–'

export const KIND_KEYS = ['cover_letter', 'cv', 'certificate', 'other']