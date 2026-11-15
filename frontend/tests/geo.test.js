import { beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from '../src/i18n'
import { distanceKm, distanceLabel, hasCoords, home, loadView, saveView, setHome } from '../src/geo'

beforeEach(() => {
  setLocale('de')
  localStorage.clear()
  setHome(null)
})

describe('distance', () => {
  const berlin = { latitude: 52.52, longitude: 13.405 }
  const hamburg = { latitude: 53.5511, longitude: 9.9937 }

  it('is the straight line in kilometres', () => {
    expect(distanceKm(berlin, hamburg)).toBeGreaterThan(250)
    expect(distanceKm(berlin, hamburg)).toBeLessThan(260)
    expect(distanceKm(berlin, berlin)).toBe(0)
  })

  it('needs a home and coordinates for the label', () => {
    expect(distanceLabel({ ...hamburg })).toBe('')
    setHome(berlin)
    expect(distanceLabel({ company: 'x' })).toBe('')
    expect(distanceLabel({ ...hamburg, geo_precision: 'address' })).toContain('255')
    expect(distanceLabel({ ...hamburg, geo_precision: 'city' })).toContain('ca.')
  })

  it('detects coordinates, also at 0', () => {
    expect(hasCoords({ latitude: 0, longitude: 0 })).toBe(true)
    expect(hasCoords({ latitude: null, longitude: 1 })).toBe(false)
  })
})

describe('stored settings', () => {
  it('keeps the home address in the browser and removes it again', () => {
    setHome({ city: 'Berlin' })
    expect(home.value.city).toBe('Berlin')
    expect(JSON.parse(localStorage.getItem('tracker.home')).city).toBe('Berlin')
    setHome(null)
    expect(localStorage.getItem('tracker.home')).toBeNull()
  })

  it('falls back to the list for an unknown view', () => {
    expect(loadView()).toBe('list')
    saveView('board')
    expect(loadView()).toBe('board')
    localStorage.setItem('tracker.view', '"kaputt"')
    expect(loadView()).toBe('list')
    localStorage.setItem('tracker.view', '{nicht json')
    expect(loadView()).toBe('list')
  })
})
