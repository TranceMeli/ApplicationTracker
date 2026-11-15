import { deflateSync } from 'node:zlib'
import { api, expect, openDetail, pdfFile, test } from './helpers'

// A small valid PNG (8 x 8, one colour), built here so that no binary fixture is needed.
function makePng() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc(body), body.length + 4)
    return out
  }
  const size = 8
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8 bit, RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x66)])
  const pixels = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
}

async function openFiles(page, company) {
  await page.goto('/')
  await openDetail(page, company)
  await page.getByRole('tab', { name: /Unterlagen/ }).click()
}

test.describe('documents', () => {
  test('attaches a file with the chosen type', async ({ page }) => {
    const app = await api.create({ company: 'Unterlagenfirma' })
    await openFiles(page, 'Unterlagenfirma')
    await page.locator('select[aria-label]').filter({ has: page.locator('option', { hasText: 'Gesamtunterlagen' }) }).selectOption('complete')
    await page.locator('input[type=file]').setInputFiles(pdfFile('Gesamt.pdf'))
    await expect(page.locator('.files li')).toContainText('Gesamt.pdf')
    await expect(page.locator('.files li')).toContainText('Gesamtunterlagen')
    const saved = await api.get(app.id)
    expect(saved.attachments).toHaveLength(1)
    expect(saved.attachments[0].kind).toBe('complete')
  })

  test('rejects a file type that is not allowed', async ({ page }) => {
    const app = await api.create({ company: 'Fehlerfirma' })
    await openFiles(page, 'Fehlerfirma')
    await page.locator('input[type=file]').setInputFiles({ name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') })
    await expect.poll(async () => (await api.get(app.id)).attachments.length).toBe(0)
    await expect(page.locator('.files li')).toHaveCount(0)
  })

  test('shows a document in the viewer, switches with the arrow keys and closes in layers', async ({ page }) => {
    const app = await api.create({ company: 'Viewerfirma' })
    await api.upload(app.id, pdfFile('Eins.pdf'), 'cover_letter')
    await api.upload(app.id, pdfFile('Zwei.pdf'), 'cv')
    await api.upload(app.id, { name: 'Notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('Vorbereitung') }, 'other')
    await api.upload(app.id, { name: 'Lebenslauf.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') }, 'cv')
    await openFiles(page, 'Viewerfirma')

    await page.locator('.doc-open', { hasText: 'Eins.pdf' }).click()
    const viewer = page.locator('.viewer')
    await expect(viewer.locator('iframe')).toBeVisible()
    await expect(viewer.locator('.viewer-title strong')).toHaveText('Eins.pdf')

    await page.keyboard.press('ArrowRight')
    await expect(viewer.locator('.viewer-title strong')).toHaveText('Zwei.pdf')
    await page.keyboard.press('ArrowLeft')
    await expect(viewer.locator('.viewer-title strong')).toHaveText('Eins.pdf')

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(viewer.locator('.viewer-title strong')).toHaveText('Notiz.txt')
    await page.keyboard.press('ArrowRight')
    await expect(viewer.locator('.viewer-title strong')).toHaveText('Lebenslauf.docx')
    await expect(viewer.locator('.viewer-none')).toBeVisible() // no preview for Word files, only a download

    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)
    await expect(page.locator('.dialog.detail')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.locator('.dialog.detail')).toHaveCount(0)
  })

  test('renames a document and keeps the extension', async ({ page }) => {
    const app = await api.create({ company: 'Umbenennfirma' })
    await api.upload(app.id, pdfFile('alt.pdf'))
    await openFiles(page, 'Umbenennfirma')
    await page.getByRole('button', { name: /umbenennen/i }).click()
    const input = page.locator('.doc-name input, input.doc-name').first()
    await input.fill('Neuer Name.docx')
    await input.press('Enter')
    await expect(page.locator('.doc-open')).toHaveText('Neuer Name.docx.pdf')
    expect((await api.get(app.id)).attachments[0].name).toBe('Neuer Name.docx.pdf')

    await page.getByRole('button', { name: /umbenennen/i }).click()
    await page.locator('.doc-name input, input.doc-name').first().fill('Abgebrochen')
    await page.keyboard.press('Escape')
    await expect(page.locator('.doc-open')).toHaveText('Neuer Name.docx.pdf')
  })

  test('attaches a pasted screenshot from any tab', async ({ page }) => {
    const app = await api.create({ company: 'Pastefirma' })
    await page.goto('/')
    await openDetail(page, 'Pastefirma')
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 40
      canvas.height = 30
      canvas.getContext('2d').fillRect(0, 0, 40, 30)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const data = new DataTransfer()
      data.items.add(new File([blob], 'screenshot.png', { type: 'image/png' }))
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    })
    await expect(page.getByRole('tab', { name: /Unterlagen/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.doc-open')).toHaveText('screenshot.png')
    expect((await api.get(app.id)).attachments).toHaveLength(1)
  })

  test('attaches a file dropped on the detail dialog', async ({ page }) => {
    const app = await api.create({ company: 'Dropfirma' })
    await page.goto('/')
    await openDetail(page, 'Dropfirma')
    const data = await page.evaluateHandle((bytes) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(bytes)], 'Abgelegt.pdf', { type: 'application/pdf' }))
      return transfer
    }, [...pdfFile().buffer])
    const dialog = page.locator('section.detail, .dialog.detail').first()
    await dialog.dispatchEvent('dragenter', { dataTransfer: data })
    await expect(page.locator('.drop-note')).toBeVisible()
    await dialog.dispatchEvent('drop', { dataTransfer: data })
    await expect.poll(async () => (await api.get(app.id)).attachments.length).toBe(1)
    await expect(page.locator('.drop-note')).toHaveCount(0)
  })

  test('copies an image as an image and a pdf as its address', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const app = await api.create({ company: 'Kopierfirma' })
    const png = makePng()
    await api.upload(app.id, { name: 'bild.png', mimeType: 'image/png', buffer: png }, 'other')
    await api.upload(app.id, pdfFile('brief.pdf'))
    await openFiles(page, 'Kopierfirma')

    await page.getByRole('button', { name: /„bild.png“ kopieren/ }).click()
    await expect(page.locator('.toast')).toContainText('Bild kopiert')
    const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types))
    expect(types).toContain('image/png')

    await page.getByRole('button', { name: /„brief.pdf“ kopieren/ }).click()
    await expect(page.locator('.toast')).toContainText('Adresse')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/media\/applications\/.+\.pdf$/)
  })

  test('deletes a document', async ({ page }) => {
    const app = await api.create({ company: 'Löschfirma' })
    await api.upload(app.id, pdfFile('weg.pdf'))
    await openFiles(page, 'Löschfirma')
    await page.locator('.files li').getByRole('button', { name: /entfernen|löschen/i }).first().click()
    const confirm = page.locator('.overlay.confirm')
    if (await confirm.count()) await confirm.getByRole('button', { name: /Löschen|Entfernen/ }).click()
    await expect.poll(async () => (await api.get(app.id)).attachments.length).toBe(0)
  })
})
