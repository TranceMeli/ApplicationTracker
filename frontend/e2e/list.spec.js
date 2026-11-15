import { api, expect, isoDay, openDetail, rowOf, rows, test } from './helpers'

test.describe('list', () => {
  test('shows the applications, searches and clears the search', async ({ page }) => {
    await api.create({ company: 'Alpha GmbH', position: 'Entwicklerin' })
    await api.create({ company: 'Beta AG', position: 'Tester' })
    await page.goto('/')
    await expect(rows(page)).toHaveCount(2)

    await page.getByPlaceholder(/Suchen/).fill('tester')
    await expect(rows(page)).toHaveCount(1)
    await expect(rowOf(page, 'Beta AG')).toBeVisible()

    await page.getByPlaceholder(/Suchen/).fill('gibt es nicht')
    await expect(rows(page)).toHaveCount(0)
    await expect(page.getByText('Keine Treffer')).toBeVisible()
    await page.getByRole('button', { name: 'Filter zurücksetzen' }).click()
    await expect(rows(page)).toHaveCount(2)
  })

  test('shows the empty state without applications', async ({ page }) => {
    await page.goto('/')
    await expect(rows(page)).toHaveCount(0)
    await expect(page.locator('.state').first()).toBeVisible()
  })

  test('sorts by a column in three steps', async ({ page }) => {
    await api.create({ company: 'Zebra' })
    await api.create({ company: 'Apfel' })
    await page.goto('/')
    const header = page.locator('thead th').filter({ hasText: 'Unternehmen' })
    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'ascending')
    await expect(rows(page).first()).toContainText('Apfel')
    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'descending')
    await expect(rows(page).first()).toContainText('Zebra')
    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'none')
  })

  test('adds an application with the quick dialog and warns about a duplicate', async ({ page }) => {
    await api.create({ company: 'Kiezcode Studio' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Neue Bewerbung' }).first().click()
    const dialog = page.locator('form.quick-dialog')
    await dialog.locator('.company-row input').fill('kiezcode  studio')
    await expect(dialog.locator('.notice')).toContainText('Es gibt schon eine Bewerbung für „Kiezcode Studio“')

    await dialog.locator('.company-row input').fill('Neue Firma')
    await dialog.getByLabel('Stelle', { exact: true }).fill('Backend')
    await dialog.getByRole('button', { name: 'Beworben', exact: true }).click()
    await dialog.getByRole('button', { name: 'Vermittler', exact: true }).click()
    await dialog.locator('button[type=submit]').click()
    await expect(rowOf(page, 'Neue Firma')).toBeVisible()
    await expect(rowOf(page, 'Neue Firma')).toContainText('Vermittler')

    const saved = (await api.list()).find((a) => a.company === 'Neue Firma')
    expect(saved).toMatchObject({ status: 'applied', kind: 'agency', position: 'Backend' })
  })

  test('changes the status and the type in the detail dialog', async ({ page }) => {
    await api.create({ company: 'Statusfirma' })
    await page.goto('/')
    await openDetail(page, 'Statusfirma')
    await page.locator('section.detail select, .dialog.detail select').first().selectOption('interview')
    await expect.poll(async () => (await api.list())[0].status).toBe('interview')
    await page.locator('.kind-select').selectOption('agency')
    await expect.poll(async () => (await api.list())[0].kind).toBe('agency')
  })

  test('keeps a history with notes', async ({ page }) => {
    await api.create({ company: 'Verlauf AG' })
    await page.goto('/')
    await openDetail(page, 'Verlauf AG')
    await page.getByRole('tab', { name: /Verlauf/ }).click()
    await page.locator('.note-form input[type=text]').fill('Anruf mit Tim')
    await page.locator('.note-form').getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.locator('.timeline')).toContainText('Anruf mit Tim')
    await page.locator('.timeline li.note button').click()
    await expect(page.locator('.timeline')).not.toContainText('Anruf mit Tim')

    await page.locator('.note-form').getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.locator('.error').first()).toContainText('Notiz eingeben')
  })

  test('deletes after confirming and brings the application back with undo', async ({ page }) => {
    await api.create({ company: 'Weg damit' })
    await api.create({ company: 'Bleibt' })
    await page.goto('/')
    await rowOf(page, 'Weg damit').locator('.row-menu .menu-trigger').click()
    await page.locator('.menu-panel').getByRole('button', { name: 'Löschen' }).click()
    await page.locator('.overlay.confirm').getByRole('button', { name: 'Löschen' }).click()
    await expect(rows(page)).toHaveCount(1)
    expect(await api.list()).toHaveLength(1)
    await page.locator('.toast').getByRole('button', { name: 'Rückgängig' }).click()
    await expect(rows(page)).toHaveCount(2)
    expect(await api.list()).toHaveLength(2)
  })

  test('changes the status of several applications at once', async ({ page }) => {
    for (const company of ['Eins', 'Zwei', 'Drei']) await api.create({ company })
    await page.goto('/')
    await rows(page).nth(0).locator('td.sel input').check()
    await rows(page).nth(1).locator('td.sel input').check()
    await expect(page.locator('.bulk-bar')).toContainText('2 ausgewählt')
    await page.locator('.bulk-bar select').first().selectOption('rejected')
    await expect.poll(async () => (await api.stats()).by_status.rejected).toBe(2)
  })

  test('reminds of due follow-ups and filters them', async ({ page }) => {
    await api.create({ company: 'Fällig', status: 'applied', follow_up: isoDay(-1) })
    await api.create({ company: 'Später', status: 'applied', follow_up: isoDay(10) })
    await page.goto('/')
    const banner = page.locator('.due-banner')
    await expect(banner).toContainText('1 Nachfass-Termin')
    await banner.getByRole('button', { name: 'Anzeigen' }).click()
    await expect(rows(page)).toHaveCount(1)
    await expect(rowOf(page, 'Fällig')).toBeVisible()
    await banner.getByRole('button', { name: 'Alle anzeigen' }).click()
    await expect(rows(page)).toHaveCount(2)
  })
})
