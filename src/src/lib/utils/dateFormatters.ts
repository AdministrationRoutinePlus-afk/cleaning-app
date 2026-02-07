import { format, parseISO, startOfDay, isSameDay, addDays } from 'date-fns'

/**
 * Format a date string to a readable format
 * @param dateString - ISO date string (YYYY-MM-DD)
 * @returns Formatted date string (e.g., "Dec 4, 2025")
 */
export function formatDate(dateString: string): string {
  try {
    const date = parseISO(dateString)
    return format(date, 'MMM d, yyyy')
  } catch (error) {
    console.error('Error formatting date:', error)
    return dateString
  }
}

/**
 * Format a time string to a readable format
 * @param timeString - Time string (HH:mm:ss or HH:mm)
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(timeString: string): string {
  try {
    // Parse time string and create a date object for today with that time
    const [hours, minutes] = timeString.split(':')
    const date = new Date()
    date.setHours(parseInt(hours, 10))
    date.setMinutes(parseInt(minutes, 10))
    return format(date, 'h:mm a')
  } catch (error) {
    console.error('Error formatting time:', error)
    return timeString
  }
}

/**
 * Format a datetime string to a readable format
 * @param datetimeString - ISO datetime string
 * @returns Formatted datetime string (e.g., "Dec 4, 2025 at 2:30 PM")
 */
/**
 * Parse a date-only string (YYYY-MM-DD) safely using parseISO.
 * Avoids timezone issues from `new Date(dateStr + 'T00:00:00')`.
 */
export function parseDateString(dateString: string): Date {
  return startOfDay(parseISO(dateString))
}

/**
 * Format a date string as a relative header (Today, Tomorrow, or full date).
 * @param dateString - Date string (YYYY-MM-DD)
 * @returns "Today", "Tomorrow", or formatted date like "Monday, January 6"
 */
export function formatDateHeader(dateString: string): string {
  try {
    const date = parseDateString(dateString)
    const today = startOfDay(new Date())
    const tomorrow = addDays(today, 1)

    if (isSameDay(date, today)) return 'Today'
    if (isSameDay(date, tomorrow)) return 'Tomorrow'

    return format(date, 'EEEE, MMMM d')
  } catch {
    return dateString
  }
}

/**
 * Format a date string for short display (e.g., "Mon, Dec 4, 2025")
 */
export function formatDateShort(dateString: string): string {
  try {
    const date = parseISO(dateString)
    return format(date, 'EEE, MMM d, yyyy')
  } catch {
    return dateString
  }
}

export function formatDateTime(datetimeString: string): string {
  try {
    const date = parseISO(datetimeString)
    return format(date, 'MMM d, yyyy \'at\' h:mm a')
  } catch (error) {
    console.error('Error formatting datetime:', error)
    return datetimeString
  }
}
