import { beforeEach, describe, expect, it, vi } from 'vitest'

// The settings are read from the browser when the module loads, so every test loads it fresh.
async function load(stored) {
  localStorage.clear()
  if (stored !== undefined) localStorage.setItem('fieldSettings', typeof stored === 'string' ? stored : JSON.stringify(stored))
  vi.resetModules()
  return import('../src/fields')
}

const sectionKeys = (f) => f.detailSections.value.flatMap((s) => s.fields.map((x) => x.key))

beforeEach(() => localStorage.clear())

describe('settings', () => {
  it('start with the defaults and survive broken storage', async () => {
    for (const stored of [undefined, '{kaputt', { table: 'x' }]) {
      const f = await load(stored)
      expect(f.settings.table).toContain('status')
      expect(f.settings.layout.map((s) => s.id)).toEqual(f.GROUPS)
      expect(f.settings.hideEmpty).toBe(true)
    }
  })

  it('always show locked fields', async () => {
    const f = await load({ table: [], form: [] })
    expect(f.visibleTableFields.value.map((x) => x.key)).toEqual(expect.arrayContaining(['company', 'status']))
    expect(f.visibleFormFields.value.map((x) => x.key)).toEqual(expect.arrayContaining(['company', 'status']))
  })

  it('switch on fields that were added in a later version once', async () => {
    const f = await load({ table: ['company', 'status'], form: ['company', 'status'] })
    expect(f.settings.table).toContain('kind')
    expect(f.settings.form).toContain('tags')
    // a field the user already knew and switched off stays off
    const g = await load({ table: ['company', 'status'], form: ['company', 'status'], seen: ['id', 'date', 'company', 'position', 'status', 'kind', 'tags'] })
    expect(g.settings.table).not.toContain('kind')
  })

  it('repair a stored layout', async () => {
    const f = await load({
      table: [],
      form: [],
      layout: [{ id: 'dates', fields: ['date', 'date', 'gibt-es-nicht'] }, { id: 'eigen', name: 'Mein', fields: ['salary'] }, null],
    })
    const dates = f.settings.layout.find((s) => s.id === 'dates')
    expect(dates.fields.filter((k) => k === 'date')).toHaveLength(1)
    expect(dates.fields).not.toContain('gibt-es-nicht')
    expect(f.settings.layout.find((s) => s.id === 'eigen').fields).toEqual(['salary'])
    for (const id of f.GROUPS) expect(f.settings.layout.some((s) => s.id === id)).toBe(true)
    const placed = f.settings.layout.flatMap((s) => s.fields)
    expect(new Set(placed).size).toBe(placed.length)
    expect(placed).toContain('email')
  })
})

describe('layout changes', () => {
  it('move sections and fields, but not past the ends', async () => {
    const f = await load()
    const first = f.settings.layout[0].id
    f.moveSection(first, -1)
    expect(f.settings.layout[0].id).toBe(first)
    f.moveSection(first, 1)
    expect(f.settings.layout[1].id).toBe(first)
    const contact = f.settings.layout.find((s) => s.id === 'contact')
    f.moveField('email', -1)
    f.moveField('email', -1)
    expect(contact.fields.indexOf('email')).toBe(0)
  })

  it('move a field into another section', async () => {
    const f = await load()
    f.moveFieldTo('email', 'notes')
    expect(f.settings.layout.find((s) => s.id === 'notes').fields).toContain('email')
    expect(f.settings.layout.find((s) => s.id === 'contact').fields).not.toContain('email')
    f.moveFieldTo('email', 'unbekannt')
    expect(f.settings.layout.find((s) => s.id === 'notes').fields).toContain('email')
  })

  it('add, rename and remove own sections but never built-in ones', async () => {
    const f = await load()
    const id = f.addSection('  Mein Bereich ')
    expect(f.settings.layout.at(-1)).toMatchObject({ id, name: 'Mein Bereich' })
    f.renameSection(id, 'Neu')
    expect(f.settings.layout.at(-1).name).toBe('Neu')
    f.renameSection('contact', 'Hack')
    expect(f.settings.layout.find((s) => s.id === 'contact').name).toBeUndefined()
    f.moveFieldTo('salary', id)
    f.removeSection(id)
    expect(f.settings.layout.some((s) => s.id === id)).toBe(false)
    expect(f.settings.layout.find((s) => s.id === 'terms').fields).toContain('salary')
    const count = f.settings.layout.length
    f.removeSection('contact')
    expect(f.settings.layout).toHaveLength(count)
  })

  it('only list switched-on fields in the detail sections and can be reset', async () => {
    const f = await load()
    f.settings.form = f.settings.form.filter((k) => k !== 'phone')
    expect(sectionKeys(f)).not.toContain('phone')
    f.resetSettings()
    expect(sectionKeys(f)).toContain('phone')
  })
})
