import { readFile } from 'node:fs/promises'
import { api, expect, isoDay, rows, test } from './helpers'

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Daten' }).click()
}

test.describe('data', () => {
  test('exports the applications as CSV', async ({ page }) => {
    await api.create({ company: 'Export; GmbH', status: 'applied', kind: 'agency' })
    await page.goto('/')
    await openDataMenu(page)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export als CSV' }).click()])
    expect(download.suggestedFilename()).toMatch(/^applications-\d{4}-\d{2}-\d{2}\.csv$/)
    const csv = await readFile(await download.path(), 'utf8')
    expect(csv.charCodeAt(0)).toBe(0xfeff) // byte order mark for Excel
    expect(csv).toContain('"Export; GmbH"')
    expect(csv).toContain('Vermittler')
  })

  test('exports follow-ups and interviews as a calendar file', async ({ page }) => {
    await api.create({ company: 'Kalenderfirma', status: 'interview', interview_date: isoDay(3) })
    await page.goto('/')
    await openDataMenu(page)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Kalender (.ics) laden' }).click()])
    const ics = await readFile(await download.path(), 'utf8')
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics).toContain('Gespräch: Kalenderfirma')
  })

  test('downloads a backup zip', async ({ page }) => {
    await api.create({ company: 'Sicherung' })
    await page.goto('/')
    const response = await page.request.get('/api/backup/')
    expect(response.headers()['content-type']).toBe('application/zip')
    const bytes = await response.body()
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b])
  })

  test('imports a CSV file, skipping duplicates', async ({ page }) => {
    await api.create({ company: 'Schon da', position: 'Alt' })
    await page.goto('/')
    await openDataMenu(page)
    await page.getByRole('button', { name: /Import aus Datei/ }).click()
    const csv = 'Unternehmen;Stelle;Status\r\nSchon da;Alt;Geplant\r\nNeu GmbH;Neu;Beworben\r\n'
    await page.locator('input[type=file]').setInputFiles({ name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await page.locator('.overlay').getByRole('button', { name: /Importieren/ }).click()
    await expect.poll(async () => (await api.list()).length).toBe(2)
    expect((await api.list()).some((a) => a.company === 'Neu GmbH')).toBe(true)
  })

  test('hides a field in the table with the field settings', async ({ page }) => {
    await api.create({ company: 'Feldfirma', position: 'Unsichtbar machen' })
    await page.goto('/')
    await expect(rows(page).first()).toContainText('Unsichtbar machen')
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    await page.getByRole('button', { name: 'Felder verwalten' }).click()
    await page.getByRole('button', { name: /^Kopf der Ansicht/ }).click()
    await page.getByRole('checkbox', { name: /^Stelle: Tabelle/ }).uncheck()
    await page.keyboard.press('Escape')
    await expect(rows(page).first()).not.toContainText('Unsichtbar machen')
  })
})
