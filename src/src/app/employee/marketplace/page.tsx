'use client'

import { toast } from 'sonner'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MarketplaceJobCard } from '@/components/employee/MarketplaceJobCard'
import type { JobSession, JobTemplate, Customer, Employee, JobExchange } from '@/types/database'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import { parseISO, startOfDay } from 'date-fns'
import { ShoppingBag, Users, ArrowRightLeft, Clock, DollarSign, Calendar, FileText } from 'lucide-react'
import Image from 'next/image'

type JobSessionWithDetails = JobSession & {
  job_template: JobTemplate & {
    customer: Customer | null
  }
}

type ExchangeWithDetails = JobExchange & {
  job_session: JobSessionWithDetails
  from_employee: Employee
}

type SwipeAction = {
  jobSessionId: string
  action: 'interested' | 'skipped'
  timestamp: string
}

export default function EmployeeMarketplacePage() {
  const [mainTab, setMainTab] = useState<'marketplace' | 'swap'>('marketplace')
  const [marketplaceJobs, setMarketplaceJobs] = useState<JobSessionWithDetails[]>([])
  const [interestedJobs, setInterestedJobs] = useState<JobSessionWithDetails[]>([])
  const [skippedJobs, setSkippedJobs] = useState<JobSessionWithDetails[]>([])
  const [swapJobs, setSwapJobs] = useState<ExchangeWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [swapLoading, setSwapLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [employeeStatus, setEmployeeStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('marketplace')
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  // Load user and data
  useEffect(() => {
    loadUser()
  }, [])

  // Scroll to top when tabs change
  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container')
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [mainTab, activeTab])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Get employee ID for this user
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      const empId = employee?.id
      if (empId) setEmployeeId(empId)

      // Load marketplace jobs (OFFERED status) - order by scheduled_date
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
        .not('scheduled_date', 'is', null) // Only jobs with scheduled dates
        .order('scheduled_date', { ascending: true })

      if (offeredError) throw offeredError

      // Load interested jobs (CLAIMED, APPROVED, REFUSED by current user)
      let claimedJobs: typeof offeredJobs = []
      if (empId) {
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
          .eq('assigned_to', empId)
          .order('scheduled_date', { ascending: true })

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
      toast.error('Failed to load marketplace jobs')
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  const loadSwapJobs = useCallback(async () => {
    if (!employeeId) return

    setSwapLoading(true)
    try {
      // Load pending exchanges from other employees
      const { data, error } = await supabase
        .from('job_exchanges')
        .select(`
          *,
          job_session:job_sessions(
            *,
            job_template:job_templates(
              *,
              customer:customers(*)
            )
          ),
          from_employee:employees!job_exchanges_from_employee_id_fkey(*)
        `)
        .eq('status', 'PENDING')
        .neq('from_employee_id', employeeId)
        .is('to_employee_id', null) // Open swaps (not targeted to specific employee)

      if (error) throw error

      // Filter out exchanges where job_session or job_template is null
      const validExchanges = (data || []).filter(
        ex => ex.job_session && ex.job_session.job_template
      ) as ExchangeWithDetails[]

      setSwapJobs(validExchanges)
    } catch (error) {
      console.error('Error loading swap jobs:', error)
      toast.error('Failed to load swap jobs')
    } finally {
      setSwapLoading(false)
    }
  }, [employeeId, supabase])

  useEffect(() => {
    if (userId) {
      loadData()
    }
  }, [userId, loadData])

  useEffect(() => {
    if (mainTab === 'swap' && employeeId) {
      loadSwapJobs()
    }
  }, [mainTab, employeeId, loadSwapJobs])

  // Cross-tab synchronization for swipe history
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('swipe-history-sync')
      broadcastChannelRef.current = channel

      channel.onmessage = () => {
        // Another tab changed swipe history, reload data
        if (userId) {
          loadData()
        }
      }

      return () => {
        channel.close()
        broadcastChannelRef.current = null
      }
    }
  }, [userId, loadData])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!isMountedRef.current) return
    if (user) {
      setUserId(user.id)

      // Also fetch employee status to check if account is activated
      const { data: employee } = await supabase
        .from('employees')
        .select('id, status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!isMountedRef.current) return
      if (employee) {
        setEmployeeStatus(employee.status)
        setEmployeeId(employee.id)
      }
    }
  }

  // LocalStorage functions for swipe history
  const getSwipeHistory = (): SwipeAction[] => {
    if (typeof window === 'undefined') return []
    const history = localStorage.getItem('swipeHistory')
    if (!history) return []
    try {
      return JSON.parse(history) as SwipeAction[]
    } catch {
      // Corrupted data - clear and return empty
      localStorage.removeItem('swipeHistory')
      return []
    }
  }

  const saveSwipeAction = (jobSessionId: string, action: 'interested' | 'skipped') => {
    const history = getSwipeHistory()
    history.push({
      jobSessionId,
      action,
      timestamp: new Date().toISOString()
    })
    localStorage.setItem('swipeHistory', JSON.stringify(history))
    broadcastChannelRef.current?.postMessage({ type: 'swipe-update' })
  }

  const removeFromSwipeHistory = (jobSessionId: string) => {
    const history = getSwipeHistory()
    const updated = history.filter(h => h.jobSessionId !== jobSessionId)
    localStorage.setItem('swipeHistory', JSON.stringify(updated))
    broadcastChannelRef.current?.postMessage({ type: 'swipe-update' })
  }

  // Group jobs by scheduled_date
  const groupedJobs = useMemo(() => {
    const grouped: Record<string, JobSessionWithDetails[]> = {}

    marketplaceJobs.forEach(job => {
      if (!job.scheduled_date) return // Skip jobs without dates
      const dateKey = job.scheduled_date
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(job)
    })

    // Sort dates chronologically and return as array
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [marketplaceJobs])

  // Format date for header display
  const formatDateHeader = (dateStr: string) => {
    const date = startOfDay(parseISO(dateStr))
    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.getTime() === today.getTime()) {
      return 'Today'
    } else if (date.getTime() === tomorrow.getTime()) {
      return 'Tomorrow'
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
  }

  // Toggle expand state
  const toggleExpand = (jobId: string) => {
    setExpandedJobId(prev => prev === jobId ? null : jobId)
  }

  // Handle claim job
  const handleClaimJob = async (job: JobSessionWithDetails) => {
    try {
      // Check employee status is ACTIVE before allowing claim
      if (employeeStatus !== 'ACTIVE') {
        toast.error('Your account must be active to claim jobs.')
        return
      }

      // Get employee record
      const { data: employee } = await supabase
        .from('employees')
        .select('id, status')
        .eq('user_id', userId)
        .maybeSingle()

      if (!employee) {
        toast.error('Employee record not found.')
        return
      }

      // Double-check employee status from DB
      if (employee.status !== 'ACTIVE') {
        toast.error('Your account must be active to claim jobs.')
        return
      }

      // Update job session with optimistic locking - only claim if still OFFERED
      const { data: updated, error } = await supabase
        .from('job_sessions')
        .update({
          status: 'CLAIMED',
          assigned_to: employee.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .eq('status', 'OFFERED')
        .select()

      if (error) throw error

      // Verify the update actually affected a row (another employee may have claimed it first)
      if (!updated || updated.length === 0) {
        toast.error('This job has already been claimed by another employee.')
        setMarketplaceJobs(prev => prev.filter(j => j.id !== job.id))
        return
      }

      // Save to swipe history
      saveSwipeAction(job.id, 'interested')

      // Remove from marketplace and add to interested
      setMarketplaceJobs(prev => prev.filter(j => j.id !== job.id))
      setInterestedJobs(prev => [...prev, { ...job, status: 'CLAIMED' as const }])
      setExpandedJobId(null)

    } catch (error) {
      console.error('Error claiming job:', error)
      toast.error('Failed to claim job. Please try again.')
    }
  }

  // Handle skip job
  const handleSkipJob = (job: JobSessionWithDetails) => {
    saveSwipeAction(job.id, 'skipped')
    setSkippedJobs(prev => [...prev, job])
    setMarketplaceJobs(prev => prev.filter(j => j.id !== job.id))
    setExpandedJobId(null)
  }

  // Reset all - unclaim jobs and clear history
  const handleResetAll = async () => {
    try {
      // Get employee ID
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (employee) {
        // Unclaim all jobs claimed/approved/refused by this employee (set back to OFFERED)
        await supabase
          .from('job_sessions')
          .update({
            status: 'OFFERED',
            assigned_to: null,
            updated_at: new Date().toISOString()
          })
          .eq('assigned_to', employee.id)
          .in('status', ['CLAIMED', 'APPROVED', 'REFUSED'])
      }

      // Clear localStorage and notify other tabs
      localStorage.removeItem('swipeHistory')
      broadcastChannelRef.current?.postMessage({ type: 'swipe-update' })

      // Reset state
      setSkippedJobs([])
      setInterestedJobs([])
      setExpandedJobId(null)

      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error resetting:', error)
    }
  }

  // Handle restore job from skipped
  const handleRestoreJob = async (job: JobSessionWithDetails) => {
    // Remove from swipe history
    removeFromSwipeHistory(job.id)

    // Add back to marketplace and remove from skipped
    setMarketplaceJobs(prev => {
      const updated = [...prev, job]
      // Re-sort by date
      return updated.sort((a, b) => {
        if (!a.scheduled_date) return 1
        if (!b.scheduled_date) return -1
        return a.scheduled_date.localeCompare(b.scheduled_date)
      })
    })
    setSkippedJobs(prev => prev.filter(j => j.id !== job.id))
  }

  // Handle claim swap
  const handleClaimSwap = async (exchange: ExchangeWithDetails) => {
    if (!employeeId) return

    try {
      // Update the exchange to assign to current employee
      const { error: exchangeError } = await supabase
        .from('job_exchanges')
        .update({
          to_employee_id: employeeId
        })
        .eq('id', exchange.id)

      if (exchangeError) throw exchangeError

      // Remove from swap list
      setSwapJobs(prev => prev.filter(s => s.id !== exchange.id))

      toast.success('Swap request sent! Waiting for employer approval.')
    } catch (error) {
      console.error('Error claiming swap:', error)
      toast.error('Failed to claim swap')
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-lg mx-auto p-4">
        {/* Top Level Selector - Two Square Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => {
              setMainTab('marketplace')
              setActiveTab('marketplace')
            }}
            className={`aspect-square flex flex-col items-center justify-center rounded-2xl font-bold text-base transition-all ${
              mainTab === 'marketplace'
                ? 'bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-400'
                : 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <ShoppingBag className={`w-10 h-10 mb-2 ${mainTab === 'marketplace' ? 'text-white' : 'text-gray-400'}`} />
            <span>Job Marketplace</span>
          </button>

          <button
            onClick={() => setMainTab('swap')}
            className={`aspect-square flex flex-col items-center justify-center rounded-2xl font-bold text-base transition-all ${
              mainTab === 'swap'
                ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
                : 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <ArrowRightLeft className={`w-10 h-10 mb-2 ${mainTab === 'swap' ? 'text-white' : 'text-gray-400'}`} />
            <span>Swap with Team</span>
            <span className={`text-xs rounded-full px-3 py-1 mt-2 min-h-[24px] ${
              swapJobs.length > 0
                ? mainTab === 'swap'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-gray-400'
                : 'opacity-0'
            }`}>
              {swapJobs.length > 0 ? `${swapJobs.length}` : '-'}
            </span>
          </button>
        </div>

        {mainTab === 'marketplace' ? (
          /* JOB MARKETPLACE SECTION */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Sub-tabs - Same style as Fixed Weekly / Custom Dates (inside container) */}
            <div className="bg-white/10 rounded-2xl border border-white/20 p-4 mb-6">
              <div className="flex justify-center">
                <div className="grid grid-cols-2 gap-3 max-w-xs w-full">
                  <button
                    onClick={() => setActiveTab('marketplace')}
                    className={`aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all ${
                      activeTab === 'marketplace'
                        ? 'bg-gradient-to-br from-green-600 to-green-800 text-white shadow-lg shadow-green-500/30 border-2 border-green-400'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <ShoppingBag className={`w-8 h-8 ${activeTab === 'marketplace' ? 'text-white' : 'text-gray-500'}`} />
                    <span className="text-center px-2 text-sm">Available</span>
                    {marketplaceJobs.length > 0 && (
                      <span className={`text-xs rounded-full px-2 py-0.5 ${
                        activeTab === 'marketplace' ? 'bg-white/20' : 'bg-white/10'
                      }`}>
                        {marketplaceJobs.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('interested')}
                    className={`aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all ${
                      activeTab === 'interested'
                        ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg shadow-amber-500/30 border-2 border-amber-400'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <Users className={`w-8 h-8 ${activeTab === 'interested' ? 'text-white' : 'text-gray-500'}`} />
                    <span className="text-center px-2 text-sm">Interested</span>
                    {interestedJobs.length > 0 && (
                      <span className={`text-xs rounded-full px-2 py-0.5 ${
                        activeTab === 'interested' ? 'bg-white/20' : 'bg-white/10'
                      }`}>
                        {interestedJobs.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* MARKETPLACE TAB */}
            <TabsContent value="marketplace" className="mt-0">
              {loading ? (
                <LoadingSpinner size="md" />
              ) : employeeStatus === 'PENDING' ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-8 text-center">
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
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
                  <div className="text-4xl mb-4">🚫</div>
                  <h3 className="text-lg font-semibold text-red-300 mb-2">
                    Account {employeeStatus === 'BLOCKED' ? 'Blocked' : 'Inactive'}
                  </h3>
                  <p className="text-red-200/80">
                    Please contact your employer to restore access.
                  </p>
                </div>
              ) : groupedJobs.length > 0 ? (
                <div className="space-y-6">
                  {/* Instructions */}
                  <p className="text-center text-gray-400 text-sm">
                    Tap a job to view details and claim
                  </p>

                  {/* Date-grouped jobs list */}
                  {groupedJobs.map(([dateKey, jobs]) => (
                    <div key={dateKey}>
                      {/* Date Header */}
                      <h3 className="text-white font-semibold text-sm mb-3 sticky top-0 bg-gray-900/95 py-2 px-1 -mx-1 z-10 border-b border-white/10">
                        {formatDateHeader(dateKey)}
                        <span className="text-gray-500 font-normal ml-2">
                          ({jobs.length} job{jobs.length !== 1 ? 's' : ''})
                        </span>
                      </h3>

                      {/* Jobs for this date */}
                      <div className="space-y-3">
                        {jobs.map(job => (
                          <MarketplaceJobCard
                            key={job.id}
                            jobSession={job}
                            onClaim={() => handleClaimJob(job)}
                            onSkip={() => handleSkipJob(job)}
                            isExpanded={expandedJobId === job.id}
                            onToggleExpand={() => toggleExpand(job.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white/10 rounded-2xl shadow-xl p-12 text-center border border-white/20">
                  <div className="text-4xl mb-4">🎉</div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    All caught up!
                  </h3>
                  <p className="text-gray-300 mb-4">
                    No jobs available right now. Check back later!
                  </p>
                  {(skippedJobs.length > 0 || interestedJobs.length > 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetAll}
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    >
                      Reset & Show All Jobs
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* INTERESTED TAB */}
            <TabsContent value="interested" className="mt-0">
              {interestedJobs.length === 0 ? (
                <div className="bg-white/10 rounded-2xl shadow-xl p-12 text-center border border-white/20">
                  <div className="text-4xl mb-4">👀</div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    No interested jobs yet
                  </h3>
                  <p className="text-gray-300">
                    Claim jobs from the marketplace to see them here!
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
          </Tabs>
        ) : (
          /* SWAP WITH TEAM SECTION */
          <div>
            <p className="text-center text-gray-400 text-sm mb-6">
              Jobs your teammates want to swap
            </p>

            {swapLoading ? (
              <LoadingSpinner size="md" />
            ) : swapJobs.length === 0 ? (
              <div className="bg-white/10 rounded-2xl shadow-xl p-12 text-center border border-white/20">
                <ArrowRightLeft className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  No swaps available
                </h3>
                <p className="text-gray-300">
                  When teammates put jobs up for swap, they&apos;ll appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {swapJobs.map(exchange => (
                  <SwapCard
                    key={exchange.id}
                    exchange={exchange}
                    onClaim={() => handleClaimSwap(exchange)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Job List Card for Interested tab
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
  const customerName = job_template.customer?.full_name || job_template.customer?.customer_code || ''

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '—'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h${mins}m`
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '—'
    return `$${price.toFixed(0)}`
  }

  const formatTimeWindow = () => {
    const start = job_template.time_window_start
    const end = job_template.time_window_end
    if (!start && !end) return 'Flexible'
    return `${start?.slice(0, 5) || '—'} - ${end?.slice(0, 5) || '—'}`
  }

  return (
    <div className="bg-white/10 rounded-2xl border border-white/10 overflow-hidden p-4">
      <div className="space-y-2">
        {/* Header - Customer name with status */}
        <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-lg px-3 py-2 flex items-center justify-between border border-white/10">
          <p className="text-white font-bold text-base">{customerName}</p>
          {status === 'pending' && job.status === 'CLAIMED' && (
            <span className="bg-yellow-500/20 text-yellow-300 text-xs font-semibold px-2 py-1 rounded-full">
              Pending
            </span>
          )}
          {job.status === 'APPROVED' && (
            <span className="bg-green-500/20 text-green-300 text-xs font-semibold px-2 py-1 rounded-full">
              Approved
            </span>
          )}
          {job.status === 'REFUSED' && (
            <span className="bg-red-500/20 text-red-300 text-xs font-semibold px-2 py-1 rounded-full">
              Refused
            </span>
          )}
        </div>

        {/* Row 1: Job & Duration */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">Job</p>
              <p className="text-white font-semibold text-sm">{job_template.title}</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">Duration</p>
              <p className="text-white font-semibold text-sm">{formatDuration(job_template.duration_minutes)}</p>
            </div>
          </div>
        </div>

        {/* Row 2: Time Window & Hourly Rate */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">Time Window</p>
              <p className="text-white font-semibold text-sm">{formatTimeWindow()}</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">Hourly Rate</p>
              <p className="text-white font-semibold text-sm">{formatPrice(job_template.price_per_hour)}</p>
            </div>
          </div>
        </div>

        {onRestore && (
          <Button
            variant="outline"
            onClick={onRestore}
            className="w-full bg-white/5 bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            Restore
          </Button>
        )}
      </div>
    </div>
  )
}

// Swap Card Component
function SwapCard({
  exchange,
  onClaim
}: {
  exchange: ExchangeWithDetails
  onClaim: () => void
}) {
  const { job_session, from_employee } = exchange
  const { job_template } = job_session
  const customerName = job_template.customer?.full_name || job_template.customer?.customer_code || ''

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '—'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h${mins}m`
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '—'
    return `$${price.toFixed(0)}`
  }

  const formatTimeWindow = () => {
    const start = job_template.time_window_start
    const end = job_template.time_window_end
    if (!start && !end) return 'Flexible'
    return `${start?.slice(0, 5) || '—'} - ${end?.slice(0, 5) || '—'}`
  }

  return (
    <div className="bg-white/10 rounded-2xl border border-blue-500/30 overflow-hidden p-4">
      <div className="space-y-2">
        {/* Header - Customer name with swap info */}
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-lg px-3 py-2 flex items-center justify-between border border-white/10">
          <p className="text-white font-bold text-base">{customerName}</p>
          <div className="flex items-center gap-1 text-blue-400 text-xs">
            <ArrowRightLeft className="w-3 h-3" />
            <span>{from_employee.full_name}</span>
          </div>
        </div>

        {/* Row 1: Job & Duration */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">Job</p>
              <p className="text-white font-semibold text-sm">{job_template.title}</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">Duration</p>
              <p className="text-white font-semibold text-sm">{formatDuration(job_template.duration_minutes)}</p>
            </div>
          </div>
        </div>

        {/* Row 2: Time Window & Hourly Rate */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">Time Window</p>
              <p className="text-white font-semibold text-sm">{formatTimeWindow()}</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">Hourly Rate</p>
              <p className="text-white font-semibold text-sm">{formatPrice(job_template.price_per_hour)}</p>
            </div>
          </div>
        </div>

        {/* Reason */}
        {exchange.reason && (
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-xs text-gray-400">Reason:</p>
            <p className="text-sm text-gray-300">{exchange.reason}</p>
          </div>
        )}

        {/* Take Job Button */}
        <Button
          onClick={onClaim}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
        >
          Take This Job
        </Button>
      </div>
    </div>
  )
}
