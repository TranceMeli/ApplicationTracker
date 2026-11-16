import { api, expect, isoDay, rowOf, rows, test } from './helpers'

const today = (page) => page.locator('section.today')

test.describe('today panel', () => {
  test('lists what needs attention and narrows the list from the card', async ({ page }) => {
    await api.create({ company: 'Fällig AG', status: 'applied', date: isoDay(-10), follow_up: isoDay(-2) })
    await api.create({ company: 'Später GmbH', status: 'applied', date: isoDay(-3), follow_up: isoDay(10) })
    await api.create({ company: 'Gespräch KG', status: 'interview', date: isoDay(-10), interview_date: isoDay(3) })
    await page.goto('/')

    await expect(today(page)).toContainText('Nachfassen fällig · 1')
    await expect(today(page)).toContainText('Fällig AG')
    await expect(today(page)).toContainText('seit 2 Tagen')
    await expect(today(page)).toContainText('Nächste Gespräche · 1')
    await expect(today(page)).toContainText('Gespräch KG')

    await today(page).getByRole('button', { name: 'Alle 1 anzeigen' }).click()
    await expect(rows(page)).toHaveCount(1)
    await expect(rowOf(page, 'Fällig AG')).toBeVisible()
    await expect(page.locator('.filter-chip')).toContainText('Nachfassen')
    await expect(page.locator('.result-count')).toHaveText('1 von 3 Bewerbungen')
    await expect(today(page)).toHaveCount(0) // the panel makes room while the list is narrowed down

    await page.getByRole('button', { name: 'Alle zurücksetzen' }).click()
    await expect(rows(page)).toHaveCount(3)
    await expect(today(page)).toBeVisible()
  })

  test('finds applications that wait for an answer for a long time', async ({ page }) => {
    await api.create({ company: 'Wartet lange', status: 'applied', date: isoDay(-40) })
    await api.create({ company: 'Frisch', status: 'applied', date: isoDay(-5) })
    await page.goto('/')
    await expect(today(page)).toContainText('Wartet seit über 21 Tagen · 1')
    await expect(today(page)).toContainText('40 Tage')
    await today(page).getByRole('button', { name: 'Alle 1 anzeigen' }).click()
    await expect(rows(page)).toHaveCount(1)
    await expect(rowOf(page, 'Wartet lange')).toBeVisible()
  })

  test('opens an application from the panel and can be hidden for good', async ({ page }) => {
    await api.create({ company: 'Fällig AG', status: 'applied', date: isoDay(-10), follow_up: isoDay(-1) })
    await page.goto('/')
    await today(page).getByRole('button', { name: 'Fällig AG' }).click()
    await expect(page.locator('section.detail, .dialog.detail').first()).toBeVisible()
    await page.keyboard.press('Escape')

    await today(page).getByRole('button', { name: 'Ausblenden' }).click()
    await expect(today(page).getByText('Nachfassen fällig')).toHaveCount(0)
    await page.reload()
    await expect(today(page).getByRole('button', { name: 'Einblenden' })).toBeVisible()
    await expect(today(page).getByText('Nachfassen fällig')).toHaveCount(0)
  })

  test('says so when nothing is open and stays away without applications', async ({ page }) => {
    await page.goto('/')
    await expect(today(page)).toHaveCount(0)
    await api.create({ company: 'Neu', status: 'planned' })
    await page.reload()
    await expect(today(page)).toContainText('Heute ist nichts offen.')
  })
})

test.describe('filters and result count', () => {
  test('shows how many applications match a search or status and clears them together', async ({ page }) => {
    await api.create({ company: 'Alpha', status: 'planned' })
    await api.create({ company: 'Beta', status: 'applied' })
    await api.create({ company: 'Betatest', status: 'planned' })
    await page.goto('/')
    await expect(page.locator('.result-count')).toHaveCount(0)

    await page.getByPlaceholder(/Suchen/).fill('beta')
    await expect(page.locator('.result-count')).toHaveText('2 von 3 Bewerbungen')
    await page.getByRole('button', { name: /^Geplant/ }).click()
    await expect(page.locator('.result-count')).toHaveText('1 von 3 Bewerbungen')
    await page.getByRole('button', { name: 'Alle zurücksetzen' }).click()
    await expect(rows(page)).toHaveCount(3)
    await expect(page.locator('.result-count')).toHaveCount(0)
  })
})

