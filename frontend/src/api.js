const BASE = '/api/applications/'
const FILES = '/api/attachments/'

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

export const api = {
  list: (params = {}) => request(`${BASE}?${new URLSearchParams(params)}`),
  stats: () => request(`${BASE}stats/`),
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
  removeAttachment: (id) => request(`${FILES}${id}/`, { method: 'DELETE' }),
}