'use client'

import { useState } from 'react'
import type { JobTemplate } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { duplicateJob } from '@/lib/jobs/duplicateJob'
import { QuickPublishDialog } from '@/components/employer/jobs/QuickPublishDialog'
import { BulkSchedulerDialog } from '@/components/employer/jobs/BulkSchedulerDialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Edit2, Copy, Trash2, Play, Pause, Send, CalendarPlus } from 'lucide-react'

interface JobCardProps {
  job: JobTemplate
  customerName?: string | null
  onUpdate: () => void
  sessionCounts?: { unclaimed: number; total: number }
}

export function JobCard({ job, customerName, onUpdate, sessionCounts }: JobCardProps) {
  const [loading, setLoading] = useState(false)
  const [quickPublishOpen, setQuickPublishOpen] = useState(false)
  const [bulkSchedulerOpen, setBulkSchedulerOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleActivate = async () => {
    const isDeactivating = job.status === 'ACTIVE'

    if (isDeactivating) {
      // Check for active sessions (CLAIMED, APPROVED, IN_PROGRESS) that won't be cancelled
      const { data: activeSessions, error: activeErr } = await supabase
        .from('job_sessions')
        .select('id', { count: 'exact' })
        .eq('job_template_id', job.id)
        .in('status', ['CLAIMED', 'APPROVED', 'IN_PROGRESS'])

      if (activeErr) {
        console.error('Error checking active sessions:', activeErr)
        toast.error('Failed to check active sessions')
        return
      }

      const activeCount = activeSessions?.length ?? 0
      let confirmMsg = 'Are you sure you want to deactivate this job template? All OFFERED sessions will be cancelled.'
      if (activeCount > 0) {
        confirmMsg += `\n\n${activeCount} session${activeCount !== 1 ? 's are' : ' is'} still active (CLAIMED/APPROVED/IN_PROGRESS) and will not be cancelled.`
      }

      if (!confirm(confirmMsg)) return
    }

    setLoading(true)
    try {
      if (isDeactivating) {
        // Cancel all OFFERED sessions for this template
        const { error: cancelErr } = await supabase
          .from('job_sessions')
          .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
          .eq('job_template_id', job.id)
          .eq('status', 'OFFERED')

        if (cancelErr) throw cancelErr
      }

      const newStatus = isDeactivating ? 'DRAFT' : 'ACTIVE'
      const { error } = await supabase
        .from('job_templates')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', job.id)

      if (error) throw error

      if (isDeactivating) {
        toast.success('Job deactivated. OFFERED sessions have been cancelled.')
      }
      onUpdate()
    } catch (error) {
      console.error('Error updating job status:', error)
      toast.error('Failed to update job status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job template? All non-completed sessions will be cancelled.')) return

    setLoading(true)
    try {
      // Cancel all non-completed sessions (OFFERED, CLAIMED, APPROVED)
      const { error: cancelErr } = await supabase
        .from('job_sessions')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('job_template_id', job.id)
        .in('status', ['OFFERED', 'CLAIMED', 'APPROVED'])

      if (cancelErr) throw cancelErr

      const { error } = await supabase
        .from('job_templates')
        .delete()
        .eq('id', job.id)

      if (error) throw error
      toast.success('Job template deleted.')
      onUpdate()
    } catch (error) {
      console.error('Error deleting job:', error)
      toast.error('Failed to delete job. Make sure there are no active sessions.')
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async () => {
    setLoading(true)
    try {
      const newId = await duplicateJob(supabase, job.id)
      if (!newId) {
        toast.error('Failed to duplicate job')
        return
      }
      toast.success('Job duplicated (including steps, checklist, and images)')
      onUpdate()
    } catch (error) {
      console.error('Error duplicating job:', error)
      toast.error('Failed to duplicate job')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    router.push(`/employer/jobs/${job.id}/edit`)
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Not set'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  const getStatusBadge = () => {
    if (job.status === 'ACTIVE') {
      return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">ACTIVE</Badge>
    }
    return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">DRAFT</Badge>
  }

  return (
    <>
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-white/20 overflow-hidden">
        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="inline-block bg-gray-800/80 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg border border-white/30 font-mono">
                {job.job_code}
              </span>
              {getStatusBadge()}
            </div>
            {customerName && (
              <span className="text-sm text-gray-400 truncate">{customerName}</span>
            )}
          </div>
          <h3 className="text-xl font-bold text-white leading-tight">{job.title}</h3>
          {job.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{job.description}</p>
          )}
        </div>

        {/* Content */}
        <div className="px-4 pb-3 space-y-3">
          {/* Session count badge for active jobs */}
          {job.status === 'ACTIVE' && sessionCounts && (
            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${
                sessionCounts.unclaimed > 0
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  : 'bg-green-500/20 text-green-300 border border-green-500/30'
              }`}>
                {sessionCounts.unclaimed > 0
                  ? `${sessionCounts.unclaimed} unclaimed / ${sessionCounts.total} total`
                  : `${sessionCounts.total} session${sessionCounts.total !== 1 ? 's' : ''}`}
              </Badge>
            </div>
          )}

          {/* Duration & Rate Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/60 rounded-xl p-3 text-center border border-white/20">
              <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Duration</p>
              <p className="text-white font-bold text-base">{formatDuration(job.duration_minutes)}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-900/40 to-orange-900/40 rounded-xl p-3 text-center border border-yellow-500/40">
              <p className="text-yellow-300 text-[10px] uppercase font-bold mb-1">Rate</p>
              <p className="text-white font-bold text-base">
                {job.price_per_hour ? `$${job.price_per_hour}/hr` : 'Not set'}
              </p>
            </div>
          </div>

          {/* Time Window */}
          {(job.time_window_start || job.time_window_end) && (
            <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/30">
              <p className="text-blue-400 text-[10px] uppercase font-bold mb-1">Time Window</p>
              <div className="flex items-center justify-between">
                <span className="text-white font-bold">
                  {job.time_window_start ? job.time_window_start.substring(0, 5) : 'Not set'}
                </span>
                <span className="text-gray-500">&rarr;</span>
                <span className="text-white font-bold">
                  {job.time_window_end ? job.time_window_end.substring(0, 5) : 'Not set'}
                </span>
              </div>
            </div>
          )}

          {/* Address */}
          {job.address && (
            <div className="bg-gray-800/60 rounded-xl p-3 border border-white/20">
              <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Address</p>
              <p className="text-white text-sm">{job.address}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 pb-4 pt-3 border-t border-white/10 flex flex-col gap-2">
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              disabled={loading}
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
            {job.status === 'ACTIVE' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickPublishOpen(true)}
                  disabled={loading}
                  className="flex-1 bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                >
                  <Send className="w-3 h-3 mr-1" />
                  Quick Publish
                </Button>
              </>
            )}
          </div>
          {job.status === 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkSchedulerOpen(true)}
              disabled={loading}
              className="w-full bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
            >
              <CalendarPlus className="w-3 h-3 mr-1" />
              Bulk Schedule
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleActivate}
            disabled={loading}
            className={`w-full ${
              job.status === 'ACTIVE'
                ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {job.status === 'ACTIVE' ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
            {loading ? '...' : job.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </Button>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={loading}
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <Copy className="w-3 h-3 mr-1" />
              Duplicate
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <QuickPublishDialog
        job={job}
        open={quickPublishOpen}
        onOpenChange={setQuickPublishOpen}
        onUpdate={onUpdate}
      />
      <BulkSchedulerDialog
        job={job}
        open={bulkSchedulerOpen}
        onOpenChange={setBulkSchedulerOpen}
        onUpdate={onUpdate}
      />
    </>
  )
}
