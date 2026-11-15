import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '../src/i18n'
import { daysBetween, fmt, isDue, today } from '../src/constants'

beforeEach(() => {
  setLocale('de')
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0))
})
afterEach(() => vi.useRealTimers())

describe('dates', () => {
  it('today is the local date', () => expect(today()).toBe('2026-03-15'))

  it('counts days, also across the change to summer time', () => {
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-03-15', '2026-03-01')).toBe(-14)
  })

  it('formats in the language of the app', () => {
    expect(fmt('2026-03-05')).toBe('5.3.2026')
    setLocale('en')
    expect(fmt('2026-03-05')).toBe('05/03/2026')
    expect(fmt('')).toBe('–')
    expect(fmt(null)).toBe('–')
  })

  it('is due only while applied and when the date has come', () => {
    expect(isDue({ status: 'applied', follow_up: '2026-03-15' })).toBe(true)
    expect(isDue({ status: 'applied', follow_up: '2026-03-16' })).toBe(false)
    expect(isDue({ status: 'rejected', follow_up: '2026-03-01' })).toBe(false)
    expect(isDue({ status: 'applied', follow_up: '' })).toBe(false)
  })
})
