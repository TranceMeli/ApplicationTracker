import { api, expect, isoDay, test } from './helpers'

const tile = (page, label) => page.locator('.tile', { hasText: label })

test.describe('statistics', () => {
  test('counts only applications that were really sent', async ({ page }) => {
    await api.create({ company: 'Geplant 1', status: 'planned' })
    await api.create({ company: 'Unsicher', status: 'unsure' })
    await api.create({ company: 'Gesendet', status: 'applied' })
    await api.create({ company: 'Gespräch', status: 'interview' })
    await api.create({ company: 'Absage', status: 'rejected' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Statistik' }).click()
    await expect(tile(page, 'Abgeschickt').locator('strong')).toHaveText('3')
  })

  test('shows no average, and a rate of 0 %, while nobody has answered', async ({ page }) => {
    await api.create({ company: 'Gesendet', status: 'applied', date: isoDay(-5) })
    await page.goto('/')
    await page.getByRole('button', { name: 'Statistik' }).click()
    await expect(tile(page, 'Antwortquote').locator('strong')).toHaveText('0 %')
    await expect(tile(page, 'Tage bis Antwort').locator('strong')).toHaveText('–')
  })

  test('calculates the days until the answer from the response date', async ({ page }) => {
    await api.create({ company: 'A', status: 'interview', date: isoDay(-20), response_date: isoDay(-10) })
    await api.create({ company: 'B', status: 'rejected', date: isoDay(-20), response_date: isoDay(-14) })
    await page.goto('/')
    await page.getByRole('button', { name: 'Statistik' }).click()
    await expect(tile(page, 'Tage bis Antwort').locator('strong')).toHaveText('8')
    await expect(tile(page, 'Antwortquote').locator('strong')).toHaveText('100 %')
  })

  test('falls back to the logged status change when no response date was entered', async ({ page }) => {
    const app = await api.create({ company: 'Ohne Datum', status: 'applied', date: isoDay(-12) })
    await api.patch(app.id, { status: 'interview' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Statistik' }).click()
    // the change was logged today, so the answer came 12 days after sending
    await expect(tile(page, 'Tage bis Antwort').locator('strong')).toHaveText('12')
  })

  test('draws the Sankey diagram from sent applications only', async ({ page }) => {
    await api.create({ company: 'Geplant', status: 'planned' })
    for (const status of ['applied', 'applied', 'interview', 'rejected', 'offer']) await api.create({ company: `S ${status}`, status })
    await page.goto('/')
    await page.getByRole('button', { name: 'Statistik' }).click()
    const sankey = page.locator('svg.sankey')
    await expect(sankey).toBeVisible()
    const text = await sankey.textContent()
    expect(text).toMatch(/5/) // five sent applications flow in
    expect(text).not.toMatch(/Geplant/)
    expect(await sankey.locator('path').count()).toBeGreaterThan(2)
  })

  test('counts the types, including the agency type', async ({ page }) => {
    await api.create({ company: 'Agentur', status: 'applied', kind: 'agency' })
    await api.create({ company: 'Stelle', status: 'applied', kind: 'posting' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Statistik' }).click()
    await expect(page.getByText('Vermittler').first()).toBeVisible()
    expect((await api.stats()).by_kind.agency).toBe(1)
  })
})
