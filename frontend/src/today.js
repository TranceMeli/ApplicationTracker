import { daysBetween, today } from './constants'

// After this many days without an answer (and without a date to look forward to) an application is "waiting".
export const WAITING_DAYS = 21

// What needs attention today. items: the applications, due: the follow ups that are due (from the statistics).
// Returns { due, interviews, waiting }, each a list sorted by what is most urgent.
export function buildToday(items = [], due = [], now = today()) {
  const dueIds = new Set(due.map((d) => d.id))

  const dueList = [...due]
    .map((d) => ({ id: d.id, company: d.company, days: Math.max(0, daysBetween(d.follow_up, now)) }))
    .sort((a, b) => b.days - a.days || a.company.localeCompare(b.company))

  const interviews = items
    .filter((i) => i.interview_date && i.interview_date >= now && ['applied', 'interview'].includes(i.status))
    .map((i) => ({ id: i.id, company: i.company, date: i.interview_date }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company))

  // Sent a long time ago, no answer, no interview and not already listed as a due follow up.
  const waiting = items
    .filter(
      (i) =>
        i.status === 'applied' && i.date && !i.response_date && !i.interview_date && !dueIds.has(i.id) && daysBetween(i.date, now) > WAITING_DAYS,
    )
    .map((i) => ({ id: i.id, company: i.company, days: daysBetween(i.date, now) }))
    .sort((a, b) => b.days - a.days || a.company.localeCompare(b.company))

  return { due: dueList, interviews, waiting }
}
