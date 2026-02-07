import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Cleanup stale job sessions whose scheduled date has passed but status was never updated.
 *
 * - OFFERED / CLAIMED / APPROVED past their end date → MISSED
 * - IN_PROGRESS past their end date → OVERDUE
 *
 * Runs once per page load. Safe to call multiple times (idempotent).
 */
export async function cleanupStaleSessions(supabase: SupabaseClient): Promise<number> {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  try {
    // Fetch all sessions that might be stale
    const { data: staleCandidates, error } = await supabase
      .from('job_sessions')
      .select('id, status, scheduled_date, scheduled_end_date')
      .in('status', ['OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS'])

    if (error || !staleCandidates) return 0

    // Filter to only truly stale sessions (end date or scheduled date is before today)
    const stale = staleCandidates.filter(s => {
      const effectiveEndDate = s.scheduled_end_date || s.scheduled_date
      if (!effectiveEndDate) return false
      return effectiveEndDate < today
    })

    if (stale.length === 0) return 0

    const missedIds = stale
      .filter(s => s.status !== 'IN_PROGRESS')
      .map(s => s.id)

    const overdueIds = stale
      .filter(s => s.status === 'IN_PROGRESS')
      .map(s => s.id)

    const now = new Date().toISOString()

    if (missedIds.length > 0) {
      await supabase
        .from('job_sessions')
        .update({ status: 'MISSED', updated_at: now })
        .in('id', missedIds)
    }

    if (overdueIds.length > 0) {
      await supabase
        .from('job_sessions')
        .update({ status: 'OVERDUE', updated_at: now })
        .in('id', overdueIds)
    }

    return missedIds.length + overdueIds.length
  } catch (err) {
    console.error('Failed to cleanup stale sessions:', err)
    return 0
  }
}
