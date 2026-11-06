import { reactive, ref, watch } from 'vue'

const KEY = 'tracker.logos'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) === true
  } catch {
    return false
  }
}

// Off by default: the server fetches the logos from DuckDuckGo, which then sees the company domains.
export const logosEnabled = ref(load())
watch(logosEnabled, (value) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    /* storage may be blocked, the choice then lasts for this session */
  }
})

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'web.de', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 't-online.de',
  'outlook.com', 'outlook.de', 'hotmail.com', 'hotmail.de', 'live.com', 'live.de', 'yahoo.com',
  'yahoo.de', 'icloud.com', 'me.com', 'freenet.de', 'posteo.de', 'proton.me', 'protonmail.com',
  'mailbox.org', 'aol.com', 'arcor.de', '1und1.de',
])

// Job boards and application portals: their domain says nothing about the company.
const JOB_BOARDS = new Set([
  'linkedin.com', 'xing.com', 'stepstone.de', 'stepstone.com', 'indeed.com', 'indeed.de', 'monster.de',
  'glassdoor.com', 'glassdoor.de', 'arbeitsagentur.de', 'jobware.de', 'kimeta.de', 'join.com', 'jobs.de',
  'stellenanzeigen.de', 'meinestadt.de', 'jobscout24.de', 'karriere.at', 'jobs.ch', 'get-in-it.de',
  'absolventa.de', 'ziprecruiter.com', 'jobvector.de', 'jooble.org',
])

// Applicant tracking systems where the company is the first part of the address, for example acme.recruitee.com.
const PORTALS = new Set(['personio.de', 'personio.com', 'recruitee.com', 'softgarden.io', 'workable.com', 'teamtailor.com', 'bamboohr.com'])
const GENERIC_LABELS = new Set(['www', 'jobs', 'job', 'career', 'careers', 'karriere', 'apply', 'bewerbung', 'recruiting'])
const TWO_PART_SUFFIXES = new Set(['co.uk', 'org.uk', 'com.au', 'co.at', 'or.at', 'co.nz', 'com.br'])

const hostOf = (link) => {
  try {
    const host = new URL(link).hostname.replace(/^www\./, '').toLowerCase()
    return host.includes('.') ? host : ''
  } catch {
    return ''
  }
}

// The two last parts of the host (three for suffixes such as co.uk): kiezcode.example, firma.co.uk
function registrableDomain(host) {
  const labels = host.split('.')
  const take = TWO_PART_SUFFIXES.has(labels.slice(-2).join('.')) ? 3 : 2
  return labels.slice(-take).join('.')
}

// The company domain comes from the link (unless it is a job board), otherwise from the e-mail address
// (not for free mail providers).
export function domainOf(item) {
  if (item.link) {
    const host = hostOf(item.link)
    if (host && !JOB_BOARDS.has(registrableDomain(host))) return host
  }
  const mail = (item.email || '').split('@')[1]?.toLowerCase()
  return mail && mail.includes('.') && !FREE_MAIL.has(mail) ? mail : ''
}

// Served by our own backend, which answers 404 when a company has no icon.
export const logoUrl = (domain) => `/api/logo/?domain=${encodeURIComponent(domain)}`

// Domains without an icon are remembered, so the lookup is not repeated for every row.
export const failedDomains = reactive(new Set())

export function initials(name) {
  const words = (name || '').match(/[\p{L}\p{N}]+/gu) ?? []
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

// "https://" is added when someone pastes an address without it.
export function normalizeLink(text) {
  const link = (text || '').trim()
  if (!link) return ''
  if (/^([a-z][a-z0-9+.-]*:\/\/|mailto:|tel:)/i.test(link)) return link
  return link.includes('.') && !/\s/.test(link) ? `https://${link}` : link
}

const titleCase = (label) => label.split(/[-_]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

// A guess for the company name from a link to a job posting: { domain, name }. The name is empty when the
// link points to a job board or when nothing sensible can be read from it. The user can always change it.
export function companyFromLink(link) {
  const host = hostOf(normalizeLink(link))
  if (!host) return { domain: '', name: '' }
  const root = registrableDomain(host)
  if (JOB_BOARDS.has(root)) return { domain: '', name: '' }
  if (PORTALS.has(root)) {
    const first = host.split('.')[0]
    return { domain: '', name: host === root || GENERIC_LABELS.has(first) ? '' : titleCase(first) }
  }
  const label = root.split('.')[0]
  return { domain: host, name: label ? titleCase(label) : '' }
}
