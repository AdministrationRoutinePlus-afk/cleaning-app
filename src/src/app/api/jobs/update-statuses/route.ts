import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This endpoint updates job statuses based on time windows
// - APPROVED jobs past their time window -> MISSED
// - IN_PROGRESS jobs past their time window -> OVERDUE

export async function POST(request: Request) {
  try {
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date().toISOString()
    let missedCount = 0
    let overdueCount = 0

    // Get all APPROVED jobs with time windows
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

    // Check each APPROVED job
    for (const job of approvedJobs || []) {
      // Supabase returns joined tables, handle both single object and array cases
      const jobTemplateRaw = job.job_template as unknown
      const jobTemplate = Array.isArray(jobTemplateRaw) ? jobTemplateRaw[0] : jobTemplateRaw
      const timeWindowEnd = (jobTemplate as { time_window_end: string | null } | null)?.time_window_end
      if (!timeWindowEnd) continue

      const endDate = job.scheduled_end_date || job.scheduled_date
      const [endH, endM] = timeWindowEnd.split(':').map(Number)

      const windowEnd = new Date(endDate)
      windowEnd.setHours(endH, endM, 0, 0)

      if (new Date() > windowEnd) {
        // Update to MISSED
        const { error: updateError } = await supabase
          .from('job_sessions')
          .update({ status: 'MISSED', updated_at: now })
          .eq('id', job.id)

        if (!updateError) missedCount++
      }
    }

    // Get all IN_PROGRESS jobs with time windows
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

    // Check each IN_PROGRESS job
    for (const job of inProgressJobs || []) {
      // Supabase returns joined tables, handle both single object and array cases
      const jobTemplateRaw = job.job_template as unknown
      const jobTemplate = Array.isArray(jobTemplateRaw) ? jobTemplateRaw[0] : jobTemplateRaw
      const timeWindowEnd = (jobTemplate as { time_window_end: string | null } | null)?.time_window_end
      if (!timeWindowEnd) continue

      const endDate = job.scheduled_end_date || job.scheduled_date
      const [endH, endM] = timeWindowEnd.split(':').map(Number)

      const windowEnd = new Date(endDate)
      windowEnd.setHours(endH, endM, 0, 0)

      if (new Date() > windowEnd) {
        // Update to OVERDUE
        const { error: updateError } = await supabase
          .from('job_sessions')
          .update({ status: 'OVERDUE', updated_at: now })
          .eq('id', job.id)

        if (!updateError) overdueCount++
      }
    }

    return NextResponse.json({
      success: true,
      updated: {
        missed: missedCount,
        overdue: overdueCount
      },
      message: `Updated ${missedCount} jobs to MISSED, ${overdueCount} jobs to OVERDUE`
    })

  } catch (error) {
    console.error('Error updating job statuses:', error)
    return NextResponse.json(
      { error: 'Failed to update job statuses', details: String(error) },
      { status: 500 }
    )
  }
}

// Also support GET for easy testing/cron jobs
export async function GET(request: Request) {
  return POST(request)
}
