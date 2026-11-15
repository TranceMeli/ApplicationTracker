import { readFileSync } from 'node:fs'
import { test as base, expect } from '@playwright/test'

export { expect }
export const API = 'http://localhost:8021/api'
export const SAMPLE_PDF = new URL('./fixtures/sample.pdf', import.meta.url)

const pdfBytes = () => readFileSync(SAMPLE_PDF)
export const pdfFile = (name = 'Anschreiben.pdf') => ({ name, mimeType: 'application/pdf', buffer: pdfBytes() })

const json = async (response) => {
  if (!response.ok) throw new Error(`${response.status} ${response.url} ${await response.text()}`)
  return response.status === 204 ? null : response.json()
}

// Direct calls to the test backend, used to prepare data and to check what the app saved.
export const api = {
  list: async () => json(await fetch(`${API}/applications/`)),
  stats: async () => json(await fetch(`${API}/applications/stats/`)),
  get: async (id) => json(await fetch(`${API}/applications/${id}/`)),
  create: async (data) =>
    json(await fetch(`${API}/applications/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'planned', ...data }) })),
  patch: async (id, data) =>
    json(await fetch(`${API}/applications/${id}/`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })),
  clear: async () => {
    const ids = (await api.list()).map((a) => a.id)
    if (ids.length) await json(await fetch(`${API}/applications/bulk/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action: 'delete' }) }))
  },
  upload: async (id, { name, mimeType, buffer }, kind = 'cover_letter') => {
    const form = new FormData()
    form.append('application', String(id))
    form.append('kind', kind)
    form.append('file', new Blob([buffer], { type: mimeType }), name)
    return json(await fetch(`${API}/attachments/`, { method: 'POST', body: form }))
  },
}

export const isoDay = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

// Every test starts with an empty database, German, the list view and the light theme. Errors in the page's console
// fail the test, because a broken page that still "looks fine" is exactly what these tests should catch.
export const test = base.extend({
  page: async ({ page }, use) => {
    await api.clear()
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e-init')) return
      sessionStorage.setItem('e2e-init', '1')
      localStorage.clear()
      localStorage.setItem('locale', 'de')
      localStorage.setItem('tracker.theme', 'light')
      localStorage.setItem('tracker.view', '"list"')
    })
    const problems = []
    page.on('pageerror', (e) => problems.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) problems.push(m.text())
    })
    await use(page)
    expect(problems).toEqual([])
  },
})

export const rows = (page) => page.locator('tbody tr:not(.group-row)')
export const rowOf = (page, company) => rows(page).filter({ hasText: company })

export async function openDetail(page, company) {
  await page.locator('.row-open', { hasText: company }).first().click()
  await expect(page.locator('section.detail, .dialog.detail').first()).toBeVisible()
}
