import { beforeEach, describe, expect, it } from 'vitest'
import source from '../src/i18n.js?raw'
import { LOCALES, locale, setLocale, t } from '../src/i18n'

beforeEach(() => setLocale('de'))

describe('t', () => {
  it('replaces parameters and falls back to the key', () => {
    expect(t('stats.title')).toBe('Statistik')
    expect(t('does.not.exist')).toBe('does.not.exist')
    expect(t('attachment.copyFile', { name: 'cv.pdf' })).toContain('cv.pdf')
  })

  it('switches the language, the page language and remembers it', () => {
    setLocale('en')
    expect(locale.value).toBe('en')
    expect(t('stats.title')).toBe('Statistics')
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('locale')).toBe('en')
  })
})

describe('translations', () => {
  it('have the same keys in every language', () => {
    // A missing English key would silently fall back to German, so the catalogue is compared in the source.
    const keys = LOCALES.map((l) => {
      const start = source.indexOf(`  ${l}: {`)
      const block = source.slice(start).split('\n  },')[0]
      return new Set([...block.matchAll(/^\s+'([\w.]+)':/gm)].map((m) => m[1]))
    })
    const [de, en] = keys
    expect(de.size).toBeGreaterThan(100)
    expect([...de].filter((k) => !en.has(k))).toEqual([])
    expect([...en].filter((k) => !de.has(k))).toEqual([])
  })
})
