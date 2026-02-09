'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { JobSessionFull } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Clock, Play, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface CurrentJobsCardProps {
  employeeId: string
}

export function CurrentJobsCard({ employeeId }: CurrentJobsCardProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [currentJobs, setCurrentJobs] = useState<JobSessionFull[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadCurrentJobs()

    // Refresh every minute to check time window changes
    const interval = setInterval(loadCurrentJobs, 60000)
    return () => clearInterval(interval)
  }, [employeeId])

  const loadCurrentJobs = async () => {
    try {
      // Get APPROVED and IN_PROGRESS jobs assigned to or split with this employee
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          ),
          employee:employees!job_sessions_assigned_to_fkey(*)
        `)
        .or(`assigned_to.eq.${employeeId},split_with.eq.${employeeId}`)
        .in('status', ['APPROVED', 'IN_PROGRESS'])
        .order('scheduled_date', { ascending: true })

      if (error) throw error

      // Filter jobs within time window
      const jobsInWindow = (data as JobSessionFull[]).filter(job => isWithinTimeWindow(job))
      setCurrentJobs(jobsInWindow)
    } catch (error) {
      console.error('Error loading current jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const isWithinTimeWindow = (job: JobSessionFull): boolean => {
    if (!job.scheduled_date) return false

    const now = new Date()
    const jobStartDate = new Date(job.scheduled_date)
    const jobEndDate = job.scheduled_end_date
      ? new Date(job.scheduled_end_date)
      : new Date(job.scheduled_date)

    // If job has time window, check times
    if (job.job_template.time_window_start && job.job_template.time_window_end) {
      const [startHours, startMinutes] = job.job_template.time_window_start.split(':').map(Number)
      const [endHours, endMinutes] = job.job_template.time_window_end.split(':').map(Number)

      // Set start datetime
      const startDateTime = new Date(jobStartDate)
      startDateTime.setHours(startHours, startMinutes, 0, 0)

      // Set end datetime
      const endDateTime = new Date(jobEndDate)
      endDateTime.setHours(endHours, endMinutes, 0, 0)

      // Check if current time is within the window
      return now >= startDateTime && now <= endDateTime
    }

    // If no time window specified, check if it's the same day
    const todayDateStr = now.toDateString()
    const jobDateStr = jobStartDate.toDateString()
    return todayDateStr === jobDateStr
  }

  const getTimeRemaining = (job: JobSessionFull): string => {
    if (!job.scheduled_date) return ''

    const now = new Date()
    const jobEndDate = job.scheduled_end_date
      ? new Date(job.scheduled_end_date)
      : new Date(job.scheduled_date)

    if (job.job_template.time_window_end) {
      const [endHours, endMinutes] = job.job_template.time_window_end.split(':').map(Number)
      const endDateTime = new Date(jobEndDate)
      endDateTime.setHours(endHours, endMinutes, 0, 0)

      const diffMs = endDateTime.getTime() - now.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

      if (diffHours > 0) {
        return `${diffHours}h ${diffMinutes}m left`
      }
      return `${diffMinutes}m left`
    }

    return ''
  }

  const handleStartJob = async (job: JobSessionFull) => {
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'IN_PROGRESS',
          started_at: new Date().toISOString()
        })
        .eq('id', job.id)

      if (error) throw error

      router.push(`/employee/jobs/${job.id}`)
    } catch (error) {
      console.error('Error starting job:', error)
      toast.error(t('Failed to start job. Please try again.'))
    }
  }

  const handleContinueJob = (job: JobSessionFull) => {
    router.push(`/employee/jobs/${job.id}`)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 bg-white/10 rounded-lg"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {currentJobs.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-gray-400">{t('No jobs right now')}</p>
          <p className="text-xs text-gray-500 mt-1">{t('Jobs within their time window will appear here')}</p>
        </div>
      ) : (
        currentJobs.map((job) => (
          <div
            key={job.id}
            className={`p-4 rounded-xl border transition-all ${
              job.status === 'APPROVED'
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-blue-500/10 border-blue-500/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-400">
                    {job.job_template.job_code}
                  </span>
                  <Badge
                    className={
                      job.status === 'APPROVED'
                        ? 'bg-green-500/20 text-green-300 border-green-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    }
                  >
                    {job.status === 'APPROVED' ? t('START NOW') : t('IN PROGRESS')}
                  </Badge>
                </div>
                <h4 className="font-semibold text-white truncate">
                  {job.job_template.title}
                </h4>
                {job.job_template.customer && (
                  <p className="text-sm text-gray-400 truncate">
                    {job.job_template.customer.full_name}
                  </p>
                )}
                <p className="text-xs text-amber-400 mt-1">
                  {getTimeRemaining(job)}
                </p>
              </div>
              <div className="shrink-0">
                {job.status === 'APPROVED' ? (
                  <Button
                    onClick={() => handleStartJob(job)}
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    {t('Start')}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleContinueJob(job)}
                    size="sm"
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    {t('Continue')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// Export with alias for drawer usage
export { CurrentJobsCard as CurrentJobsContent }
