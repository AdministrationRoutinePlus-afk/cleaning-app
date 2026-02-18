'use client'

import { toast } from 'sonner'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MarketplaceJobCard } from '@/components/employee/MarketplaceJobCard'
import type { JobSession, JobTemplate, Customer, Employee, JobExchange, JobSplit, EmployeeWeeklyAvailability, EmployeeSpecificAvailability } from '@/types/database'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'
import { MarketplacePageSkeleton } from '@/components/skeletons/MarketplaceCardSkeleton'
import { parseISO, startOfDay, getDay, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, addMonths } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { ShoppingBag, Users, ArrowRightLeft, Clock, DollarSign, Calendar, CalendarRange, FileText, UserPlus, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import Image from 'next/image'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { SplitRequestCard } from '@/components/employee/SplitRequestCard'

type JobSessionWithDetails = JobSession & {
  job_template: JobTemplate & {
    customer: Customer | null
  }
}

type ExchangeWithDetails = JobExchange & {
  job_session: JobSessionWithDetails
  from_employee: Employee
}

type SplitRequestWithDetails = JobSplit & {
  requested_by_employee: Employee
  job_session: JobSessionWithDetails
}

type SwipeAction = {
  jobSessionId: string
  action: 'interested' | 'skipped'
  timestamp: string
}

export default function EmployeeMarketplacePage() {
  const { t } = useTranslation()
  const [mainTab, setMainTab] = useState<'marketplace' | 'swap'>('marketplace')
  const [marketplaceJobs, setMarketplaceJobs] = useState<JobSessionWithDetails[]>([])
  const [interestedJobs, setInterestedJobs] = useState<JobSessionWithDetails[]>([])
  const [skippedJobs, setSkippedJobs] = useState<JobSessionWithDetails[]>([])
  const [swapJobs, setSwapJobs] = useState<ExchangeWithDetails[]>([])
  const [splitRequests, setSplitRequests] = useState<SplitRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [swapLoading, setSwapLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [employeeStatus, setEmployeeStatus] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('marketplace')
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [claimingJobId, setClaimingJobId] = useState<string | null>(null)

  // View mode & availability filter state
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'customer'>('day')
  const [filterByAvailability, setFilterByAvailability] = useState(false)
  const [availabilityMode, setAvailabilityMode] = useState<'fixed' | 'custom' | null>(null)
  const [weeklyAvail, setWeeklyAvail] = useState<EmployeeWeeklyAvailability[]>([])
  const [specificAvail, setSpecificAvail] = useState<EmployeeSpecificAvailability[]>([])
  const [availLoaded, setAvailLoaded] = useState(false)
  const [monthSelectedDay, setMonthSelectedDay] = useState<Date | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))

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
        .gte('scheduled_date', new Date().toISOString().split('T')[0]) // Hide past jobs
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
      // Also filter out past REFUSED jobs (their date has passed, no longer relevant)
      const todayStr = new Date().toISOString().split('T')[0]
      const uniqueClaimedJobs = (claimedJobs || [])
        .filter(job => job.job_template !== null)
        .filter(job => {
          // Hide REFUSED jobs whose scheduled date has passed
          if (job.status === 'REFUSED' && job.scheduled_date && job.scheduled_date < todayStr) {
            return false
          }
          return true
        })
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
      toast.error(t('Failed to load marketplace jobs'))
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

      // Load incoming split requests (where current employee is the partner)
      const { data: splits, error: splitError } = await supabase
        .from('job_splits')
        .select(`
          *,
          requested_by_employee:employees!job_splits_requested_by_fkey(*),
          job_session:job_sessions(
            *,
            job_template:job_templates(
              *,
              customer:customers(*)
            )
          )
        `)
        .eq('partner_id', employeeId)
        .eq('status', 'PENDING_PARTNER')

      if (!splitError) {
        const validSplits = (splits || []).filter(
          s => s.job_session && s.job_session.job_template
        ) as SplitRequestWithDetails[]
        setSplitRequests(validSplits)
      }
    } catch (error) {
      console.error('Error loading swap jobs:', error)
      toast.error(t('Failed to load swap jobs'))
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

  // Fetch availability data when toggle is turned ON
  useEffect(() => {
    if (!filterByAvailability || !employeeId || availLoaded) return

    const fetchAvailability = async () => {
      try {
        // Get employee's availability_mode
        const { data: emp } = await supabase
          .from('employees')
          .select('availability_mode')
          .eq('id', employeeId)
          .maybeSingle()

        if (!isMountedRef.current) return
        const mode = emp?.availability_mode as 'fixed' | 'custom' | null
        setAvailabilityMode(mode)

        if (mode === 'fixed') {
          const { data } = await supabase
            .from('employee_weekly_availability')
            .select('*')
            .eq('employee_id', employeeId)
          if (!isMountedRef.current) return
          setWeeklyAvail(data || [])
        } else if (mode === 'custom') {
          // Scope to date range of marketplace jobs
          const todayStr = new Date().toISOString().split('T')[0]
          const furthestDate = marketplaceJobs.reduce((max, j) => {
            return j.scheduled_date && j.scheduled_date > max ? j.scheduled_date : max
          }, todayStr)

          const { data } = await supabase
            .from('employee_specific_availability')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('date', todayStr)
            .lte('date', furthestDate)
          if (!isMountedRef.current) return
          setSpecificAvail(data || [])
        }

        setAvailLoaded(true)
      } catch (error) {
        console.error('Error loading availability:', error)
      }
    }

    fetchAvailability()
  }, [filterByAvailability, employeeId, availLoaded, supabase, marketplaceJobs])

  // Reset availability cache when toggle is turned off
  useEffect(() => {
    if (!filterByAvailability) {
      setAvailLoaded(false)
    }
  }, [filterByAvailability])

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

  // Supabase Realtime: watch job_sessions for claimed jobs
  useEffect(() => {
    const channel = supabase
      .channel('marketplace-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'job_sessions',
        filter: 'status=neq.OFFERED'
      }, (payload) => {
        // Remove the job from marketplace if it was previously OFFERED
        if (!isMountedRef.current) return
        setMarketplaceJobs(prev => {
          const existed = prev.some(j => j.id === payload.old?.id)
          if (existed) {
            toast(t('A job was just claimed by another employee'), {
              duration: 3000,
            })
          }
          return prev.filter(j => j.id !== payload.old?.id)
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, t])

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
      const parsed = JSON.parse(history) as SwipeAction[]
      // Filter out entries older than 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const valid = parsed.filter(entry => {
        if (!entry.timestamp) return false
        return new Date(entry.timestamp).getTime() > sevenDaysAgo
      })
      // Clean up expired entries from storage
      if (valid.length !== parsed.length) {
        localStorage.setItem('swipeHistory', JSON.stringify(valid))
      }
      return valid
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

  // Availability-filtered jobs (shared by all 3 views)
  // For multi-day jobs, show the job if the employee is available on ANY day in the range
  const filteredMarketplaceJobs = useMemo(() => {
    if (!filterByAvailability) return marketplaceJobs

    return marketplaceJobs.filter(job => {
      if (!job.scheduled_date) return false
      const startDate = parseISO(job.scheduled_date)
      const endDate = job.scheduled_end_date ? parseISO(job.scheduled_end_date) : startDate

      // Build array of all days in the job's date range
      const jobDays: Date[] = []
      let d = startDate
      while (d <= endDate) {
        jobDays.push(d)
        d = addDays(d, 1)
      }

      if (availabilityMode === 'fixed') {
        return jobDays.some(day => {
          const match = weeklyAvail.find(r => r.day_of_week === getDay(day))
          return match?.is_available === true
        })
      } else if (availabilityMode === 'custom') {
        return jobDays.some(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const match = specificAvail.find(r => r.date === dateStr)
          return match?.is_available === true
        })
      }
      return true // no availability mode set → show all
    })
  }, [marketplaceJobs, filterByAvailability, availabilityMode, weeklyAvail, specificAvail])

  // Group jobs by scheduled_date (Day view)
  const groupedJobs = useMemo(() => {
    const grouped: Record<string, JobSessionWithDetails[]> = {}

    filteredMarketplaceJobs.forEach(job => {
      if (!job.scheduled_date) return
      const dateKey = job.scheduled_date
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(job)
    })

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredMarketplaceJobs])

  // Group jobs by customer (Customer view)
  const customerGroupedJobs = useMemo(() => {
    const grouped: Record<string, JobSessionWithDetails[]> = {}
    filteredMarketplaceJobs.forEach(job => {
      const name = job.job_template.customer?.full_name
                || job.job_template.customer?.customer_code
                || 'Unknown'
      if (!grouped[name]) grouped[name] = []
      grouped[name].push(job)
    })
    // Sort each customer's jobs chronologically
    Object.values(grouped).forEach(jobs => {
      jobs.sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
    })
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredMarketplaceJobs])

  // Month calendar grid (6 rows x 7 cols)
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days: Date[] = []
    let day = calendarStart
    while (day <= calendarEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  // Jobs indexed by date string for month view
  const jobsByDate = useMemo(() => {
    const map: Record<string, JobSessionWithDetails[]> = {}
    filteredMarketplaceJobs.forEach(job => {
      if (!job.scheduled_date) return
      if (!map[job.scheduled_date]) map[job.scheduled_date] = []
      map[job.scheduled_date].push(job)
    })
    return map
  }, [filteredMarketplaceJobs])

  // Jobs for the selected day in month view
  const selectedDayJobs = useMemo(() => {
    if (!monthSelectedDay) return []
    const key = format(monthSelectedDay, 'yyyy-MM-dd')
    return jobsByDate[key] || []
  }, [monthSelectedDay, jobsByDate])

  // Format date for header display
  const formatDateHeader = (dateStr: string) => {
    const date = startOfDay(parseISO(dateStr))
    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.getTime() === today.getTime()) {
      return t('Today')
    } else if (date.getTime() === tomorrow.getTime()) {
      return t('Tomorrow')
    }

    return format(date, 'EEEE d MMMM', { locale: fr })
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
        toast.error(t('Your account must be active to claim jobs.'))
        return
      }

      // Get employee record
      const { data: employee } = await supabase
        .from('employees')
        .select('id, status')
        .eq('user_id', userId)
        .maybeSingle()

      if (!employee) {
        toast.error(t('Employee record not found.'))
        return
      }

      // Double-check employee status from DB
      if (employee.status !== 'ACTIVE') {
        toast.error(t('Your account must be active to claim jobs.'))
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
        toast.error(t('This job has already been claimed by another employee.'))
        setMarketplaceJobs(prev => prev.filter(j => j.id !== job.id))
        return
      }

      // Save to swipe history
      saveSwipeAction(job.id, 'interested')

      // Show claiming animation
      setClaimingJobId(job.id)

      // Wait for animation, then move to interested
      setTimeout(() => {
        setMarketplaceJobs(prev => prev.filter(j => j.id !== job.id))
        setInterestedJobs(prev => [...prev, { ...job, status: 'CLAIMED' as const }])
        setExpandedJobId(null)
        setClaimingJobId(null)
      }, 1800)

    } catch (error) {
      console.error('Error claiming job:', error)
      toast.error(t('Failed to claim job. Please try again.'))
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
        // Unclaim CLAIMED and REFUSED jobs only (APPROVED jobs require employer action)
        await supabase
          .from('job_sessions')
          .update({
            status: 'OFFERED',
            assigned_to: null,
            updated_at: new Date().toISOString()
          })
          .eq('assigned_to', employee.id)
          .in('status', ['CLAIMED', 'REFUSED'])
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

      toast.success(t('Swap request sent! Waiting for employer approval.'))
    } catch (error) {
      console.error('Error claiming swap:', error)
      toast.error(t('Failed to claim swap'))
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
            <span>{t('Job Marketplace')}</span>
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
            <span>{t('Swap with Team')}</span>
            <span className={`text-xs rounded-full px-3 py-1 mt-2 min-h-[24px] ${
              (swapJobs.length + splitRequests.length) > 0
                ? mainTab === 'swap'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-gray-400'
                : 'opacity-0'
            }`}>
              {(swapJobs.length + splitRequests.length) > 0 ? `${swapJobs.length + splitRequests.length}` : '-'}
            </span>
          </button>
        </div>

        {mainTab === 'marketplace' ? (
          /* JOB MARKETPLACE SECTION */
          <div className="w-full">
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
                    <span className="text-center px-2 text-sm">{t('Available')}</span>
                    {filteredMarketplaceJobs.length > 0 && (
                      <span className={`text-xs rounded-full px-2 py-0.5 ${
                        activeTab === 'marketplace' ? 'bg-white/20' : 'bg-white/10'
                      }`}>
                        {filteredMarketplaceJobs.length}
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
                    <span className="text-center px-2 text-sm">{t('Interested')}</span>
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
            {activeTab === 'marketplace' && (
              loading ? (
                <MarketplacePageSkeleton />
              ) : employeeStatus === 'PENDING' ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-8 text-center">
                  <div className="text-4xl mb-4">⏳</div>
                  <h3 className="text-lg font-semibold text-yellow-300 mb-2">
                    {t('Account Pending Activation')}
                  </h3>
                  <p className="text-yellow-200/80 mb-2">
                    {t('Your account is waiting for employer approval.')}
                  </p>
                  <p className="text-sm text-yellow-200/60">
                    {t('Once your account is activated, you\'ll be able to see and claim jobs here.')}
                  </p>
                </div>
              ) : employeeStatus === 'INACTIVE' || employeeStatus === 'BLOCKED' ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
                  <div className="text-4xl mb-4">🚫</div>
                  <h3 className="text-lg font-semibold text-red-300 mb-2">
                    {t('Account')} {employeeStatus === 'BLOCKED' ? t('Blocked') : t('Inactive')}
                  </h3>
                  <p className="text-red-200/80">
                    {t('Please contact your employer to restore access.')}
                  </p>
                </div>
              ) : (
                <>
                  {/* View Mode Selector Bar */}
                  <div className="flex items-center justify-between mb-4">
                    {/* View mode pills */}
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                      {(['day', 'month', 'customer'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => {
                            setViewMode(mode)
                            setExpandedJobId(null)
                            if (mode !== 'month') setMonthSelectedDay(null)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            viewMode === mode
                              ? 'bg-purple-600 text-white shadow-lg'
                              : 'text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {mode === 'day' ? t('Day') : mode === 'month' ? t('Month') : t('Customer')}
                        </button>
                      ))}
                    </div>

                    {/* Availability toggle */}
                    <button
                      onClick={() => setFilterByAvailability(prev => !prev)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                        filterByAvailability
                          ? 'bg-green-600/20 text-green-300 border-green-500/30'
                          : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                        filterByAvailability
                          ? 'bg-green-400 border-green-400'
                          : 'border-gray-500'
                      }`} />
                      {t('My Availability')}
                    </button>
                  </div>

                  {/* Availability info banner */}
                  {filterByAvailability && availLoaded && !availabilityMode && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4 text-center">
                      <p className="text-yellow-300 text-xs">{t('No availability set')}</p>
                    </div>
                  )}
                  {filterByAvailability && availLoaded && availabilityMode && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 text-center">
                      <p className="text-green-300 text-xs">{t('Showing jobs matching your availability')}</p>
                    </div>
                  )}

                  {/* DAY VIEW */}
                  {viewMode === 'day' && (
                    groupedJobs.length > 0 ? (
                      <div className="space-y-6">
                        <p className="text-center text-gray-400 text-sm">
                          {t('Tap a job to view details and claim')}
                        </p>

                        {groupedJobs.map(([dateKey, jobs]) => (
                          <div key={dateKey}>
                            <h3 className="text-white font-semibold text-sm mb-3 sticky top-0 bg-gray-900/95 py-2 px-1 -mx-1 z-10 border-b border-white/10">
                              {formatDateHeader(dateKey)}
                              <span className="text-gray-500 font-normal ml-2">
                                ({jobs.length} {jobs.length !== 1 ? t('jobs') : t('job')})
                              </span>
                            </h3>

                            <div className="space-y-3">
                              {jobs.map(job => (
                                <div key={job.id} className="relative">
                                  <MarketplaceJobCard
                                    jobSession={job}
                                    onClaim={() => handleClaimJob(job)}
                                    onSkip={() => handleSkipJob(job)}
                                    isExpanded={expandedJobId === job.id}
                                    onToggleExpand={() => toggleExpand(job.id)}
                                  />
                                  {claimingJobId === job.id && (
                                    <div className="absolute inset-0 bg-green-600/90 rounded-2xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 z-20">
                                      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 animate-bounce">
                                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                      <p className="text-white font-bold text-lg">{t('Job Claimed!')}</p>
                                      <p className="text-green-100 text-sm mt-1">{t('Waiting for approval')}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <MarketplaceEmptyState
                        filterByAvailability={filterByAvailability}
                        skippedJobs={skippedJobs}
                        interestedJobs={interestedJobs}
                        onReset={handleResetAll}
                      />
                    )
                  )}

                  {/* MONTH VIEW */}
                  {viewMode === 'month' && (
                    <div className="space-y-4">
                      {/* Month navigation */}
                      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-3">
                          <button
                            onClick={() => {
                              const prev = addMonths(currentMonth, -1)
                              if (prev >= startOfMonth(new Date())) {
                                setCurrentMonth(prev)
                                setMonthSelectedDay(null)
                              }
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              startOfMonth(currentMonth) <= startOfMonth(new Date())
                                ? 'text-gray-600 cursor-not-allowed'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                            disabled={startOfMonth(currentMonth) <= startOfMonth(new Date())}
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>

                          <button
                            onClick={() => {
                              setCurrentMonth(startOfMonth(new Date()))
                              setMonthSelectedDay(null)
                            }}
                            className="text-center"
                          >
                            <span className="text-white font-semibold text-sm capitalize">
                              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              setCurrentMonth(addMonths(currentMonth, 1))
                              setMonthSelectedDay(null)
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Day of week headers */}
                        <div className="grid grid-cols-7 gap-1 px-3 mb-1">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                            <div key={d} className="text-center text-[10px] font-medium text-gray-500 py-1">
                              {t(d)}
                            </div>
                          ))}
                        </div>

                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-1 px-3 pb-3">
                          {monthDays.map((day) => {
                            const dateKey = format(day, 'yyyy-MM-dd')
                            const dayJobs = jobsByDate[dateKey] || []
                            const isInMonth = isSameMonth(day, currentMonth)
                            const isToday = isSameDay(day, new Date())
                            const isSelected = monthSelectedDay ? isSameDay(day, monthSelectedDay) : false
                            const isPast = day < startOfDay(new Date())

                            return (
                              <button
                                key={dateKey}
                                onClick={() => {
                                  if (!isInMonth || isPast) return
                                  setMonthSelectedDay(isSelected ? null : day)
                                }}
                                disabled={!isInMonth || isPast}
                                className={`flex flex-col items-center justify-start rounded-lg p-1 min-h-[48px] transition-all ${
                                  isSelected
                                    ? 'bg-purple-600/30 border border-purple-400'
                                    : isToday
                                      ? 'bg-white/10 border border-white/20'
                                      : isInMonth && !isPast
                                        ? 'hover:bg-white/5 border border-transparent'
                                        : 'border border-transparent'
                                } ${!isInMonth || isPast ? 'opacity-30' : ''}`}
                              >
                                <span className={`text-xs font-semibold ${
                                  isSelected ? 'text-purple-300' : isToday ? 'text-white' : 'text-gray-400'
                                }`}>
                                  {format(day, 'd')}
                                </span>

                                {dayJobs.length > 0 && isInMonth && (
                                  <span className={`mt-1 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                                    isSelected
                                      ? 'bg-purple-500/40 text-purple-200'
                                      : 'bg-green-500/30 text-green-300'
                                  }`}>
                                    {dayJobs.length}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Selected day detail panel */}
                      {monthSelectedDay && (
                        <div className="space-y-3">
                          <h3 className="text-white font-semibold text-sm border-b border-white/10 pb-2">
                            {format(monthSelectedDay, 'EEEE d MMMM', { locale: fr })}
                            <span className="text-gray-500 font-normal ml-2">
                              ({selectedDayJobs.length} {selectedDayJobs.length !== 1 ? t('jobs') : t('job')})
                            </span>
                          </h3>

                          {selectedDayJobs.length > 0 ? (
                            selectedDayJobs.map(job => (
                              <div key={job.id} className="relative">
                                <MarketplaceJobCard
                                  jobSession={job}
                                  onClaim={() => handleClaimJob(job)}
                                  onSkip={() => handleSkipJob(job)}
                                  isExpanded={expandedJobId === job.id}
                                  onToggleExpand={() => toggleExpand(job.id)}
                                />
                                {claimingJobId === job.id && (
                                  <div className="absolute inset-0 bg-green-600/90 rounded-2xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 z-20">
                                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 animate-bounce">
                                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                    <p className="text-white font-bold text-lg">{t('Job Claimed!')}</p>
                                    <p className="text-green-100 text-sm mt-1">{t('Waiting for approval')}</p>
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="bg-white/5 rounded-xl p-6 text-center border border-white/10">
                              <p className="text-gray-400 text-sm">{t('No jobs on this day')}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* If no day selected, show hint */}
                      {!monthSelectedDay && filteredMarketplaceJobs.length > 0 && (
                        <p className="text-center text-gray-400 text-sm">
                          {t('Tap a job to view details and claim')}
                        </p>
                      )}

                      {filteredMarketplaceJobs.length === 0 && (
                        <MarketplaceEmptyState
                          filterByAvailability={filterByAvailability}
                          skippedJobs={skippedJobs}
                          interestedJobs={interestedJobs}
                          onReset={handleResetAll}
                        />
                      )}
                    </div>
                  )}

                  {/* CUSTOMER VIEW */}
                  {viewMode === 'customer' && (
                    customerGroupedJobs.length > 0 ? (
                      <div className="space-y-6">
                        <p className="text-center text-gray-400 text-sm">
                          {t('Tap a job to view details and claim')}
                        </p>

                        {customerGroupedJobs.map(([customerName, jobs]) => (
                          <div key={customerName}>
                            <h3 className="text-white font-semibold text-sm mb-3 sticky top-0 bg-gray-900/95 py-2 px-1 -mx-1 z-10 border-b border-white/10 flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-purple-400" />
                              {customerName}
                              <span className="text-gray-500 font-normal">
                                ({jobs.length} {jobs.length !== 1 ? t('jobs') : t('job')})
                              </span>
                            </h3>

                            <div className="space-y-3">
                              {jobs.map(job => (
                                <div key={job.id} className="relative">
                                  <MarketplaceJobCard
                                    jobSession={job}
                                    onClaim={() => handleClaimJob(job)}
                                    onSkip={() => handleSkipJob(job)}
                                    isExpanded={expandedJobId === job.id}
                                    onToggleExpand={() => toggleExpand(job.id)}
                                  />
                                  {claimingJobId === job.id && (
                                    <div className="absolute inset-0 bg-green-600/90 rounded-2xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 z-20">
                                      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 animate-bounce">
                                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                      <p className="text-white font-bold text-lg">{t('Job Claimed!')}</p>
                                      <p className="text-green-100 text-sm mt-1">{t('Waiting for approval')}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <MarketplaceEmptyState
                        filterByAvailability={filterByAvailability}
                        skippedJobs={skippedJobs}
                        interestedJobs={interestedJobs}
                        onReset={handleResetAll}
                      />
                    )
                  )}
                </>
              )
            )}

            {/* INTERESTED TAB */}
            {activeTab === 'interested' && (
              interestedJobs.length === 0 ? (
                <div className="bg-white/10 rounded-2xl shadow-xl p-12 text-center border border-white/20">
                  <div className="text-4xl mb-4">👀</div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {t('No interested jobs yet')}
                  </h3>
                  <p className="text-gray-300">
                    {t('Claim jobs from the marketplace to see them here!')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {interestedJobs.map(job => (
                    <JobListCard key={job.id} job={job} status="pending" />
                  ))}
                </div>
              )
            )}
          </div>
        ) : (
          /* SWAP WITH TEAM SECTION */
          <div>
            <p className="text-center text-gray-400 text-sm mb-6">
              {t('Jobs your teammates want to swap')}
            </p>

            {swapLoading ? (
              <LoadingSpinner size="md" />
            ) : (swapJobs.length === 0 && splitRequests.length === 0) ? (
              <div className="bg-white/10 rounded-2xl shadow-xl p-12 text-center border border-white/20">
                <ArrowRightLeft className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t('No swaps available')}
                </h3>
                <p className="text-gray-300">
                  {t('When teammates put jobs up for swap, they\'ll appear here.')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Split Requests */}
                {splitRequests.length > 0 && (
                  <>
                    <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      {t('Split Requests')}
                    </h3>
                    {splitRequests.map(split => (
                      <SplitRequestCard
                        key={split.id}
                        split={split}
                        onUpdate={loadSwapJobs}
                      />
                    ))}
                  </>
                )}

                {/* Exchange Swaps */}
                {swapJobs.length > 0 && (
                  <>
                    {splitRequests.length > 0 && (
                      <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2 mt-4">
                        <ArrowRightLeft className="w-4 h-4" />
                        {t('Job Exchanges')}
                      </h3>
                    )}
                    {swapJobs.map(exchange => (
                      <SwapCard
                        key={exchange.id}
                        exchange={exchange}
                        onClaim={() => handleClaimSwap(exchange)}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Empty state for marketplace views
function MarketplaceEmptyState({
  filterByAvailability,
  skippedJobs,
  interestedJobs,
  onReset
}: {
  filterByAvailability: boolean
  skippedJobs: JobSessionWithDetails[]
  interestedJobs: JobSessionWithDetails[]
  onReset: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="bg-white/10 rounded-2xl shadow-xl p-12 text-center border border-white/20">
      <div className="text-4xl mb-4">🎉</div>
      <h3 className="text-lg font-semibold text-white mb-2">
        {t('All caught up!')}
      </h3>
      <p className="text-gray-300 mb-4">
        {filterByAvailability
          ? t('Showing jobs matching your availability')
          : t('No jobs available right now. Check back later!')
        }
      </p>
      {(skippedJobs.length > 0 || interestedJobs.length > 0) && (
        <Button
          size="sm"
          onClick={onReset}
          className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
        >
          {t('Reset & Show All Jobs')}
        </Button>
      )}
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
  const { t } = useTranslation()
  const { job_template } = job
  const customerName = job_template.customer?.full_name || job_template.customer?.customer_code || ''

  // Multi-day detection
  const isMultiDay = job.scheduled_date && job.scheduled_end_date &&
    job.scheduled_end_date !== job.scheduled_date

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
    if (!start && !end) return t('Flexible')
    return `${start?.slice(0, 5) || '—'} - ${end?.slice(0, 5) || '—'}`
  }

  const formatScheduledDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    if (isMultiDay) {
      const start = parseISO(job.scheduled_date!)
      const end = parseISO(job.scheduled_end_date!)
      const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      return `${startStr} → ${endStr}`
    }
    const date = parseISO(dateStr)
    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateDay = startOfDay(date)

    if (dateDay.getTime() === today.getTime()) return t('Today')
    if (dateDay.getTime() === tomorrow.getTime()) return t('Tomorrow')

    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="bg-white/10 rounded-2xl border border-white/10 overflow-hidden p-4">
      <div className="space-y-2">
        {/* Header - Customer name with status */}
        <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-lg px-3 py-2 flex items-center justify-between border border-white/10">
          <div className="flex items-center gap-2">
            <p className="text-white font-bold text-base">{customerName}</p>
            {isMultiDay && (
              <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2 py-1 rounded-full border border-indigo-500/30 flex items-center gap-1">
                <CalendarRange className="w-3 h-3" />
                {t('Multi-day')}
              </span>
            )}
          </div>
          {status === 'pending' && job.status === 'CLAIMED' && (
            <span className="bg-yellow-500/20 text-yellow-300 text-xs font-semibold px-2 py-1 rounded-full">
              {t('Pending')}
            </span>
          )}
          {job.status === 'APPROVED' && (
            <span className="bg-green-500/20 text-green-300 text-xs font-semibold px-2 py-1 rounded-full">
              {t('Approved')}
            </span>
          )}
          {job.status === 'REFUSED' && (
            <span className="bg-red-500/20 text-red-300 text-xs font-semibold px-2 py-1 rounded-full">
              {t('Refused')}
            </span>
          )}
        </div>

        {/* Scheduled Date */}
        <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-gray-300 text-xs">{t('Scheduled Date')}</p>
            <p className="text-white font-semibold text-sm">{formatScheduledDate(job.scheduled_date)}</p>
          </div>
        </div>

        {/* Row 1: Job & Duration */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">{t('Job')}</p>
              <p className="text-white font-semibold text-sm">{job_template.title}</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">{t('Duration')}</p>
              <p className="text-white font-semibold text-sm">{formatDuration(job_template.duration_minutes)}</p>
            </div>
          </div>
        </div>

        {/* Row 2: Time Window & Hourly Rate */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">{t('Time Window')}</p>
              <p className="text-white font-semibold text-sm">{formatTimeWindow()}</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">{t('Hourly Rate')}</p>
              <p className="text-white font-semibold text-sm">{formatPrice(job_template.price_per_hour)}</p>
            </div>
          </div>
        </div>

        {onRestore && (
          <Button
            onClick={onRestore}
            className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20"
          >
            {t('Restore')}
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
  const { t } = useTranslation()
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
    if (!start && !end) return t('Flexible')
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
              <p className="text-gray-300 text-xs">{t('Job')}</p>
              <p className="text-white font-semibold text-sm">{job_template.title}</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">{t('Duration')}</p>
              <p className="text-white font-semibold text-sm">{formatDuration(job_template.duration_minutes)}</p>
            </div>
          </div>
        </div>

        {/* Row 2: Time Window & Hourly Rate */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">{t('Time Window')}</p>
              <p className="text-white font-semibold text-sm">{formatTimeWindow()}</p>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-gray-300 text-xs">{t('Hourly Rate')}</p>
              <p className="text-white font-semibold text-sm">{formatPrice(job_template.price_per_hour)}</p>
            </div>
          </div>
        </div>

        {/* Reason */}
        {exchange.reason && (
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-xs text-gray-400">{t('Reason:')}</p>
            <p className="text-sm text-gray-300">{exchange.reason}</p>
          </div>
        )}

        {/* Take Job Button */}
        <Button
          onClick={onClaim}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
        >
          {t('Take This Job')}
        </Button>
      </div>
    </div>
  )
}
