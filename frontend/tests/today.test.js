import { describe, expect, it } from 'vitest'
import { WAITING_DAYS, buildToday } from '../src/today'

const NOW = '2026-03-30'
const sent = (id, company, date, extra = {}) => ({ id, company, status: 'applied', date, ...extra })

describe('buildToday', () => {
  it('is empty without data', () => {
    expect(buildToday([], [], NOW)).toEqual({ due: [], interviews: [], waiting: [] })
  })

  it('lists due follow-ups with the days since, the longest overdue first', () => {
    const result = buildToday([], [
      { id: 1, company: 'B', follow_up: '2026-03-30' },
      { id: 2, company: 'A', follow_up: '2026-03-27' },
    ], NOW)
    expect(result.due).toEqual([{ id: 2, company: 'A', days: 3 }, { id: 1, company: 'B', days: 0 }])
  })

  it('lists upcoming interviews in date order and skips past ones and other statuses', () => {
    const result = buildToday([
      { id: 1, company: 'Später', status: 'interview', interview_date: '2026-04-10' },
      { id: 2, company: 'Heute', status: 'interview', interview_date: NOW },
      { id: 3, company: 'Vorbei', status: 'interview', interview_date: '2026-03-01' },
      { id: 4, company: 'Absage', status: 'rejected', interview_date: '2026-04-01' },
    ], [], NOW)
    expect(result.interviews.map((i) => i.company)).toEqual(['Heute', 'Später'])
  })

  it('finds applications that have waited too long without answer or date', () => {
    const old = '2026-02-01'
    const result = buildToday([
      sent(1, 'Wartet', old),
      sent(2, 'Frisch', '2026-03-25'),
      sent(3, 'Antwort', old, { response_date: '2026-02-10' }),
      sent(4, 'Gespräch', old, { interview_date: '2026-04-02' }),
      sent(5, 'Schon fällig', old),
      { id: 6, company: 'Geplant', status: 'planned', date: old },
    ], [{ id: 5, company: 'Schon fällig', follow_up: '2026-03-29' }], NOW)
    expect(result.waiting.map((w) => w.company)).toEqual(['Wartet'])
    expect(result.waiting[0].days).toBe(57)
  })

  it('uses the limit of 21 days, the day itself does not count yet', () => {
    expect(WAITING_DAYS).toBe(21)
    expect(buildToday([sent(1, 'Genau', '2026-03-09')], [], NOW).waiting).toHaveLength(0)
    expect(buildToday([sent(1, 'Knapp drüber', '2026-03-08')], [], NOW).waiting).toHaveLength(1)
  })
})
