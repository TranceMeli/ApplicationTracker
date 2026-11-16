import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from '../src/draft'

beforeEach(() => localStorage.clear())

describe('draft', () => {
  it('is empty at first, saved, loaded and cleared', () => {
    expect(loadDraft()).toBeNull()
    saveDraft({ company: 'Acme' })
    expect(loadDraft()).toEqual({ company: 'Acme' })
    clearDraft()
    expect(loadDraft()).toBeNull()
  })
  it('ignores broken data', () => {
    localStorage.setItem('tracker.draft', '{kaputt')
    expect(loadDraft()).toBeNull()
    localStorage.setItem('tracker.draft', '"text"')
    expect(loadDraft()).toBeNull()
  })
})
