'use client'

import { useEffect, useState } from 'react'
import type { JobSessionFull, JobSessionStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MyJobCard } from '@/components/employee/MyJobCard'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function EmployeeJobsPage() {
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<JobSessionFull[]>([])
  const [activeTab, setActiveTab] = useState<string>('pending')
  const supabase = createClient()

  // Fetch jobs for the current employee
  const fetchJobs = async () => {
    setLoading(true)
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error getting user:', userError)
        return
      }

      // Get employee record for current user
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (employeeError || !employeeData) {
        console.error('Error getting employee:', employeeError)
        return
      }

      // Fetch job sessions with related data
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          )
        `)
        .eq('assigned_to', employeeData.id)
        .order('scheduled_date', { ascending: true })

      if (error) {
        console.error('Error fetching jobs:', error)
        return
      }

      // Type assertion to ensure proper typing
      const typedData = data as unknown as JobSessionFull[]
      setJobs(typedData || [])
    } catch (error) {
      console.error('Error in fetchJobs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load jobs on mount
  useEffect(() => {
    fetchJobs()
  }, [])

  // Filter jobs by status for each tab
  const pendingJobs = jobs.filter(job => job.status === 'CLAIMED') // Waiting for employer approval
  const approvedJobs = jobs.filter(job => job.status === 'APPROVED')
  const inProgressJobs = jobs.filter(job => job.status === 'IN_PROGRESS')
  const completedJobs = jobs.filter(job =>
    job.status === 'COMPLETED' || job.status === 'EVALUATED'
  )
  const refusedJobs = jobs.filter(job => job.status === 'REFUSED')

  // Get job count for each tab
  const getCounts = () => ({
    pending: pendingJobs.length,
    approved: approvedJobs.length,
    inProgress: inProgressJobs.length,
    completed: completedJobs.length,
    refused: refusedJobs.length
  })

  const counts = getCounts()

  // Render job list
  const renderJobList = (jobList: JobSessionFull[], emptyMessage: string) => {
    if (loading) {
      return <LoadingSpinner size="lg" />
    }

    if (jobList.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-300">{emptyMessage}</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {jobList.map(job => (
          <MyJobCard
            key={job.id}
            jobSession={job}
            onStatusChange={fetchJobs}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pb-20">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">My Jobs</h1>
          <p className="text-sm text-gray-300 mt-1">
            Manage your job assignments and track progress
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col gap-6 mb-6">
            {/* Top Priority Section - Active & Done */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                Current Jobs
              </div>

              <button
                onClick={() => setActiveTab('in-progress')}
                className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                  activeTab === 'in-progress'
                    ? 'bg-blue-500/20 text-blue-300 border-2 border-blue-500/50 scale-105 shadow-lg'
                    : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Active</span>
                  {counts.inProgress > 0 && (
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      activeTab === 'in-progress'
                        ? 'bg-blue-400 text-black'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {counts.inProgress}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setActiveTab('completed')}
                className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                  activeTab === 'completed'
                    ? 'bg-purple-500/20 text-purple-300 border-2 border-purple-500/50 scale-105 shadow-lg'
                    : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Done</span>
                  {counts.completed > 0 && (
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      activeTab === 'completed'
                        ? 'bg-purple-400 text-black'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {counts.completed}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10"></div>

            {/* Secondary Section - Pending, Approved, Refused */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                Job Status
              </div>

              <button
                onClick={() => setActiveTab('pending')}
                className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                  activeTab === 'pending'
                    ? 'bg-yellow-500/20 text-yellow-300 border-2 border-yellow-500/50 scale-105 shadow-lg'
                    : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Pending</span>
                  {counts.pending > 0 && (
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      activeTab === 'pending'
                        ? 'bg-yellow-400 text-black'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {counts.pending}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setActiveTab('approved')}
                className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                  activeTab === 'approved'
                    ? 'bg-green-500/20 text-green-300 border-2 border-green-500/50 scale-105 shadow-lg'
                    : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Approved</span>
                  {counts.approved > 0 && (
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      activeTab === 'approved'
                        ? 'bg-green-400 text-black'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {counts.approved}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setActiveTab('refused')}
                className={`relative py-4 px-4 rounded-xl font-semibold text-sm transition-all ${
                  activeTab === 'refused'
                    ? 'bg-red-500/20 text-red-300 border-2 border-red-500/50 scale-105 shadow-lg'
                    : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Refused</span>
                  {counts.refused > 0 && (
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      activeTab === 'refused'
                        ? 'bg-red-400 text-black'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {counts.refused}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          <TabsContent value="pending" className="mt-6">
            {renderJobList(
              pendingJobs,
              'No pending jobs. Jobs you claim will appear here while waiting for employer approval.'
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-6">
            {renderJobList(
              approvedJobs,
              'No approved jobs yet. Once the employer approves your claims, they appear here.'
            )}
          </TabsContent>

          <TabsContent value="in-progress" className="mt-6">
            {renderJobList(
              inProgressJobs,
              'No jobs in progress. Start an approved job to see it here.'
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {renderJobList(
              completedJobs,
              'No completed jobs yet. Finished jobs will appear here.'
            )}
          </TabsContent>

          <TabsContent value="refused" className="mt-6">
            {renderJobList(
              refusedJobs,
              'No refused jobs. Jobs declined by the employer will appear here.'
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
