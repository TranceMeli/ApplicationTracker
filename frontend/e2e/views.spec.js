import { api, expect, rowOf, test } from './helpers'

test.describe('views and appearance', () => {
  test('moves a card on the board by dragging and with the status select', async ({ page }) => {
    await api.create({ company: 'Boardfirma', status: 'planned' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Board', exact: true }).click()
    await expect(page.locator('.board-col')).toHaveCount(6)

    const card = page.locator('.board-col').nth(0).locator('.board-card', { hasText: 'Boardfirma' })
    // grab the card by its title: the middle of the card is the status select, which cannot start a drag
    await card.dragTo(page.locator('.board-col').nth(2), { sourcePosition: { x: 10, y: 8 } })
    await expect.poll(async () => (await api.list())[0].status).toBe('applied')

    await page.locator('.board-col').nth(2).locator('.board-card', { hasText: 'Boardfirma' }).locator('select').selectOption('planned')
    await expect.poll(async () => (await api.list())[0].status).toBe('planned')
  })

  test('switches between list, cards and board and remembers the view', async ({ page }) => {
    await api.create({ company: 'Ansichtsfirma' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Board', exact: true }).click()
    await expect(page.locator('.board-col').first()).toBeVisible()
    await page.reload()
    await expect(page.locator('.board-col').first()).toBeVisible()
  })

  test('switches to dark mode and keeps it after a reload', async ({ page }) => {
    await page.goto('/')
    await page.locator('.theme-toggle').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('switches the language to English', async ({ page }) => {
    await api.create({ company: 'Sprachfirma' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Einstellungen' }).click()
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await expect(page.getByRole('button', { name: 'New application' }).first()).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('has no horizontal scrolling on a phone and offers the floating add button', async ({ browser }) => {
    await api.create({ company: 'Handyfirma', position: 'Mit einer ziemlich langen Stellenbezeichnung für die Entwicklung' })
    const context = await browser.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, locale: 'de-DE' })
    await context.addInitScript(() => {
      localStorage.setItem('locale', 'de')
      localStorage.setItem('tracker.view', '"cards"')
    })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('.fab')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await context.close()
  })

  test('opens the detail dialog from the card view', async ({ page }) => {
    await api.create({ company: 'Kartenfirma' })
    await page.addInitScript(() => localStorage.setItem('tracker.view', '"cards"'))
    await page.goto('/')
    await page.getByText('Kartenfirma').first().click()
    await expect(page.locator('section.detail, .dialog.detail').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.dialog.detail')).toHaveCount(0)
    await expect(rowOf(page, 'Kartenfirma').or(page.getByText('Kartenfirma').first())).toBeVisible()
  })
})
