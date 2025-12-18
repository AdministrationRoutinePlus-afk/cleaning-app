'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { MarketplaceJobCard } from '@/components/employee/MarketplaceJobCard'
import type { JobSession, JobTemplate, Customer } from '@/types/database'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'

type JobSessionWithDetails = JobSession & {
  job_template: JobTemplate & {
    customer: Customer | null
  }
}

type SwipeAction = {
  jobSessionId: string
  action: 'interested' | 'skipped'
  timestamp: string
}

export default function EmployeeMarketplacePage() {
  const [marketplaceJobs, setMarketplaceJobs] = useState<JobSessionWithDetails[]>([])
  const [interestedJobs, setInterestedJobs] = useState<JobSessionWithDetails[]>([])
  const [skippedJobs, setSkippedJobs] = useState<JobSessionWithDetails[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [employeeStatus, setEmployeeStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('marketplace')

  const supabase = createClient()

  // Load user and data
  useEffect(() => {
    loadUser()
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Get employee ID for this user
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .single()

      const employeeId = employee?.id

      // Load marketplace jobs (OFFERED status)
      const { data: offeredJobs, error: offeredError } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          )
        `)
        .eq('status', 'OFFERED')
        .order('created_at', { ascending: false })

      if (offeredError) throw offeredError

      // Load interested jobs (CLAIMED, APPROVED, REFUSED by current user)
      let claimedJobs: typeof offeredJobs = []
      if (employeeId) {
        const { data, error: claimedError } = await supabase
          .from('job_sessions')
          .select(`
            *,
            job_template:job_templates(
              *,
              customer:customers(*)
            )
          `)
          .in('status', ['CLAIMED', 'APPROVED', 'REFUSED'])
          .eq('assigned_to', employeeId)
          .order('created_at', { ascending: false })

        if (claimedError) throw claimedError
        claimedJobs = data
      }

      // Filter out jobs that have been swiped on
      const swipeHistory = getSwipeHistory()
      const swipedIds = new Set(swipeHistory.map(s => s.jobSessionId))

      // Deduplicate and filter out swiped jobs + jobs without job_template
      const availableJobs = (offeredJobs || [])
        .filter(job => job.job_template !== null)
        .filter(job => !swipedIds.has(job.id))
        .filter((job, index, self) => index === self.findIndex(j => j.id === job.id)) as JobSessionWithDetails[]

      setMarketplaceJobs(availableJobs)

      // Deduplicate claimed jobs by ID (in case of duplicates) + filter out orphaned
      const uniqueClaimedJobs = (claimedJobs || [])
        .filter(job => job.job_template !== null)
        .filter((job, index, self) => index === self.findIndex(j => j.id === job.id)
      ) as JobSessionWithDetails[]
      setInterestedJobs(uniqueClaimedJobs)

      // Load skipped jobs from localStorage
      const skipped = swipeHistory
        .filter(s => s.action === 'skipped')
        .map(s => s.jobSessionId)

      if (skipped.length > 0) {
        const { data: skippedData } = await supabase
          .from('job_sessions')
          .select(`
            *,
            job_template:job_templates(
              *,
              customer:customers(*)
            )
          `)
          .in('id', skipped)

        // Deduplicate skipped jobs + filter out orphaned
        const uniqueSkipped = (skippedData || [])
          .filter(job => job.job_template !== null)
          .filter((job, index, self) => index === self.findIndex(j => j.id === job.id)
        ) as JobSessionWithDetails[]
        setSkippedJobs(uniqueSkipped)
      }

    } catch (error) {
      console.error('Error loading jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  useEffect(() => {
    if (userId) {
      loadData()
    }
  }, [userId, loadData])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)

      // Also fetch employee status to check if account is activated
      const { data: employee } = await supabase
        .from('employees')
        .select('status')
        .eq('user_id', user.id)
        .single()

      if (employee) {
        setEmployeeStatus(employee.status)
      }
    }
  }

  // LocalStorage functions for swipe history
  const getSwipeHistory = (): SwipeAction[] => {
    if (typeof window === 'undefined') return []
    const history = localStorage.getItem('swipeHistory')
    return history ? JSON.parse(history) : []
  }

  const saveSwipeAction = (jobSessionId: string, action: 'interested' | 'skipped') => {
    const history = getSwipeHistory()
    history.push({
      jobSessionId,
      action,
      timestamp: new Date().toISOString()
    })
    localStorage.setItem('swipeHistory', JSON.stringify(history))
  }

  const removeFromSwipeHistory = (jobSessionId: string) => {
    const history = getSwipeHistory()
    const updated = history.filter(h => h.jobSessionId !== jobSessionId)
    localStorage.setItem('swipeHistory', JSON.stringify(updated))
  }

  // Handle swipe
  const handleSwipe = async (direction: 'left' | 'right') => {
    if (currentIndex >= marketplaceJobs.length) return

    const job = marketplaceJobs[currentIndex]

    if (direction === 'right') {
      // Interested - claim the job
      await handleClaimJob(job)
    } else {
      // Skip - save to localStorage
      saveSwipeAction(job.id, 'skipped')
      setSkippedJobs(prev => [...prev, job])
    }

    // Move to next card
    setCurrentIndex(prev => prev + 1)
  }

  const handleClaimJob = async (job: JobSessionWithDetails) => {
    try {
      // Get employee record
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!employee) {
        console.error('Employee record not found')
        return
      }

      // Update job session
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'CLAIMED',
          assigned_to: employee.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)

      if (error) throw error

      // Save to swipe history
      saveSwipeAction(job.id, 'interested')

      // Move to interested list
      setInterestedJobs(prev => [...prev, job])

    } catch (error) {
      console.error('Error claiming job:', error)
    }
  }

  // Reset all - unclaim jobs and clear history
  const handleResetAll = async () => {
    try {
      // Get employee ID
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (employee) {
        // Unclaim all jobs claimed by this employee (set back to OFFERED)
        await supabase
          .from('job_sessions')
          .update({
            status: 'OFFERED',
            assigned_to: null,
            updated_at: new Date().toISOString()
          })
          .eq('assigned_to', employee.id)
          .eq('status', 'CLAIMED')
      }

      // Clear localStorage
      localStorage.removeItem('swipeHistory')

      // Reset state
      setCurrentIndex(0)
      setSkippedJobs([])
      setInterestedJobs([])

      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error resetting:', error)
    }
  }

  const handleRestoreJob = async (job: JobSessionWithDetails) => {
    // Remove from swipe history
    removeFromSwipeHistory(job.id)

    // Add back to marketplace
    setMarketplaceJobs(prev => [job, ...prev])
    setSkippedJobs(prev => prev.filter(j => j.id !== job.id))
  }

  const currentJob = marketplaceJobs[currentIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pb-20">
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-white mb-6">Job Marketplace</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-6 space-y-3">
            {/* Marketplace - Big Tab on Top */}
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all ${
                activeTab === 'marketplace'
                  ? 'bg-white/20 backdrop-blur-md text-white shadow-lg scale-105 border-2 border-white/40'
                  : 'bg-white/5 backdrop-blur-sm text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Marketplace</span>
                {marketplaceJobs.length > currentIndex && (
                  <span className={`text-sm rounded-full px-3 py-1 ${
                    activeTab === 'marketplace'
                      ? 'bg-white/30 text-white'
                      : 'bg-white/10 text-gray-400'
                  }`}>
                    {marketplaceJobs.length - currentIndex} available
                  </span>
                )}
              </div>
            </button>

            {/* Interested & Skipped - Smaller Tabs Below */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab('interested')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  activeTab === 'interested'
                    ? 'bg-white/20 backdrop-blur-md text-white shadow-md scale-105 border-2 border-white/40'
                    : 'bg-white/5 backdrop-blur-sm text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>Interested</span>
                  {interestedJobs.length > 0 && (
                    <span className={`text-xs rounded-full px-2 py-0.5 ${
                      activeTab === 'interested'
                        ? 'bg-white/30 text-white'
                        : 'bg-white/10 text-gray-400'
                    }`}>
                      {interestedJobs.length}
                    </span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setActiveTab('garbage')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  activeTab === 'garbage'
                    ? 'bg-white/20 backdrop-blur-md text-white shadow-md scale-105 border-2 border-white/40'
                    : 'bg-white/5 backdrop-blur-sm text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>Skipped</span>
                  {skippedJobs.length > 0 && (
                    <span className={`text-xs rounded-full px-2 py-0.5 ${
                      activeTab === 'garbage'
                        ? 'bg-white/30 text-white'
                        : 'bg-white/10 text-gray-400'
                    }`}>
                      {skippedJobs.length}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* MARKETPLACE TAB */}
          <TabsContent value="marketplace" className="mt-0">
            {loading ? (
              <LoadingSpinner size="md" />
            ) : employeeStatus === 'PENDING' ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 backdrop-blur-md rounded-2xl p-8 text-center">
                <div className="text-4xl mb-4">⏳</div>
                <h3 className="text-lg font-semibold text-yellow-300 mb-2">
                  Account Pending Activation
                </h3>
                <p className="text-yellow-200/80 mb-2">
                  Your account is waiting for employer approval.
                </p>
                <p className="text-sm text-yellow-200/60">
                  Once your account is activated, you&apos;ll be able to see and claim jobs here.
                </p>
              </div>
            ) : employeeStatus === 'INACTIVE' || employeeStatus === 'BLOCKED' ? (
              <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-md rounded-2xl p-8 text-center">
                <div className="text-4xl mb-4">🚫</div>
                <h3 className="text-lg font-semibold text-red-300 mb-2">
                  Account {employeeStatus === 'BLOCKED' ? 'Blocked' : 'Inactive'}
                </h3>
                <p className="text-red-200/80">
                  Please contact your employer to restore access.
                </p>
              </div>
            ) : currentJob ? (
              <div className="space-y-6">
                {/* Instructions */}
                <p className="text-center text-gray-300 text-sm">
                  Swipe right to show interest, swipe left to skip
                </p>

                {/* Swipe Card */}
                <SwipeableCard
                  job={currentJob}
                  onSwipe={handleSwipe}
                />

                {/* Action Buttons */}
                <div className="flex justify-center gap-6">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full w-16 h-16 border-2 border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500 bg-black/20 backdrop-blur-md transition-all"
                    onClick={() => handleSwipe('left')}
                  >
                    <span className="text-2xl">✕</span>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full w-16 h-16 border-2 border-green-500/50 text-green-400 hover:bg-green-500/20 hover:border-green-500 bg-black/20 backdrop-blur-md transition-all"
                    onClick={() => handleSwipe('right')}
                  >
                    <span className="text-2xl">♥</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-12 text-center border border-white/20">
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  All caught up!
                </h3>
                <p className="text-gray-300 mb-4">
                  No more jobs available right now. Check back later!
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAll}
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  Reset & Show All Jobs
                </Button>
              </div>
            )}
          </TabsContent>

          {/* INTERESTED TAB */}
          <TabsContent value="interested" className="mt-0">
            {interestedJobs.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-12 text-center border border-white/20">
                <div className="text-4xl mb-4">👀</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  No interested jobs yet
                </h3>
                <p className="text-gray-300">
                  Swipe right on jobs you like to see them here!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {interestedJobs.map(job => (
                  <JobListCard key={job.id} job={job} status="pending" />
                ))}
              </div>
            )}
          </TabsContent>

          {/* GARBAGE/SKIPPED TAB */}
          <TabsContent value="garbage" className="mt-0">
            {skippedJobs.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-12 text-center border border-white/20">
                <div className="text-4xl mb-4">🗑️</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  No skipped jobs
                </h3>
                <p className="text-gray-300">
                  Jobs you skip will appear here. You can restore them anytime!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {skippedJobs.map(job => (
                  <JobListCard
                    key={job.id}
                    job={job}
                    status="skipped"
                    onRestore={() => handleRestoreJob(job)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Swipeable Card Component
function SwipeableCard({
  job,
  onSwipe
}: {
  job: JobSessionWithDetails
  onSwipe: (direction: 'left' | 'right') => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-30, 30])
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0])

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100

    if (Math.abs(info.offset.x) > threshold) {
      onSwipe(info.offset.x > 0 ? 'right' : 'left')
    }
  }

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      className="cursor-grab active:cursor-grabbing"
    >
      <MarketplaceJobCard jobSession={job} />
    </motion.div>
  )
}

// Job List Card for Interested and Skipped tabs
function JobListCard({
  job,
  status,
  onRestore
}: {
  job: JobSessionWithDetails
  status: 'pending' | 'skipped'
  onRestore?: () => void
}) {
  const { job_template } = job

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-4 border border-white/20">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-2 py-1 rounded-full">
            {job_template.job_code}
          </span>
          {status === 'pending' && job.status === 'CLAIMED' && (
            <span className="ml-2 inline-block bg-yellow-500/20 text-yellow-300 text-xs font-semibold px-2 py-1 rounded-full">
              Pending Approval
            </span>
          )}
          {job.status === 'APPROVED' && (
            <span className="ml-2 inline-block bg-green-500/20 text-green-300 text-xs font-semibold px-2 py-1 rounded-full">
              Approved!
            </span>
          )}
          {job.status === 'REFUSED' && (
            <span className="ml-2 inline-block bg-red-500/20 text-red-300 text-xs font-semibold px-2 py-1 rounded-full">
              Refused
            </span>
          )}
        </div>
        {onRestore && (
          <Button size="sm" variant="outline" onClick={onRestore} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
            Restore
          </Button>
        )}
      </div>

      <h3 className="font-semibold text-white mb-1">{job_template.title}</h3>

      {job_template.customer && (
        <p className="text-sm text-gray-300 mb-2">
          Client: {job_template.customer.full_name}
        </p>
      )}

      {/* Scheduled Date */}
      {job.scheduled_date && (
        <p className="text-sm text-blue-400 font-medium mb-2">
          {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </p>
      )}

      {/* Time Window */}
      {job.scheduled_date && (job_template.time_window_start || job_template.time_window_end) && (
        <div className="bg-white/5 p-2 rounded-lg mb-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Window Start:</span>
            <span className="text-white font-medium">
              {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
              {job_template.time_window_start && ` at ${job_template.time_window_start.substring(0, 5)}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Window End:</span>
            <span className="text-white font-medium">
              {new Date((job.scheduled_end_date || job.scheduled_date) + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
              {job_template.time_window_end && ` at ${job_template.time_window_end.substring(0, 5)}`}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-4 text-sm text-gray-300">
        {job_template.duration_minutes && (
          <span>{Math.floor(job_template.duration_minutes / 60)}h {job_template.duration_minutes % 60}m</span>
        )}
        {job_template.price_per_hour && (
          <span>${job_template.price_per_hour}/hr</span>
        )}
      </div>

      {job_template.description && (
        <p className="mt-2 text-sm text-gray-400 line-clamp-2">
          {job_template.description}
        </p>
      )}
    </div>
  )
}
