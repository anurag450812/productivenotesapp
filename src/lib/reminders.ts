import { addDays, addMonths, differenceInCalendarDays, format, getDay, getDate, nextDay, setDate } from 'date-fns'
import type { Reminder, RepeatType } from './types'

export function nextDueDate(r: Reminder, from: Date = new Date()): Date {
  const due = new Date(r.due_at)
  if (r.repeat_type === 'none') return due

  // Walk forward until we find the next occurrence strictly after `from`
  let next = new Date(due)
  let guard = 0
  while (next.getTime() <= from.getTime() && guard < 600) {
    next = advanceOne(next, r.repeat_type, r.repeat_dow, r.repeat_dom)
    guard++
  }
  // If due is still in the future, return it
  if (next.getTime() <= from.getTime()) {
    next = advanceOne(next, r.repeat_type, r.repeat_dow, r.repeat_dom)
  }
  return next
}

function advanceOne(d: Date, type: RepeatType, dow: number | null, dom: number | null): Date {
  switch (type) {
    case 'weekly':
      return nextDay(d, (dow ?? getDay(d)) as Day)
    case 'monthly':
      return addMonths(d, 1)
    case 'monthly_day_after': {
      // "monthly day after" = day after the given day-of-month
      const target = dom ?? getDate(d)
      const base = setDate(d, Math.min(target, 28))
      return addDays(addMonths(base, 1), 1)
    }
    default:
      return d
  }
}

type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

// Sort reminders by upcoming due date (soonest first), recurring ones projected forward.
export function sortRemindersByUpcoming(reminders: Reminder[]): Reminder[] {
  const now = new Date()
  return [...reminders].sort((a, b) => {
    const da = nextDueDate(a, now).getTime()
    const db = nextDueDate(b, now).getTime()
    return da - db
  })
}

export function relativeLabel(r: Reminder): string {
  const due = nextDueDate(r, new Date())
  const days = differenceInCalendarDays(due, new Date())
  const time = format(due, 'h:mm a')
  let dayLabel: string
  if (days < 0) dayLabel = 'Overdue'
  else if (days === 0) dayLabel = 'Today'
  else if (days === 1) dayLabel = 'Tomorrow'
  else if (days < 7) dayLabel = format(due, 'EEEE')
  else dayLabel = format(due, 'd MMM')
  return `${dayLabel} · ${time}`
}

export function repeatLabel(r: Reminder): string {
  switch (r.repeat_type) {
    case 'weekly':
      return `Repeats weekly · ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.repeat_dow ?? 0]}`
    case 'monthly':
      return `Repeats monthly · day ${r.repeat_dom ?? '—'}`
    case 'monthly_day_after':
      return `Repeats monthly · day after ${r.repeat_dom ?? '—'}`
    default:
      return 'One-time'
  }
}

export const DOW_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