test.describe('forms', () => {
  test('shows errors at the quick dialog fields and sends nothing', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Neue Bewerbung' }).first().click()
    const dialog = page.locator('form.quick-dialog')
    await dialog.locator('.company-row input').fill('Neu GmbH')
    await dialog.locator('input[inputmode=url]').fill('firma punkt de')
    await dialog.locator('button[type=submit]').click()
    await expect(dialog.locator('.field-error')).toHaveCount(1)
    await expect(dialog.locator('.field-error')).toContainText('Beispiel: firma.de/jobs')
    await expect(dialog.locator('input[inputmode=url]')).toHaveAttribute('aria-invalid', 'true')
    await expect(dialog.locator('input[inputmode=url]')).toBeFocused()

    await dialog.locator('input[inputmode=url]').fill('')
    await expect(dialog.locator('.field-error')).toHaveCount(0) // typing takes the error away
    await dialog.locator('.company-row input').fill('')
    await dialog.locator('button[type=submit]').click()
    await expect(dialog.locator('.field-error')).toContainText('Gib den Namen des Unternehmens ein.')
    await expect(dialog.locator('.company-row input')).toBeFocused()
    expect(await api.list()).toHaveLength(0)

    await dialog.locator('.company-row input').fill('Neu GmbH')
    await dialog.locator('button[type=submit]').click()
    await expect(rowOf(page, 'Neu GmbH')).toBeVisible()
    await expect(page.locator('.toast')).toContainText('„Neu GmbH“ hinzugefügt')
  })

  test('shows errors in the full form, also for a field in a folded section', async ({ page }) => {
    const app = await api.create({ company: 'Formfirma', email: '' })
    await page.goto('/')
    await page.locator('.row-open', { hasText: 'Formfirma' }).first().click()
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    const form = page.locator('form.dialog')
    await form.locator('#field-company').fill('')
    await form.locator('#field-email').evaluate((el) => { el.closest('details').open = false })
    await form.locator('#field-email').evaluate((el) => { el.value = 'kein-mail' ; el.dispatchEvent(new Event('input')) })
    await form.locator('button[type=submit]').click()
    await expect(form.locator('#error-company')).toContainText('Gib den Namen')
    await form.locator('#field-company').fill('Formfirma 2')
    await form.locator('button[type=submit]').click()
    await expect(form.locator('#error-email')).toContainText('E-Mail-Adresse')
    await expect(form.locator('#field-email')).toBeFocused()
    expect((await api.get(app.id)).company).toBe('Formfirma')

    await form.locator('#field-email').fill('name@firma.de')
    await form.locator('button[type=submit]').click()
    await expect.poll(async () => (await api.get(app.id)).company).toBe('Formfirma 2')
    await expect(page.locator('.toast')).toContainText('„Formfirma 2“ gespeichert')
  })

  test('adds https to a link that was typed without it', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Neue Bewerbung' }).first().click()
    const dialog = page.locator('form.quick-dialog')
    await dialog.locator('input[inputmode=url]').fill('firma.de/jobs')
    await dialog.locator('.company-row input').fill('Linkfirma')
    await dialog.locator('button[type=submit]').click()
    await expect.poll(async () => (await api.list())[0]?.link).toBe('https://firma.de/jobs')
  })

  test('asks before unsaved entries are thrown away', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Neue Bewerbung' }).first().click()
    const dialog = page.locator('form.quick-dialog')
    await dialog.locator('.company-row input').fill('Halb fertig')

    await dialog.getByRole('button', { name: 'Abbrechen' }).click()
    const guard = dialog.getByRole('alertdialog')
    await expect(guard).toContainText('Änderungen verwerfen?')
    await guard.getByRole('button', { name: 'Weiter bearbeiten' }).click()
    await expect(guard).toHaveCount(0)
    await expect(dialog.locator('.company-row input')).toHaveValue('Halb fertig')

    await page.keyboard.press('Escape') // Escape asks too, and a second Escape goes back to the form
    await expect(guard).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(guard).toHaveCount(0)
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await guard.getByRole('button', { name: 'Verwerfen' }).click()
    await expect(page.locator('form.quick-dialog')).toHaveCount(0)
    expect(await api.list()).toHaveLength(0)
  })

  test('closes without asking when nothing was typed', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Neue Bewerbung' }).first().click()
    await page.keyboard.press('Escape')
    await expect(page.locator('form.quick-dialog')).toHaveCount(0)
  })

  test('asks before closing the edit form with changes', async ({ page }) => {
    await api.create({ company: 'Alt AG' })
    await page.goto('/')
    await page.locator('.row-open', { hasText: 'Alt AG' }).first().click()
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    const form = page.locator('form.dialog')
    await form.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(form).toHaveCount(0) // unchanged, so it closes at once

    await page.locator('.row-open', { hasText: 'Alt AG' }).first().click()
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await form.locator('#field-company').fill('Neu AG')
    await form.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(form.getByRole('alertdialog')).toBeVisible()
    await form.getByRole('button', { name: 'Verwerfen' }).click()
    expect((await api.list())[0].company).toBe('Alt AG')
  })

  test('keeps a draft of the quick dialog and brings it back', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Neue Bewerbung' }).first().click()
    let dialog = page.locator('form.quick-dialog')
    await dialog.locator('.company-row input').fill('Entwurf GmbH')
    await dialog.getByLabel('Stelle', { exact: true }).fill('Backend')
    await expect(dialog.locator('.draft-note')).toHaveText('Entwurf gesichert.')

    await page.reload() // as if the tab was closed by accident
    await page.getByRole('button', { name: 'Neue Bewerbung' }).first().click()
    dialog = page.locator('form.quick-dialog')
    await expect(dialog.locator('.company-row input')).toHaveValue('Entwurf GmbH')
    await expect(dialog.getByLabel('Stelle', { exact: true })).toHaveValue('Backend')
    await expect(dialog.locator('.draft-note')).toContainText('wiederhergestellt')

    await dialog.locator('button[type=submit]').click() // saving removes the draft
    await expect(rowOf(page, 'Entwurf GmbH')).toBeVisible()
    await page.getByRole('button', { name: 'Neue Bewerbung' }).first().click()
    await expect(page.locator('form.quick-dialog .company-row input')).toHaveValue('')
  })
})

test.describe('feedback and keyboard access', () => {
  test('confirms a status change and takes it back with undo', async ({ page }) => {
    await api.create({ company: 'Statusfirma', status: 'planned' })
    await page.goto('/')
    await page.locator('.row-open', { hasText: 'Statusfirma' }).first().click()
    await page.locator('section.detail select, .dialog.detail select').first().selectOption('applied')
    await expect(page.locator('.toast')).toContainText('„Statusfirma“: Beworben')
    await expect.poll(async () => (await api.list())[0].status).toBe('applied')
    await page.locator('.toast').getByRole('button', { name: 'Rückgängig' }).click()
    await expect.poll(async () => (await api.list())[0].status).toBe('planned')
  })

  test('has a skip link that is the first stop for the keyboard and moves the focus to the content', async ({ page }) => {
    await api.create({ company: 'Tastaturfirma' })
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Zum Inhalt springen' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#main')).toBeFocused()
  })

  test('announces the result count to screen readers', async ({ page }) => {
    await api.create({ company: 'Eins' })
    await page.goto('/')
    await page.getByPlaceholder(/Suchen/).fill('Eins')
    await expect(page.locator('.result-count')).toHaveAttribute('role', 'status')
  })
})
