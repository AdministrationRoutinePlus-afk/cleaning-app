import {
  formatDate,
  formatTime,
  formatDateTime,
  formatDateHeader,
  formatDateShort,
  parseDateString,
} from '../dateFormatters'
import { format, addDays, startOfDay } from 'date-fns'

describe('formatDate', () => {
  it('formats a standard ISO date string', () => {
    expect(formatDate('2025-12-04')).toBe('Dec 4, 2025')
  })

  it('formats January correctly', () => {
    expect(formatDate('2025-01-15')).toBe('Jan 15, 2025')
  })

  it('formats a leap year date', () => {
    expect(formatDate('2024-02-29')).toBe('Feb 29, 2024')
  })

  it('returns original string on invalid input', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('formats year boundaries', () => {
    expect(formatDate('2025-12-31')).toBe('Dec 31, 2025')
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026')
  })
})

describe('formatTime', () => {
  it('formats morning time with HH:mm:ss', () => {
    expect(formatTime('09:30:00')).toBe('9:30 AM')
  })

  it('formats afternoon time', () => {
    expect(formatTime('14:00:00')).toBe('2:00 PM')
  })

  it('formats midnight', () => {
    expect(formatTime('00:00:00')).toBe('12:00 AM')
  })

  it('formats noon', () => {
    expect(formatTime('12:00:00')).toBe('12:00 PM')
  })

  it('formats HH:mm format (no seconds)', () => {
    expect(formatTime('08:15')).toBe('8:15 AM')
  })

  it('formats late evening time', () => {
    expect(formatTime('23:59:00')).toBe('11:59 PM')
  })

  it('returns original string on invalid input', () => {
    expect(formatTime('not-a-time')).toBe('not-a-time')
  })
})

describe('formatDateTime', () => {
  it('formats a full ISO datetime string', () => {
    expect(formatDateTime('2025-12-04T14:30:00')).toBe('Dec 4, 2025 at 2:30 PM')
  })

  it('formats midnight datetime', () => {
    expect(formatDateTime('2025-06-15T00:00:00')).toBe('Jun 15, 2025 at 12:00 AM')
  })

  it('returns original string on invalid input', () => {
    expect(formatDateTime('bad-datetime')).toBe('bad-datetime')
  })
})

describe('parseDateString', () => {
  it('returns start of day for a date string', () => {
    const result = parseDateString('2025-06-15')
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(5) // June is 5 (0-indexed)
    expect(result.getDate()).toBe(15)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
  })

  it('handles year boundaries', () => {
    const result = parseDateString('2026-01-01')
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(1)
  })
})

describe('formatDateHeader', () => {
  it('returns "Today" for today\'s date', () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    expect(formatDateHeader(todayStr)).toBe('Today')
  })

  it('returns "Tomorrow" for tomorrow\'s date', () => {
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    expect(formatDateHeader(tomorrowStr)).toBe('Tomorrow')
  })

  it('returns formatted date for a date further in the future', () => {
    // Use a date far enough in the future to not be today or tomorrow
    const futureDate = addDays(new Date(), 10)
    const futureDateStr = format(futureDate, 'yyyy-MM-dd')
    const expected = format(startOfDay(futureDate), 'EEEE, MMMM d')
    expect(formatDateHeader(futureDateStr)).toBe(expected)
  })

  it('returns formatted date for a past date', () => {
    // A date in the past should show as a full date, not Today/Tomorrow
    const result = formatDateHeader('2020-03-15')
    expect(result).toBe('Sunday, March 15')
  })

  it('returns original string on invalid input', () => {
    expect(formatDateHeader('not-a-date')).toBe('not-a-date')
  })
})

describe('formatDateShort', () => {
  it('formats date with day abbreviation', () => {
    expect(formatDateShort('2025-12-04')).toBe('Thu, Dec 4, 2025')
  })

  it('formats a Monday', () => {
    expect(formatDateShort('2025-01-06')).toBe('Mon, Jan 6, 2025')
  })

  it('returns original string on invalid input', () => {
    expect(formatDateShort('not-a-date')).toBe('not-a-date')
  })

  it('formats a weekend date', () => {
    expect(formatDateShort('2025-06-14')).toBe('Sat, Jun 14, 2025')
  })
})
