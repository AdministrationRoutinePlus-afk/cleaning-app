'use client'

/**
 * Employer Jobs Page (Tab 1)
 *
 * Displays all jobs organized in three sections:
 *
 * 1. DRAFT JOBS - Job templates not yet activated
 * 2. ACTIVE JOBS - Job templates currently active in marketplace
 * 3. CURRENT SESSIONS - Hierarchical view:
 *    - Customer (expandable)
 *      - Job Template (expandable)
 *        - Individual Sessions with date/status
 *    - "Random Jobs" group for RND jobs without a customer
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { JobTemplate, JobSessionFull, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { JobCard } from '@/components/employer/JobCard'
import { format } from 'date-fns'
import { History } from 'lucide-react'

// Type for grouped sessions: Customer -> Job -> Sessions
interface GroupedSessions {
  [customerId: string]: {
    customer: Customer | null
    customerName: string
    jobs: {
      [jobId: string]: {
        job: JobTemplate
        sessions: JobSessionFull[]
      }
    }
  }
}

export default function EmployerJobsPage() {
  const [draftJobs, setDraftJobs] = useState<JobTemplate[]>([])
  const [activeJobs, setActiveJobs] = useState<JobTemplate[]>([])
  const [sessions, setSessions] = useState<JobSessionFull[]>([])
  const [loading, setLoading] = useState(true)
  // Track expanded state for customers and jobs
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
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
        // Not an employer - redirect to employee or login
        router.push('/employee/marketplace')
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

  // Toggle customer expansion
  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(customerId)) {
        newSet.delete(customerId)
      } else {
        newSet.add(customerId)
      }
      return newSet
    })
  }

  // Toggle job expansion
  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(jobId)) {
        newSet.delete(jobId)
      } else {
        newSet.add(jobId)
      }
      return newSet
    })
  }

  // Group sessions by Customer -> Job -> Sessions
  const groupedSessions: GroupedSessions = sessions.reduce((acc, session) => {
    const customerId = session.job_template?.customer_id || 'random'
    const customerName = session.job_template?.customer?.full_name || 'Random Jobs'
    const jobId = session.job_template_id

    if (!acc[customerId]) {
      acc[customerId] = {
        customer: session.job_template?.customer || null,
        customerName,
        jobs: {}
      }
    }

    if (!acc[customerId].jobs[jobId]) {
      acc[customerId].jobs[jobId] = {
        job: session.job_template as JobTemplate,
        sessions: []
      }
    }

    acc[customerId].jobs[jobId].sessions.push(session)
    return acc
  }, {} as GroupedSessions)

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OFFERED': return 'bg-gray-500'
      case 'CLAIMED': return 'bg-yellow-500'
      case 'APPROVED': return 'bg-blue-500'
      case 'IN_PROGRESS': return 'bg-purple-500'
      default: return 'bg-gray-400'
    }
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/employer/jobs/history')}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              History
            </Button>
            <Button onClick={handleCreateJob}>
              Create Job
            </Button>
          </div>
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

        {/* Current Sessions Section - Hierarchical View */}
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
                Sessions appear here when jobs are activated
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Loop through customers */}
              {Object.entries(groupedSessions).map(([customerId, customerData]) => {
                const isCustomerExpanded = expandedCustomers.has(customerId)
                const jobCount = Object.keys(customerData.jobs).length
                const sessionCount = Object.values(customerData.jobs).reduce(
                  (sum, j) => sum + j.sessions.length, 0
                )

                return (
                  <div key={customerId} className="border-b last:border-b-0">
                    {/* Customer Row - Level 1 */}
                    <button
                      onClick={() => toggleCustomer(customerId)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {/* Expand/Collapse Icon */}
                        <span className="text-gray-400 w-5">
                          {isCustomerExpanded ? '▼' : '▶'}
                        </span>
                        {/* Customer Icon */}
                        <span className="text-xl">
                          {customerId === 'random' ? '🎲' : '👤'}
                        </span>
                        <span className="font-medium text-gray-900">
                          {customerData.customerName}
                        </span>
                        {customerData.customer?.customer_code && (
                          <Badge variant="outline" className="text-xs">
                            {customerData.customer.customer_code}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{jobCount} job{jobCount !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
                      </div>
                    </button>

                    {/* Jobs under this customer - Level 2 */}
                    {isCustomerExpanded && (
                      <div className="bg-gray-50">
                        {Object.entries(customerData.jobs).map(([jobId, jobData]) => {
                          const isJobExpanded = expandedJobs.has(jobId)

                          return (
                            <div key={jobId} className="border-t border-gray-200">
                              {/* Job Row */}
                              <button
                                onClick={() => toggleJob(jobId)}
                                className="w-full px-4 py-2 pl-12 flex items-center justify-between hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-400 w-5">
                                    {isJobExpanded ? '▼' : '▶'}
                                  </span>
                                  <span className="text-lg">📋</span>
                                  <span className="font-medium text-gray-800">
                                    {jobData.job?.title || 'Untitled Job'}
                                  </span>
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {jobData.job?.job_code}
                                  </Badge>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {jobData.sessions.length} session{jobData.sessions.length !== 1 ? 's' : ''}
                                </span>
                              </button>

                              {/* Sessions under this job - Level 3 */}
                              {isJobExpanded && (
                                <div className="bg-white border-t border-gray-100">
                                  {jobData.sessions.map(session => (
                                    <div
                                      key={session.id}
                                      className="px-4 py-2 pl-20 flex items-center justify-between hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-gray-400">📅</span>
                                        <span className="font-mono text-sm text-gray-600">
                                          {session.full_job_code || session.session_code}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                          {session.scheduled_date
                                            ? format(new Date(session.scheduled_date), 'EEE, MMM d, yyyy')
                                            : 'No date'}
                                        </span>
                                        {session.scheduled_time && (
                                          <span className="text-sm text-gray-400">
                                            @ {session.scheduled_time.slice(0, 5)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {session.employee && (
                                          <span className="text-sm text-gray-500">
                                            {session.employee.full_name}
                                          </span>
                                        )}
                                        <Badge className={`${getStatusColor(session.status)} text-white text-xs`}>
                                          {session.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
