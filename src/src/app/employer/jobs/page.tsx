'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { JobTemplate, JobSessionFull } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { JobCard } from '@/components/employer/JobCard'
import { JobSessionCard } from '@/components/employer/JobSessionCard'

export default function EmployerJobsPage() {
  const [draftJobs, setDraftJobs] = useState<JobTemplate[]>([])
  const [activeJobs, setActiveJobs] = useState<JobTemplate[]>([])
  const [sessions, setSessions] = useState<JobSessionFull[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const fetchData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get employer record
      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) {
        console.error('Employer record not found')
        return
      }

      // Fetch job templates
      const { data: jobs, error: jobsError } = await supabase
        .from('job_templates')
        .select('*')
        .eq('created_by', employer.id)
        .order('created_at', { ascending: false })

      if (jobsError) throw jobsError

      // Separate draft and active jobs
      const drafts = jobs?.filter(j => j.status === 'DRAFT') || []
      const actives = jobs?.filter(j => j.status === 'ACTIVE') || []

      setDraftJobs(drafts)
      setActiveJobs(actives)

      // Fetch job sessions with related data
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          ),
          employee:employees(*)
        `)
        .in('job_template_id', jobs?.map(j => j.id) || [])
        .in('status', ['OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS'])
        .order('scheduled_date', { ascending: true })

      if (sessionsError) throw sessionsError

      setSessions(sessionsData as JobSessionFull[] || [])

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateJob = () => {
    router.push('/employer/jobs/new')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <Button onClick={handleCreateJob}>
            Create Job
          </Button>
        </div>

        {/* Draft Jobs Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Draft Jobs
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({draftJobs.length})
              </span>
            </h2>
          </div>

          {draftJobs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500">No draft jobs</p>
              <p className="text-sm text-gray-400 mt-1">
                Create a new job template to get started
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {draftJobs.map(job => (
                <JobCard key={job.id} job={job} onUpdate={fetchData} />
              ))}
            </div>
          )}
        </section>

        {/* Active Jobs Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Active Jobs
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({activeJobs.length})
              </span>
            </h2>
          </div>

          {activeJobs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500">No active jobs</p>
              <p className="text-sm text-gray-400 mt-1">
                Activate a draft job to post it to the marketplace
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeJobs.map(job => (
                <JobCard key={job.id} job={job} onUpdate={fetchData} />
              ))}
            </div>
          )}
        </section>

        {/* Current Sessions Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Current Sessions
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({sessions.length})
              </span>
            </h2>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500">No active sessions</p>
              <p className="text-sm text-gray-400 mt-1">
                Sessions appear here when employees claim or are assigned to jobs
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map(session => (
                <JobSessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
