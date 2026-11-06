import { locale } from './i18n'

export { STATUS_KEYS, BUILTIN_KINDS, OPEN_STATUSES, SENT_STATUSES } from './status'
import { OPEN_STATUSES } from './status'

export const today = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

// An answer is awaited and the follow up date has come.
export const isDue = (i) => Boolean(i.follow_up) && i.follow_up <= today() && OPEN_STATUSES.includes(i.status)

export const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000)

export const fmt = (d) =>
  d
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d)
        .toLocaleDateString(locale.value === 'de' ? 'de-DE' : 'en-GB')
    : '–'

export const KIND_KEYS = ['cover_letter', 'cv', 'certificate', 'other']