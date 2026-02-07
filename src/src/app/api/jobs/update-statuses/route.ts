import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This endpoint updates job session statuses based on time windows and deadlines.
//
// Checks performed:
//   1. APPROVED sessions past their deadline -> MISSED
//   2. IN_PROGRESS sessions past their deadline -> OVERDUE
//   3. OFFERED sessions past their deadline -> CANCELLED
//   4. CLAIMED sessions idle for 48+ hours -> reverted to OFFERED (back to marketplace)
//
// TIMEZONE LIMITATION: All date/time calculations assume a single timezone
// (the server's local timezone). This will produce incorrect results for
// jobs spanning multiple timezones. A per-job or per-employer timezone
// field would be needed for multi-timezone support.

/**
 * Computes the deadline for a job session.
 * If time_window_end is set, uses that time on the end date.
 * Otherwise, falls back to 23:59:59 on the end date (end of day).
 */
function computeDeadline(
  scheduledDate: string,
  scheduledEndDate: string | null,
  timeWindowEnd: string | null
): Date {
  const endDate = scheduledEndDate || scheduledDate
  const deadline = new Date(endDate)

  if (timeWindowEnd) {
    const [endH, endM] = timeWindowEnd.split(':').map(Number)
    deadline.setHours(endH, endM, 0, 0)
  } else {
    // No time_window_end configured — use end of day as the deadline
    deadline.setHours(23, 59, 59, 0)
  }

  return deadline
}

/**
 * Extracts time_window_end from the joined job_template relation.
 * Supabase may return the join as a single object or an array.
 */
function getTimeWindowEnd(
  jobTemplate: unknown
): string | null {
  const resolved = Array.isArray(jobTemplate) ? jobTemplate[0] : jobTemplate
  return (resolved as { time_window_end: string | null } | null)?.time_window_end ?? null
}

export async function POST(request: Request) {
  try {
    // API key check: require CRON_SECRET if configured
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const now = new Date()
    const nowISO = now.toISOString()

    let missedCount = 0
    let overdueCount = 0
    let cancelledCount = 0
    let reopenedCount = 0

    // ---------------------------------------------------------------
    // 1. APPROVED sessions past their deadline -> MISSED
    // ---------------------------------------------------------------
    const { data: approvedJobs, error: approvedError } = await supabase
      .from('job_sessions')
      .select(`
        id,
        scheduled_date,
        scheduled_end_date,
        status,
        job_template:job_templates(
          time_window_end
        )
      `)
      .eq('status', 'APPROVED')
      .not('scheduled_date', 'is', null)

    if (approvedError) throw approvedError

    for (const job of approvedJobs || []) {
      const timeWindowEnd = getTimeWindowEnd(job.job_template)
      const deadline = computeDeadline(job.scheduled_date, job.scheduled_end_date, timeWindowEnd)

      if (now > deadline) {
        const { error: updateError } = await supabase
          .from('job_sessions')
          .update({ status: 'MISSED', updated_at: nowISO })
          .eq('id', job.id)

        if (!updateError) missedCount++
      }
    }

    // ---------------------------------------------------------------
    // 2. IN_PROGRESS sessions past their deadline -> OVERDUE
    // ---------------------------------------------------------------
    const { data: inProgressJobs, error: inProgressError } = await supabase
      .from('job_sessions')
      .select(`
        id,
        scheduled_date,
        scheduled_end_date,
        status,
        job_template:job_templates(
          time_window_end
        )
      `)
      .eq('status', 'IN_PROGRESS')
      .not('scheduled_date', 'is', null)

    if (inProgressError) throw inProgressError

    for (const job of inProgressJobs || []) {
      const timeWindowEnd = getTimeWindowEnd(job.job_template)
      const deadline = computeDeadline(job.scheduled_date, job.scheduled_end_date, timeWindowEnd)

      if (now > deadline) {
        const { error: updateError } = await supabase
          .from('job_sessions')
          .update({ status: 'OVERDUE', updated_at: nowISO })
          .eq('id', job.id)

        if (!updateError) overdueCount++
      }
    }

    // ---------------------------------------------------------------
    // 3. OFFERED sessions past their deadline -> CANCELLED
    //    These are sessions that were never claimed by any worker.
    // ---------------------------------------------------------------
    const { data: offeredJobs, error: offeredError } = await supabase
      .from('job_sessions')
      .select(`
        id,
        scheduled_date,
        scheduled_end_date,
        status,
        job_template:job_templates(
          time_window_end
        )
      `)
      .eq('status', 'OFFERED')
      .not('scheduled_date', 'is', null)

    if (offeredError) throw offeredError

    for (const job of offeredJobs || []) {
      const timeWindowEnd = getTimeWindowEnd(job.job_template)
      const deadline = computeDeadline(job.scheduled_date, job.scheduled_end_date, timeWindowEnd)

      if (now > deadline) {
        const { error: updateError } = await supabase
          .from('job_sessions')
          .update({ status: 'CANCELLED', updated_at: nowISO })
          .eq('id', job.id)

        if (!updateError) cancelledCount++
      }
    }

    // ---------------------------------------------------------------
    // 4. CLAIMED sessions idle for 48+ hours -> revert to OFFERED
    //    Workers claim jobs, but employers must approve. If a session
    //    stays CLAIMED for over 48 hours without approval, it is
    //    returned to the marketplace so other workers can claim it.
    // ---------------------------------------------------------------
    const claimedCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

    const { data: staleClaimed, error: claimedError } = await supabase
      .from('job_sessions')
      .select('id')
      .eq('status', 'CLAIMED')
      .lt('updated_at', claimedCutoff)

    if (claimedError) throw claimedError

    for (const job of staleClaimed || []) {
      const { error: updateError } = await supabase
        .from('job_sessions')
        .update({
          status: 'OFFERED',
          assigned_to: null,
          updated_at: nowISO,
        })
        .eq('id', job.id)

      if (!updateError) reopenedCount++
    }

    // ---------------------------------------------------------------
    // Response
    // ---------------------------------------------------------------
    return NextResponse.json({
      success: true,
      updated: {
        missed: missedCount,
        overdue: overdueCount,
        cancelled: cancelledCount,
        reopened: reopenedCount,
      },
      message: [
        `${missedCount} APPROVED -> MISSED`,
        `${overdueCount} IN_PROGRESS -> OVERDUE`,
        `${cancelledCount} OFFERED -> CANCELLED`,
        `${reopenedCount} CLAIMED -> OFFERED (48h expired)`,
      ].join(', '),
    })
  } catch (error) {
    console.error('Error updating job statuses:', error)
    return NextResponse.json(
      { error: 'Failed to update job statuses', details: String(error) },
      { status: 500 }
    )
  }
}

// Also support GET for cron jobs
export async function GET(request: Request) {
  return POST(request)
}
