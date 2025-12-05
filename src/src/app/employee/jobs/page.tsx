'use client'

import { useEffect, useState } from 'react'
import type { JobSessionFull, JobSessionStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MyJobCard } from '@/components/employee/MyJobCard'
import { Loader2 } from 'lucide-react'

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
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )
    }

    if (jobList.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">{emptyMessage}</p>
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your job assignments and track progress
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="pending" className="text-[10px] sm:text-sm px-1 py-2 relative">
              Pending
              {counts.pending > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[8px] bg-yellow-500 text-white rounded-full flex items-center justify-center">
                  {counts.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-[10px] sm:text-sm px-1 py-2 relative">
              Approved
              {counts.approved > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[8px] bg-green-500 text-white rounded-full flex items-center justify-center">
                  {counts.approved}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="in-progress" className="text-[10px] sm:text-sm px-1 py-2 relative">
              Active
              {counts.inProgress > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[8px] bg-blue-500 text-white rounded-full flex items-center justify-center">
                  {counts.inProgress}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-[10px] sm:text-sm px-1 py-2 relative">
              Done
              {counts.completed > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[8px] bg-purple-500 text-white rounded-full flex items-center justify-center">
                  {counts.completed}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="refused" className="text-[10px] sm:text-sm px-1 py-2 relative">
              Refused
              {counts.refused > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[8px] bg-red-500 text-white rounded-full flex items-center justify-center">
                  {counts.refused}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

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
