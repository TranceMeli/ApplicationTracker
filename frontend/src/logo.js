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

// The company domain comes from the link, otherwise from the e-mail address (not for free mail providers).
export function domainOf(item) {
  if (item.link) {
    try {
      const host = new URL(item.link).hostname.replace(/^www\./, '')
      if (host.includes('.')) return host
    } catch {
      /* not a valid URL, try the e-mail address */
    }
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
