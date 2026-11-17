import { api, expect, isoDay, pdfFile, test } from './helpers'

// Files dropped on the page, like from the file manager: the same bytes under the given names.
async function transferOf(page, names) {
  const bytes = [...pdfFile().buffer]
  return page.evaluateHandle(
    ({ names, bytes }) => {
      const transfer = new DataTransfer()
      for (const name of names) transfer.items.add(new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }))
      return transfer
    },
    { names, bytes },
  )
}

async function dropOnPage(page, names) {
  const dataTransfer = await transferOf(page, names)
  const body = page.locator('body')
  await body.dispatchEvent('dragenter', { dataTransfer })
  await body.dispatchEvent('dragover', { dataTransfer })
  await body.dispatchEvent('drop', { dataTransfer })
}

const dialog = (page) => page.locator('form.inbox')
const rowFor = (page, original) => page.locator('.inbox-rows li').filter({ hasText: original })

test.describe('inbox', () => {
  test('files dropped on the page get the application, the kind and a name proposed', async ({ page }) => {
    const app = await api.create({ company: 'Müller GmbH' })
    await api.create({ company: 'Andere AG' })
    await page.goto('/')
    const transfer = await transferOf(page, ['Anschreiben_final_v2 (3).pdf'])
    await page.locator('body').dispatchEvent('dragenter', { dataTransfer: transfer })
    await expect(page.locator('.page-drop')).toBeVisible() // the page says where to drop
    await page.locator('body').dispatchEvent('dragleave', { dataTransfer: transfer })
    await expect(page.locator('.page-drop')).toHaveCount(0)

    await dropOnPage(page, ['Anschreiben_Mueller_final_v2 (3).pdf', 'Lebenslauf_Mueller.pdf'])
    await expect(dialog(page)).toBeVisible()
    const letter = rowFor(page, 'Anschreiben_Mueller_final_v2 (3).pdf')
    await expect(letter.locator('input[type=text]').first()).toHaveValue('Müller GmbH')
    await expect(letter.locator('select')).toHaveValue('cover_letter')
    await expect(letter.locator('.inbox-name input')).toHaveValue(`${isoDay()}_Müller_GmbH_Anschreiben.pdf`)
    await expect(rowFor(page, 'Lebenslauf_Mueller.pdf').locator('select')).toHaveValue('cv')

    await dialog(page).getByRole('button', { name: '2 Dateien ablegen' }).click()
    await expect(page.locator('.toast')).toContainText('Dateien abgelegt: 2')
    await expect(dialog(page)).toHaveCount(0)

    const attachments = (await api.get(app.id)).attachments
    expect(attachments.map((a) => a.name).sort()).toEqual([`${isoDay()}_Müller_GmbH_Anschreiben.pdf`, `${isoDay()}_Müller_GmbH_Lebenslauf.pdf`])
    expect(attachments.map((a) => a.kind).sort()).toEqual(['cover_letter', 'cv'])
    expect(await api.list()).toHaveLength(2) // no new application was needed
  })

  test('a file without a known company asks for one and can create a new application', async ({ page }) => {
    await api.create({ company: 'Bestehend AG' })
    await page.goto('/')
    await dropOnPage(page, ['Zeugnis.pdf', 'Scan.pdf'])

    await dialog(page).getByRole('button', { name: '2 Dateien ablegen' }).click()
    await expect(dialog(page).locator('.field-error').first()).toContainText('Wähle eine Bewerbung')
    await expect(dialog(page).locator('input[aria-invalid=true]').first()).toBeFocused()
    expect((await api.list()).length).toBe(1) // nothing was stored or created

    await dialog(page).getByLabel('Alle Dateien gehören zu').fill('Neue Firma GmbH')
    await dialog(page).getByLabel('Alle Dateien gehören zu').press('Tab')
    await expect(rowFor(page, 'Zeugnis.pdf').locator('.inbox-new')).toContainText('neue Bewerbung')
    await dialog(page).getByRole('button', { name: '2 Dateien ablegen' }).click()
    await expect(page.locator('.toast')).toContainText('Dateien abgelegt: 2, neue Bewerbungen: 1')

    const list = await api.list()
    expect(list).toHaveLength(2)
    const created = list.find((a) => a.company === 'Neue Firma GmbH')
    expect(created.status).toBe('planned')
    expect(created.attachments.map((a) => a.name).sort()).toEqual([`${isoDay()}_Neue_Firma_GmbH_Sonstiges.pdf`, `${isoDay()}_Neue_Firma_GmbH_Zeugnis.pdf`])
  })

  test('works from the menu, shows files that are not allowed and keeps original names when asked', async ({ page }) => {
    const app = await api.create({ company: 'Acme' })
    await page.goto('/')
    await page.getByRole('button', { name: 'Daten' }).click()
    await page.getByText('Unterlagen ablegen …').click()
    await expect(dialog(page)).toBeVisible()

    await dialog(page).locator('input[type=file]').setInputFiles([pdfFile('Lebenslauf_Acme.pdf'), { name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') }])
    await expect(rowFor(page, 'virus.exe').locator('.field-error')).toContainText('Dateityp nicht erlaubt')
    await expect(dialog(page).getByRole('button', { name: '1 Datei ablegen' })).toBeVisible() // the bad file does not count

    await dialog(page).getByLabel('Dateien automatisch benennen').uncheck()
    await expect(rowFor(page, 'Lebenslauf_Acme.pdf').locator('.inbox-name input')).toHaveValue('Lebenslauf_Acme.pdf')
    await rowFor(page, 'Lebenslauf_Acme.pdf').locator('.inbox-name input').fill('Mein Name')
    await dialog(page).getByRole('button', { name: '1 Datei ablegen' }).click()
    await expect(dialog(page)).toHaveCount(0)
    expect((await api.get(app.id)).attachments.map((a) => a.name)).toEqual(['Mein Name.pdf']) // the extension is kept
  })

  test('a file pasted on the page opens the inbox, and the choice of naming is remembered', async ({ page }) => {
    await api.create({ company: 'Pastefirma' })
    await page.goto('/')
    const bytes = [...pdfFile().buffer]
    await page.evaluate((bytes) => {
      const data = new DataTransfer()
      data.items.add(new File([new Uint8Array(bytes)], 'Anschreiben Pastefirma.pdf', { type: 'application/pdf' }))
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    }, bytes)
    await expect(rowFor(page, 'Anschreiben Pastefirma.pdf').locator('input[type=text]').first()).toHaveValue('Pastefirma')
    await dialog(page).getByLabel('Dateien automatisch benennen').uncheck()
    await dialog(page).getByRole('button', { name: 'Abbrechen' }).click()
    await dialog(page).getByRole('button', { name: 'Verwerfen' }).click()
    await expect(dialog(page)).toHaveCount(0)

    await page.reload()
    await page.getByRole('button', { name: 'Daten' }).click()
    await page.getByText('Unterlagen ablegen …').click()
    await dialog(page).locator('input[type=file]').setInputFiles(pdfFile('Lebenslauf Pastefirma.pdf'))
    await expect(dialog(page).getByLabel('Dateien automatisch benennen')).not.toBeChecked()
  })

  test('closing asks first when files are waiting, and Escape closes an empty inbox', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Daten' }).click()
    await page.getByText('Unterlagen ablegen …').click()
    await expect(dialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)

    await dropOnPage(page, ['Irgendwas.pdf'])
    await expect(dialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: 'Weiter bearbeiten' }).click()
    await expect(dialog(page)).toBeVisible()
  })
})
