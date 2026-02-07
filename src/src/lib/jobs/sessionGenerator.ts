import { addDays, format, parseISO } from 'date-fns'
import { SupabaseClient } from '@supabase/supabase-js'

export interface SessionGeneratorInput {
  is_recurring: boolean
  window_start_day: string
  window_end_day: string
  time_window_start: string
  time_window_end: string
  start_date: string
  end_date: string
  specific_dates: string[]
  exclude_dates: string[]
}

export interface SessionRecord {
  job_template_id: string
  session_code: string
  full_job_code: string
  scheduled_date: string
  scheduled_end_date: string | null
  scheduled_time: string | null
  status: string
  assigned_to?: string
}

const DAY_MAP: Record<string, number> = {
  'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6
}

/**
 * Pure function that generates session records based on window-based scheduling.
 * Does NOT insert into database — just returns the records.
 *
 * @param jobTemplateId - The job template UUID
 * @param jobCode - The job code (e.g., ABC-01A)
 * @param input - Scheduling parameters
 * @param startingSessionNumber - Start numbering from this number (default 1). Used to avoid
 *   code collisions when regenerating sessions for an active job.
 */
export function generateSessionRecords(
  jobTemplateId: string,
  jobCode: string,
  input: SessionGeneratorInput,
  startingSessionNumber: number = 1,
  preferredEmployeeId?: string
): SessionRecord[] {
  const sessions: SessionRecord[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let sessionCounter = startingSessionNumber

  const generateSessionCode = () => {
    const code = `A${String(sessionCounter).padStart(3, '0')}`
    sessionCounter++
    return code
  }

  const excludeDates = new Set(input.exclude_dates)

  // Calculate how many days the window spans
  const startDayNum = DAY_MAP[input.window_start_day] ?? 0
  const endDayNum = DAY_MAP[input.window_end_day] ?? startDayNum
  let windowDays = endDayNum - startDayNum
  if (windowDays < 0) windowDays += 7
  if (windowDays === 0 && input.window_start_day !== input.window_end_day) windowDays = 7

  if (input.is_recurring) {
    const startDate = input.start_date ? parseISO(input.start_date) : today
    const endDate = input.end_date ? parseISO(input.end_date) : addDays(today, 30)

    // Find the first occurrence of window_start_day on or after startDate
    let currentDate = new Date(startDate)
    const targetDayNum = DAY_MAP[input.window_start_day]

    while (currentDate.getDay() !== targetDayNum) {
      currentDate = addDays(currentDate, 1)
    }

    // Create sessions week by week
    while (currentDate <= endDate) {
      const windowStart = new Date(currentDate)
      const windowEnd = addDays(windowStart, windowDays)
      const dateStr = format(windowStart, 'yyyy-MM-dd')

      if (!excludeDates.has(dateStr)) {
        const sessionCode = generateSessionCode()
        sessions.push({
          job_template_id: jobTemplateId,
          session_code: sessionCode,
          full_job_code: `${jobCode}-${sessionCode}`,
          scheduled_date: dateStr,
          scheduled_end_date: windowDays > 0 ? format(windowEnd, 'yyyy-MM-dd') : null,
          scheduled_time: input.time_window_start || null,
          status: preferredEmployeeId ? 'APPROVED' : 'OFFERED',
          ...(preferredEmployeeId ? { assigned_to: preferredEmployeeId } : {}),
        })
      }

      currentDate = addDays(currentDate, 7)
    }
  } else {
    // One-time: Create sessions for specific dates
    const datesToCreate = input.specific_dates.filter(d => !excludeDates.has(d)).sort()

    for (const dateStr of datesToCreate) {
      const windowStart = parseISO(dateStr)
      const windowEnd = addDays(windowStart, windowDays)

      const sessionCode = generateSessionCode()
      sessions.push({
        job_template_id: jobTemplateId,
        session_code: sessionCode,
        full_job_code: `${jobCode}-${sessionCode}`,
        scheduled_date: dateStr,
        scheduled_end_date: windowDays > 0 ? format(windowEnd, 'yyyy-MM-dd') : null,
        scheduled_time: input.time_window_start || null,
        status: preferredEmployeeId ? 'APPROVED' : 'OFFERED',
        ...(preferredEmployeeId ? { assigned_to: preferredEmployeeId } : {}),
      })
    }
  }

  return sessions
}

/**
 * Generates session records and inserts them into the database.
 *
 * @param supabase - Supabase client instance
 * @param jobTemplateId - The job template UUID
 * @param jobCode - The job code (e.g., ABC-01A)
 * @param input - Scheduling parameters
 * @param startingSessionNumber - Start numbering from this number (default 1)
 * @returns The number of sessions created, or -1 on error
 */
export async function createJobSessions(
  supabase: SupabaseClient,
  jobTemplateId: string,
  jobCode: string,
  input: SessionGeneratorInput,
  startingSessionNumber: number = 1,
  preferredEmployeeId?: string
): Promise<number> {
  try {
    const sessions = generateSessionRecords(jobTemplateId, jobCode, input, startingSessionNumber, preferredEmployeeId)

    if (sessions.length > 0) {
      const { error } = await supabase
        .from('job_sessions')
        .insert(sessions)

      if (error) {
        console.error('Error creating job sessions:', error)
        return -1
      }
    }

    return sessions.length
  } catch (error) {
    console.error('Error in createJobSessions:', error)
    return -1
  }
}

/**
 * Gets the next session number for a job template by querying existing sessions.
 * Used to avoid session code collisions when regenerating.
 */
export async function getNextSessionNumber(
  supabase: SupabaseClient,
  jobTemplateId: string
): Promise<number> {
  const { data: existingSessions } = await supabase
    .from('job_sessions')
    .select('session_code')
    .eq('job_template_id', jobTemplateId)
    .order('session_code', { ascending: false })
    .limit(1)

  if (existingSessions && existingSessions.length > 0) {
    const lastCode = existingSessions[0].session_code
    const numPart = parseInt(lastCode.substring(1))
    return numPart + 1
  }

  return 1
}
