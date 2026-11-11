const BASE = '/api/applications/'
const FILES = '/api/attachments/'
const EVENTS = '/api/events/'

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.status === 204 ? null : res.json()
}

// DRF answers {"field": ["message"]}; show that as "field: message" instead of raw JSON.
async function errorMessage(res) {
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    if (data && typeof data === 'object') {
      return Object.entries(data).map(([key, value]) => `${key}: ${[].concat(value).join(' ')}`).join(' · ')
    }
  } catch {}
  return `HTTP ${res.status}`
}

export const api = {
  list: (params = {}) => request(`${BASE}?${new URLSearchParams(params)}`),
  stats: () => request(`${BASE}stats/`),
  companies: () => request(`${BASE}companies/`),
  // action: 'status' or 'kind' (with the new value), 'delete' (to the trash) or 'restore'
  bulk: (ids, action, value) =>
    request(`${BASE}bulk/`, {
      method: 'POST',
      body: JSON.stringify({ ids, action, ...(action === 'status' ? { status: value } : {}), ...(action === 'kind' ? { kind: value } : {}) }),
    }),
  addNote: (application, text, date) =>
    request(EVENTS, { method: 'POST', body: JSON.stringify({ application, text, date }) }),
  removeEvent: (id) => request(`${EVENTS}${id}/`, { method: 'DELETE' }),
  create: (data) => request(BASE, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`${BASE}${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id) => request(`${BASE}${id}/`, { method: 'DELETE' }),

  // File upload uses FormData, so no JSON Content-Type header here.
  async upload(applicationId, file, kind) {
    const body = new FormData()
    body.append('application', applicationId)
    body.append('file', file)
    body.append('kind', kind)
    const res = await fetch(FILES, { method: 'POST', body })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.file?.[0] ?? `HTTP ${res.status}`)
    }
    return res.json()
  },
  renameAttachment: (id, name) => request(`${FILES}${id}/`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  removeAttachment: (id) => request(`${FILES}${id}/`, { method: 'DELETE' }),

  async importList(file, dryRun, defaultStatus, mode = 'update') {
    const body = new FormData()
    body.append('file', file)
    body.append('dry_run', dryRun ? '1' : '0')
    body.append('default_status', defaultStatus)
    body.append('mode', mode)
    const res = await fetch(`${BASE}import/`, { method: 'POST', body })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.code ?? `HTTP ${res.status}`)
    }
    return res.json()
  },
}