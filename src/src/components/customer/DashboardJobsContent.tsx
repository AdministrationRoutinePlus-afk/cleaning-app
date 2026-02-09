'use client'

import { useEffect, useState, useRef } from 'react'
import type { JobTemplate, JobStep } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { JobDetailCard } from '@/components/customer/JobDetailCard'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface JobTemplateWithSteps extends JobTemplate {
  job_steps: JobStep[]
}

interface UpcomingSession {
  scheduled_date: string
  status: string
}

interface SessionCount {
  job_template_id: string
  upcoming: number
  completed: number
}

interface DashboardJobsContentProps {
  customerId: string
}

export function DashboardJobsContent({ customerId }: DashboardJobsContentProps) {
  const { t } = useTranslation()
  const [jobTemplates, setJobTemplates] = useState<JobTemplateWithSteps[]>([])
  const [sessionCounts, setSessionCounts] = useState<Record<string, SessionCount>>({})
  const [upcomingSessions, setUpcomingSessions] = useState<Record<string, UpcomingSession[]>>({})
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadJobTemplates()
    return () => { isMountedRef.current = false }
  }, [customerId])

  const loadJobTemplates = async () => {
    try {
      const { data: templates, error: templatesError } = await supabase
        .from('job_templates')
        .select(`
          *,
          job_steps(*)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (templatesError) throw templatesError

      const templatesData = (templates as JobTemplateWithSteps[]) || []
      if (!isMountedRef.current) return
      setJobTemplates(templatesData)

      if (templatesData.length > 0) {
        const templateIds = templatesData.map((t) => t.id)

        const { data: sessions, error: sessionsError } = await supabase
          .from('job_sessions')
          .select('job_template_id, status, scheduled_date')
          .in('job_template_id', templateIds)

        if (sessionsError) throw sessionsError

        const today = new Date().toISOString().split('T')[0]

        const counts: Record<string, SessionCount> = {}
        const upcoming: Record<string, UpcomingSession[]> = {}
        templatesData.forEach((template) => {
          counts[template.id] = {
            job_template_id: template.id,
            upcoming: 0,
            completed: 0
          }
          upcoming[template.id] = []
        })

        sessions?.forEach((session) => {
          if (!counts[session.job_template_id]) {
            counts[session.job_template_id] = {
              job_template_id: session.job_template_id,
              upcoming: 0,
              completed: 0
            }
            upcoming[session.job_template_id] = []
          }

          if (['OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS'].includes(session.status)) {
            counts[session.job_template_id].upcoming++
            if (session.scheduled_date && session.scheduled_date >= today) {
              upcoming[session.job_template_id].push({
                scheduled_date: session.scheduled_date,
                status: session.status,
              })
            }
          } else if (['COMPLETED', 'EVALUATED'].includes(session.status)) {
            counts[session.job_template_id].completed++
          }
        })

        Object.keys(upcoming).forEach((templateId) => {
          upcoming[templateId].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
        })

        if (isMountedRef.current) {
          setSessionCounts(counts)
          setUpcomingSessions(upcoming)
        }
      }
    } catch (error) {
      console.error('Error loading job templates:', error)
      toast.error(t('Failed to load your jobs'))
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-48 bg-white/5 rounded-xl"></div>
        ))}
      </div>
    )
  }

  if (jobTemplates.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">{t('No jobs found')}</p>
        <p className="text-sm text-gray-500 mt-1">
          {t('Jobs assigned to you will appear here')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {jobTemplates.map((template) => (
        <JobDetailCard
          key={template.id}
          jobTemplate={template}
          upcomingSessions={sessionCounts[template.id]?.upcoming || 0}
          completedSessions={sessionCounts[template.id]?.completed || 0}
          upcomingSessionDates={upcomingSessions[template.id] || []}
        />
      ))}
    </div>
  )
}
