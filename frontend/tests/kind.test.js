import { beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from '../src/i18n'
import { comboLabel, isBuiltin, kindClass, kindIndex, kindLabel, kindName, knownKinds } from '../src/kind'

beforeEach(() => setLocale('de'))

describe('kind names', () => {
  it('translates the built-in types and shows others as typed', () => {
    expect(kindName('posting')).toBe('Stelle')
    expect(kindName('initiative')).toBe('Initiativ')
    expect(kindName('agency')).toBe('Vermittler')
    expect(kindName('Werkstudent')).toBe('Werkstudent')
    expect(kindName('')).toBe('')
    expect(kindName(null)).toBe('')
  })

  it('follows the language', () => {
    setLocale('en')
    expect(kindName('agency')).toBe('Agency')
    expect(kindLabel({ kind: 'initiative' })).toBe('Unsolicited')
  })

  it('knows the built-in types', () => {
    expect(isBuiltin('agency')).toBe(true)
    expect(isBuiltin('Recruiter')).toBe(false)
  })

  it('combines status and type', () => {
    expect(comboLabel('planned', 'initiative')).toBe('Geplant - Initiativ')
  })
})

describe('kind colours', () => {
  it('gives the built-in types fixed colours', () => {
    expect([kindIndex('posting'), kindIndex('initiative'), kindIndex('agency')]).toEqual([0, 1, 2])
  })

  it('keeps other types in the remaining colours and independent of the case', () => {
    for (const name of ['Praktikum', 'Werkstudent', 'Messe', 'x', '']) {
      expect(kindIndex(name)).toBeGreaterThanOrEqual(3)
      expect(kindIndex(name)).toBeLessThanOrEqual(5)
    }
    expect(kindIndex('Praktikum')).toBe(kindIndex('praktikum'))
  })

  it('returns no class for an empty type', () => {
    expect(kindClass('')).toBe('')
    expect(kindClass('agency')).toBe('kt-2')
  })
})

describe('knownKinds', () => {
  it('lists the built-in types first, even when unused', () => {
    expect(knownKinds().map((k) => [k.key, k.n])).toEqual([['posting', 0], ['initiative', 0], ['agency', 0]])
  })

  it('counts, merges custom types by case and sorts them', () => {
    const result = knownKinds({ posting: 4, Messe: 1, messe: 2, Praktikum: 3, '': 9 })
    expect(result.map((k) => [k.key, k.n])).toEqual([
      ['posting', 4], ['initiative', 0], ['agency', 0], ['Messe', 3], ['Praktikum', 3],
    ])
  })
})
