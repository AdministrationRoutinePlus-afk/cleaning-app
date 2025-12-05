import { format, parseISO } from 'date-fns'

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
export function formatDateTime(datetimeString: string): string {
  try {
    const date = parseISO(datetimeString)
    return format(date, 'MMM d, yyyy \'at\' h:mm a')
  } catch (error) {
    console.error('Error formatting datetime:', error)
    return datetimeString
  }
}
