'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import type { JobSessionFull, JobSession, JobTemplate, Customer, JobSplit, Employee, JobSplitStatus, EmployeeWeeklyAvailability, EmployeeSpecificAvailability } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { MyJobCard } from '@/components/employee/MyJobCard'
import { MarketplaceJobCard } from '@/components/employee/MarketplaceJobCard'
import { SplitRequestCard } from '@/components/employee/SplitRequestCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { MarketplacePageSkeleton } from '@/components/skeletons/MarketplaceCardSkeleton'
import { Briefcase, History, Play, ThumbsUp, Clock, CheckCircle, XCircle, AlertTriangle, ShoppingBag, Calendar, DollarSign, FileText, Users, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { parseISO, startOfDay, getDay, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, addMonths } from 'date-fns'
import { fr } from 'date-fns/locale/fr'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type JobSessionWithDetails = JobSession & {
  job_template: JobTemplate & {
    customer: Customer | null
  }
}

type TopTab = 'find' | 'myjobs' | 'history' | 'splits'

interface SplitRequestWithDetails extends JobSplit {
  requested_by_employee: Employee
  partner_employee: Employee
  job_session: JobSession & {
    job_template: JobTemplate & {
      customer: Customer | null
    }
  }
}
type SubTab = 'active' | 'upcoming' | 'pending' | 'completed' | 'refused' | 'issues'

type SwipeAction = {
  jobSessionId: string
  action: 'interested' | 'skipped'
  timestamp: string
}

export default function EmployeeJobsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<JobSessionFull[]>([])
  const [topTab, setTopTab] = useState<TopTab>('myjobs')
  const [subTab, setSubTab] = useState<SubTab>('active')
  const contentRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  // Find Jobs state
  const [marketplaceJobs, setMarketplaceJobs] = useState<JobSessionWithDetails[]>([])
  const [marketplaceLoading, setMarketplaceLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [employeeStatus, setEmployeeStatus] = useState<string | null>(null)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [claimingJobId, setClaimingJobId] = useState<string | null>(null)
  const [skippedJobIds, setSkippedJobIds] = useState<Set<string>>(new Set())
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)

  // View mode & availability filter state
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'customer'>('day')
  const [filterByAvailability, setFilterByAvailability] = useState(false)
  const [availabilityMode, setAvailabilityMode] = useState<'fixed' | 'custom' | null>(null)
  const [weeklyAvail, setWeeklyAvail] = useState<EmployeeWeeklyAvailability[]>([])
  const [specificAvail, setSpecificAvail] = useState<EmployeeSpecificAvailability[]>([])
  const [availLoaded, setAvailLoaded] = useState(false)
  const [monthSelectedDay, setMonthSelectedDay] = useState<Date | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Splits tab state
  const [incomingSplits, setIncomingSplits] = useState<SplitRequestWithDetails[]>([])
  const [outgoingSplits, setOutgoingSplits] = useState<SplitRequestWithDetails[]>([])
  const [splitsLoading, setSplitsLoading] = useState(false)
  const [cancelingSplitId, setCancelingSplitId] = useState<string | null>(null)

  // Claim confirmation dialog state
  const [confirmJob, setConfirmJob] = useState<JobSessionWithDetails | null>(null)

  // Load user on mount
  useEffect(() => {
    isMountedRef.current = true
    loadUser()
    return () => { isMountedRef.current = false }
  }, [])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!isMountedRef.current) return
    if (user) {
      setUserId(user.id)
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

  // Fetch My Jobs
  const fetchJobs = async () => {
    setLoading(true)
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) return

      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (employeeError || !employeeData) return

      let { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          )
        `)
        .or(`assigned_to.eq.${employeeData.id},split_with.eq.${employeeData.id}`)
        .order('scheduled_date', { ascending: true })

      if (error) {
        const fallback = await supabase
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

        data = fallback.data
        error = fallback.error
      }

      if (error) return
      if (!isMountedRef.current) return

      const typedData = data as unknown as JobSessionFull[]
      setJobs(typedData || [])
    } catch (error) {
      console.error('Error in fetchJobs:', error)
      toast.error(t('Failed to load your jobs'))
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }

  // Load marketplace (Find Jobs) data
  const loadMarketplaceData = useCallback(async () => {
    if (!userId) return
    setMarketplaceLoading(true)
    try {
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
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', new Date().toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true })

      if (offeredError) throw offeredError

      const swipeHistory = getSwipeHistory()
      const swipedIds = new Set(swipeHistory.map(s => s.jobSessionId))
      setSkippedJobIds(new Set(swipeHistory.filter(s => s.action === 'skipped').map(s => s.jobSessionId)))

      const availableJobs = (offeredJobs || [])
        .filter(job => job.job_template !== null)
        .filter(job => !swipedIds.has(job.id))
        .filter((job, index, self) => index === self.findIndex(j => j.id === job.id)) as JobSessionWithDetails[]

      setMarketplaceJobs(availableJobs)
    } catch (error) {
      console.error('Error loading marketplace jobs:', error)
      toast.error(t('Failed to load marketplace jobs'))
    } finally {
      setMarketplaceLoading(false)
    }
  }, [userId, supabase])

  // Load splits data
  const loadSplitsData = useCallback(async () => {
    if (!employeeId) return
    setSplitsLoading(true)
    try {
      // Incoming: where I'm the partner and status is PENDING_PARTNER
      const { data: incoming, error: inErr } = await supabase
        .from('job_splits')
        .select(`
          *,
          requested_by_employee:employees!job_splits_requested_by_fkey(*),
          partner_employee:employees!job_splits_partner_id_fkey(*),
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
        .order('created_at', { ascending: false })

      if (inErr) throw inErr

      // Outgoing: where I'm the requester
      const { data: outgoing, error: outErr } = await supabase
        .from('job_splits')
        .select(`
          *,
          requested_by_employee:employees!job_splits_requested_by_fkey(*),
          partner_employee:employees!job_splits_partner_id_fkey(*),
          job_session:job_sessions(
            *,
            job_template:job_templates(
              *,
              customer:customers(*)
            )
          )
        `)
        .eq('requested_by', employeeId)
        .order('created_at', { ascending: false })

      if (outErr) throw outErr

      if (isMountedRef.current) {
        setIncomingSplits((incoming || []) as unknown as SplitRequestWithDetails[])
        setOutgoingSplits((outgoing || []) as unknown as SplitRequestWithDetails[])
      }
    } catch (error) {
      console.error('Error loading splits:', error)
      toast.error(t('Failed to load split requests'))
    } finally {
      if (isMountedRef.current) setSplitsLoading(false)
    }
  }, [employeeId, supabase])

  const handleCancelSplit = async (splitId: string) => {
    if (!confirm(t('Cancel this split request?'))) return
    setCancelingSplitId(splitId)
    try {
      const { error } = await supabase
        .from('job_splits')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', splitId)

      if (error) throw error
      toast.success(t('Split request cancelled'))
      loadSplitsData()
    } catch (error) {
      console.error('Error canceling split:', error)
      toast.error(t('Failed to cancel split request'))
    } finally {
      setCancelingSplitId(null)
    }
  }

  // Load jobs on mount + when userId changes
  useEffect(() => {
    if (userId) {
      fetchJobs()
    }
  }, [userId])

  // Load marketplace data when Find Jobs tab is active
  useEffect(() => {
    if (topTab === 'find' && userId) {
      loadMarketplaceData()
    }
  }, [topTab, userId, loadMarketplaceData])

  // Load splits data when Splits tab is active
  useEffect(() => {
    if (topTab === 'splits' && employeeId) {
      loadSplitsData()
    }
  }, [topTab, employeeId, loadSplitsData])

  // Cross-tab synchronization
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('swipe-history-sync')
      broadcastChannelRef.current = channel
      channel.onmessage = () => {
        if (userId && topTab === 'find') loadMarketplaceData()
      }
      return () => { channel.close(); broadcastChannelRef.current = null }
    }
  }, [userId, topTab, loadMarketplaceData])

  // Realtime for marketplace
  useEffect(() => {
    const channel = supabase
      .channel('jobs-marketplace-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'job_sessions',
        filter: 'status=neq.OFFERED'
      }, (payload) => {
        if (!isMountedRef.current) return
        setMarketplaceJobs(prev => {
          const existed = prev.some(j => j.id === payload.old?.id)
          if (existed) {
            toast(t('A job was just claimed by another employee'), { duration: 3000 })
          }
          return prev.filter(j => j.id !== payload.old?.id)
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, t])

  // Fetch availability data when toggle is turned ON
  useEffect(() => {
    if (!filterByAvailability || !employeeId || availLoaded) return

    const fetchAvailability = async () => {
      try {
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
      setAvailabilityMode(null)
      setWeeklyAvail([])
      setSpecificAvail([])
    }
  }, [filterByAvailability])

  // Scroll to top on tab change
  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-container')
    if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' })
  }, [topTab, subTab])

  // --- LocalStorage swipe history ---
  const getSwipeHistory = (): SwipeAction[] => {
    if (typeof window === 'undefined') return []
    const history = localStorage.getItem('swipeHistory')
    if (!history) return []
    try {
      const parsed = JSON.parse(history) as SwipeAction[]
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const valid = parsed.filter(entry => entry.timestamp && new Date(entry.timestamp).getTime() > sevenDaysAgo)
      if (valid.length !== parsed.length) localStorage.setItem('swipeHistory', JSON.stringify(valid))
      return valid
    } catch {
      localStorage.removeItem('swipeHistory')
      return []
    }
  }

  const saveSwipeAction = (jobSessionId: string, action: 'interested' | 'skipped') => {
    const history = getSwipeHistory()
    history.push({ jobSessionId, action, timestamp: new Date().toISOString() })
    localStorage.setItem('swipeHistory', JSON.stringify(history))
    broadcastChannelRef.current?.postMessage({ type: 'swipe-update' })
  }

  const removeFromSwipeHistory = (jobSessionId: string) => {
    const history = getSwipeHistory()
    const updated = history.filter(h => h.jobSessionId !== jobSessionId)
    localStorage.setItem('swipeHistory', JSON.stringify(updated))
    broadcastChannelRef.current?.postMessage({ type: 'swipe-update' })
  }

  // --- Marketplace actions ---
  const toggleExpand = (jobId: string) => {
    setExpandedJobId(prev => prev === jobId ? null : jobId)
  }

  // Open claim confirmation dialog (#9)
  const handleClaimRequest = (job: JobSessionWithDetails) => {
    setConfirmJob(job)
  }

  // Actual claim logic
  const handleClaimJob = async (job: JobSessionWithDetails) => {
    setConfirmJob(null)
    try {
      if (employeeStatus !== 'ACTIVE') {
        toast.error(t('Your account must be active to claim jobs.'))
        return
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id, status')
        .eq('user_id', userId)
        .maybeSingle()

      if (!employee) {
        toast.error(t('Employee record not found.'))
        return
      }

      if (employee.status !== 'ACTIVE') {
        toast.error(t('Your account must be active to claim jobs.'))
        return
      }

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

      if (!updated || updated.length === 0) {
        toast.error(t('This job has already been claimed by another employee.'))
        setMarketplaceJobs(prev => prev.filter(j => j.id !== job.id))
        return
      }

      saveSwipeAction(job.id, 'interested')
      setClaimingJobId(job.id)

      setTimeout(() => {
        setMarketplaceJobs(prev => prev.filter(j => j.id !== job.id))
        setExpandedJobId(null)
        setClaimingJobId(null)
        // Refresh My Jobs to include the newly claimed job
        fetchJobs()
      }, 1800)

    } catch (error) {
      console.error('Error claiming job:', error)
      toast.error(t('Failed to claim job. Please try again.'))
    }
  }

  // Skip job with undo toast (#10)
  const handleSkipJob = (job: JobSessionWithDetails) => {
    saveSwipeAction(job.id, 'skipped')
    setSkippedJobIds(prev => new Set([...prev, job.id]))
    setMarketplaceJobs(prev => prev.filter(j => j.id !== job.id))
    setExpandedJobId(null)

    toast(t('Job skipped'), {
      action: {
        label: t('Undo'),
        onClick: () => {
          removeFromSwipeHistory(job.id)
          setSkippedJobIds(prev => {
            const next = new Set(prev)
            next.delete(job.id)
            return next
          })
          setMarketplaceJobs(prev => {
            const updated = [...prev, job]
            return updated.sort((a, b) => {
              if (!a.scheduled_date) return 1
              if (!b.scheduled_date) return -1
              return a.scheduled_date.localeCompare(b.scheduled_date)
            })
          })
        },
      },
      duration: 5000,
    })
  }

  // Availability-filtered marketplace jobs (shared by all views)
  // For multi-day jobs, show the job if the employee is available on ANY day in the range
  // If no availability records exist, show all jobs (don't hide everything)
  const filteredMarketplaceJobs = useMemo(() => {
    if (!filterByAvailability || !availLoaded) return marketplaceJobs

    // No availability mode or no records → show all
    if (!availabilityMode) return marketplaceJobs
    if (availabilityMode === 'fixed' && weeklyAvail.length === 0) return marketplaceJobs
    if (availabilityMode === 'custom' && specificAvail.length === 0) return marketplaceJobs

    return marketplaceJobs.filter(job => {
      if (!job.scheduled_date) return false
      const startDate = parseISO(job.scheduled_date)
      const endDate = job.scheduled_end_date ? parseISO(job.scheduled_end_date) : startDate

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
      return true
    })
  }, [marketplaceJobs, filterByAvailability, availLoaded, availabilityMode, weeklyAvail, specificAvail])

  // Group filtered jobs by date (Day view)
  const groupedMarketplaceJobs = useMemo(() => {
    const grouped: Record<string, JobSessionWithDetails[]> = {}
    filteredMarketplaceJobs.forEach(job => {
      if (!job.scheduled_date) return
      const dateKey = job.scheduled_date
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(job)
    })
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredMarketplaceJobs])

  // Group filtered jobs by customer (Customer view)
  const customerGroupedJobs = useMemo(() => {
    const grouped: Record<string, JobSessionWithDetails[]> = {}
    filteredMarketplaceJobs.forEach(job => {
      const name = job.job_template.customer?.full_name
                || job.job_template.customer?.customer_code
                || 'Unknown'
      if (!grouped[name]) grouped[name] = []
      grouped[name].push(job)
    })
    Object.values(grouped).forEach(jobs => {
      jobs.sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
    })
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredMarketplaceJobs])

  // Month calendar grid
  const monthDays = useMemo(() => {
    const mStart = startOfMonth(currentMonth)
    const mEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(mStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(mEnd, { weekStartsOn: 1 })
    const days: Date[] = []
    let day = calendarStart
    while (day <= calendarEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [currentMonth])

  // Jobs indexed by date for month view
  const jobsByDate = useMemo(() => {
    const map: Record<string, JobSessionWithDetails[]> = {}
    filteredMarketplaceJobs.forEach(job => {
      if (!job.scheduled_date) return
      if (!map[job.scheduled_date]) map[job.scheduled_date] = []
      map[job.scheduled_date].push(job)
    })
    return map
  }, [filteredMarketplaceJobs])

  // Jobs for selected day in month view
  const selectedDayJobs = useMemo(() => {
    if (!monthSelectedDay) return []
    const key = format(monthSelectedDay, 'yyyy-MM-dd')
    return jobsByDate[key] || []
  }, [monthSelectedDay, jobsByDate])

  // Week view: 7 days from currentWeekStart
  const weekDays = useMemo(() => {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i))
    }
    return days
  }, [currentWeekStart])

  const formatDateHeader = (dateStr: string) => {
    const date = startOfDay(parseISO(dateStr))
    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (date.getTime() === today.getTime()) return t('Today')
    if (date.getTime() === tomorrow.getTime()) return t('Tomorrow')
    return format(date, 'EEEE d MMMM', { locale: fr })
  }

  // --- My Jobs logic ---
  const isJobMissedOrOverdue = (session: JobSessionFull) => {
    if (session.status === 'MISSED' || session.status === 'OVERDUE') return true
    if (!session.scheduled_date) return false
    const now = new Date()
    const jobTemplate = session.job_template
    if (jobTemplate?.time_window_end) {
      const [endH, endM] = jobTemplate.time_window_end.split(':').map(Number)
      const endDate = new Date(session.scheduled_end_date || session.scheduled_date)
      endDate.setHours(endH, endM, 0, 0)
      if (now > endDate) return session.status === 'APPROVED' || session.status === 'IN_PROGRESS'
    } else {
      const endOfDay = new Date(session.scheduled_end_date || session.scheduled_date)
      endOfDay.setHours(23, 59, 59, 999)
      if (now > endOfDay) return session.status === 'APPROVED' || session.status === 'IN_PROGRESS'
    }
    return false
  }

  const pendingJobs = jobs.filter(job => job.status === 'CLAIMED')
  const approvedJobs = jobs.filter(job => job.status === 'APPROVED' && !isJobMissedOrOverdue(job))
  const inProgressJobs = jobs.filter(job => job.status === 'IN_PROGRESS' && !isJobMissedOrOverdue(job))
  const completedJobs = jobs.filter(job => job.status === 'COMPLETED' || job.status === 'EVALUATED')
  const refusedJobs = jobs.filter(job => job.status === 'REFUSED')
  const issueJobs = jobs.filter(job => job.status === 'MISSED' || job.status === 'OVERDUE' || isJobMissedOrOverdue(job))

  const counts = {
    pending: pendingJobs.length,
    approved: approvedJobs.length,
    inProgress: inProgressJobs.length,
    completed: completedJobs.length,
    refused: refusedJobs.length,
    issues: issueJobs.length
  }

  const currentCount = counts.inProgress + counts.approved + counts.pending
  const historyCount = counts.completed + counts.refused + counts.issues

  const pendingSplitsCount = incomingSplits.length + outgoingSplits.filter(s => s.status === 'PENDING_PARTNER' || s.status === 'PENDING_EMPLOYER').length

  const handleTopTabChange = (tab: TopTab) => {
    setTopTab(tab)
    if (tab === 'myjobs') setSubTab('active')
    else if (tab === 'history') setSubTab('completed')
  }

  const getJobsForSubTab = () => {
    switch (subTab) {
      case 'active': return inProgressJobs
      case 'upcoming': return approvedJobs
      case 'pending': return pendingJobs
      case 'completed': return completedJobs
      case 'refused': return refusedJobs
      case 'issues': return issueJobs
      default: return []
    }
  }

  const getEmptyMessage = () => {
    switch (subTab) {
      case 'active': return t('No jobs in progress')
      case 'upcoming': return t('No upcoming jobs')
      case 'pending': return t('No pending approvals')
      case 'completed': return t('No completed jobs yet')
      case 'refused': return t('No refused jobs')
      case 'issues': return t('No issues')
      default: return t('No jobs')
    }
  }

  const currentSubTabs = [
    { id: 'active' as SubTab, label: 'Active', count: counts.inProgress, color: 'blue', icon: Play },
    { id: 'upcoming' as SubTab, label: 'Upcoming', count: counts.approved, color: 'green', icon: ThumbsUp },
    { id: 'pending' as SubTab, label: 'Pending', count: counts.pending, color: 'amber', icon: Clock }
  ]

  const historySubTabs = [
    { id: 'completed' as SubTab, label: 'Completed', count: counts.completed, color: 'purple', icon: CheckCircle },
    { id: 'refused' as SubTab, label: 'Refused', count: counts.refused, color: 'red', icon: XCircle },
    { id: 'issues' as SubTab, label: 'Issues', count: counts.issues, color: 'orange', icon: AlertTriangle }
  ]

  const getSubTabStyle = (color: string, isActive: boolean) => {
    if (!isActive) return 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
    switch (color) {
      case 'blue': return 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
      case 'green': return 'bg-gradient-to-br from-green-600 to-green-800 text-white shadow-lg shadow-green-500/30 border-2 border-green-400'
      case 'amber': return 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg shadow-amber-500/30 border-2 border-amber-400'
      case 'purple': return 'bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-400'
      case 'red': return 'bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg shadow-red-500/30 border-2 border-red-400'
      case 'orange': return 'bg-gradient-to-br from-orange-600 to-orange-800 text-white shadow-lg shadow-orange-500/30 border-2 border-orange-400'
      default: return 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
    }
  }

  const activeSubTabs = topTab === 'myjobs' ? currentSubTabs : historySubTabs
  const currentJobs = getJobsForSubTab()

  // Helper for confirmation dialog
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '\u2014'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '\u2014'
    return `$${price.toFixed(0)}/hr`
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-lg mx-auto p-4">
        {/* Top Tabs: 2x2 colored grid */}
        <div className="bg-white/10 rounded-2xl border border-white/20 p-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'find' as TopTab, label: 'Find Jobs', icon: ShoppingBag, color: 'green', badge: filteredMarketplaceJobs.length > 0 ? filteredMarketplaceJobs.length : undefined },
              { key: 'myjobs' as TopTab, label: 'My Jobs', icon: Briefcase, color: 'blue', badge: currentCount > 0 ? currentCount : undefined },
              { key: 'history' as TopTab, label: 'History', icon: History, color: 'purple', badge: historyCount > 0 ? historyCount : undefined },
              { key: 'splits' as TopTab, label: 'Splits', icon: Users, color: 'orange', badge: pendingSplitsCount > 0 ? pendingSplitsCount : undefined },
            ]).map((tab) => {
              const isActive = topTab === tab.key
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTopTabChange(tab.key)}
                  className={`aspect-[2/1] flex flex-col items-center justify-center gap-1.5 rounded-2xl font-bold transition-all ${
                    isActive
                      ? getSubTabStyle(tab.color, true)
                      : 'bg-white/5 text-gray-400 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  <span className="text-center text-sm">{t(tab.label)}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`text-xs rounded-full px-2 py-0.5 ${
                      isActive ? 'bg-white/20' : 'bg-white/10'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* FIND JOBS TAB */}
        {topTab === 'find' && (
          <div className="w-full">
            {marketplaceLoading ? (
              <MarketplacePageSkeleton />
            ) : employeeStatus === 'PENDING' ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-8 text-center">
                <h3 className="text-lg font-semibold text-yellow-300 mb-2">
                  {t('Account Pending Activation')}
                </h3>
                <p className="text-yellow-200/80">
                  {t('Your account is waiting for employer approval.')}
                </p>
              </div>
            ) : employeeStatus === 'INACTIVE' || employeeStatus === 'BLOCKED' ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
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
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                    {(['day', 'week', 'month', 'customer'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => {
                          setViewMode(mode)
                          setExpandedJobId(null)
                          setExpandedDate(null)
                          if (mode !== 'month') setMonthSelectedDay(null)
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          viewMode === mode
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {mode === 'day' ? t('Day') : mode === 'week' ? t('Week') : mode === 'month' ? t('Month') : t('Customer')}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setFilterByAvailability(prev => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
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

                {/* DAY VIEW (accordion) */}
                {viewMode === 'day' && (
                  groupedMarketplaceJobs.length > 0 ? (
                    <div className="space-y-2">
                      {groupedMarketplaceJobs.map(([dateKey, dateJobs]) => {
                        const isOpen = expandedDate === dateKey
                        return (
                          <div key={dateKey}>
                            <button
                              onClick={() => setExpandedDate(isOpen ? null : dateKey)}
                              className={`w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all ${
                                isOpen
                                  ? 'bg-green-600/20 border border-green-500/30'
                                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className={`w-4 h-4 ${isOpen ? 'text-green-400' : 'text-gray-500'}`} />
                                <span className={`font-semibold text-sm capitalize ${isOpen ? 'text-white' : 'text-gray-300'}`}>
                                  {formatDateHeader(dateKey)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs rounded-full px-2 py-0.5 ${
                                  isOpen
                                    ? 'bg-green-500/30 text-green-300'
                                    : 'bg-white/10 text-gray-400'
                                }`}>
                                  {dateJobs.length} {dateJobs.length !== 1 ? t('jobs') : t('job')}
                                </span>
                                <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                              </div>
                            </button>

                            {isOpen && (
                              <div className="space-y-3 mt-3 mb-4">
                                {dateJobs.map(job => (
                                  <div key={job.id} className="relative">
                                    <MarketplaceJobCard
                                      jobSession={job}
                                      onClaim={() => handleClaimRequest(job)}
                                      onSkip={() => handleSkipJob(job)}
                                      isExpanded={expandedJobId === job.id}
                                      onToggleExpand={() => toggleExpand(job.id)}
                                    />
                                    {claimingJobId === job.id && (
                                      <ClaimingOverlay />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <FindJobsEmptyState filterByAvailability={filterByAvailability} />
                  )
                )}

                {/* WEEK VIEW */}
                {viewMode === 'week' && (
                  <div className="space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                      <div className="flex items-center justify-between p-3">
                        <button
                          onClick={() => {
                            const prev = addDays(currentWeekStart, -7)
                            if (prev >= startOfWeek(new Date(), { weekStartsOn: 1 })) {
                              setCurrentWeekStart(prev)
                              setExpandedDate(null)
                            }
                          }}
                          className={`p-2 rounded-lg transition-colors ${
                            currentWeekStart <= startOfWeek(new Date(), { weekStartsOn: 1 })
                              ? 'text-gray-600 cursor-not-allowed'
                              : 'text-gray-400 hover:text-white hover:bg-white/10'
                          }`}
                          disabled={currentWeekStart <= startOfWeek(new Date(), { weekStartsOn: 1 })}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => {
                            setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
                            setExpandedDate(null)
                          }}
                          className="text-center"
                        >
                          <span className="text-white font-semibold text-sm">
                            {format(currentWeekStart, 'd MMM', { locale: fr })} — {format(addDays(currentWeekStart, 6), 'd MMM', { locale: fr })}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setCurrentWeekStart(addDays(currentWeekStart, 7))
                            setExpandedDate(null)
                          }}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 px-3 pb-3">
                        {weekDays.map((day) => {
                          const dateKey = format(day, 'yyyy-MM-dd')
                          const dayJobs = jobsByDate[dateKey] || []
                          const isToday = isSameDay(day, new Date())
                          const isPast = day < startOfDay(new Date())
                          const isSelected = expandedDate === dateKey

                          return (
                            <button
                              key={dateKey}
                              onClick={() => {
                                if (isPast && dayJobs.length === 0) return
                                setExpandedDate(isSelected ? null : dateKey)
                              }}
                              className={`flex flex-col items-center justify-start rounded-lg p-1.5 min-h-[60px] transition-all ${
                                isSelected
                                  ? 'bg-green-600/30 border border-green-400'
                                  : isToday
                                    ? 'bg-white/10 border border-white/20'
                                    : 'hover:bg-white/5 border border-transparent'
                              } ${isPast && dayJobs.length === 0 ? 'opacity-30' : ''}`}
                            >
                              <span className="text-[10px] text-gray-500 capitalize">
                                {format(day, 'EEE', { locale: fr })}
                              </span>
                              <span className={`text-sm font-bold ${
                                isSelected ? 'text-green-300' : isToday ? 'text-white' : 'text-gray-300'
                              }`}>
                                {format(day, 'd')}
                              </span>

                              {dayJobs.length > 0 && (
                                <span className={`mt-0.5 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-green-500/40 text-green-200'
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

                    {expandedDate && (
                      <div className="space-y-3">
                        <h3 className="text-white font-semibold text-sm border-b border-white/10 pb-2 capitalize">
                          {formatDateHeader(expandedDate)}
                          <span className="text-gray-500 font-normal ml-2">
                            ({(jobsByDate[expandedDate] || []).length} {(jobsByDate[expandedDate] || []).length !== 1 ? t('jobs') : t('job')})
                          </span>
                        </h3>

                        {(jobsByDate[expandedDate] || []).length > 0 ? (
                          (jobsByDate[expandedDate] || []).map(job => (
                            <div key={job.id} className="relative">
                              <MarketplaceJobCard
                                jobSession={job}
                                onClaim={() => handleClaimRequest(job)}
                                onSkip={() => handleSkipJob(job)}
                                isExpanded={expandedJobId === job.id}
                                onToggleExpand={() => toggleExpand(job.id)}
                              />
                              {claimingJobId === job.id && (
                                <ClaimingOverlay />
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

                    {filteredMarketplaceJobs.length === 0 && (
                      <FindJobsEmptyState filterByAvailability={filterByAvailability} />
                    )}
                  </div>
                )}

                {/* MONTH VIEW */}
                {viewMode === 'month' && (
                  <div className="space-y-4">
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

                      <div className="grid grid-cols-7 gap-1 px-3 mb-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                          <div key={d} className="text-center text-[10px] font-medium text-gray-500 py-1">
                            {t(d)}
                          </div>
                        ))}
                      </div>

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
                                onClaim={() => handleClaimRequest(job)}
                                onSkip={() => handleSkipJob(job)}
                                isExpanded={expandedJobId === job.id}
                                onToggleExpand={() => toggleExpand(job.id)}
                              />
                              {claimingJobId === job.id && (
                                <ClaimingOverlay />
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

                    {!monthSelectedDay && filteredMarketplaceJobs.length > 0 && (
                      <p className="text-center text-gray-400 text-sm">
                        {t('Tap a job to view details and claim')}
                      </p>
                    )}

                    {filteredMarketplaceJobs.length === 0 && (
                      <FindJobsEmptyState filterByAvailability={filterByAvailability} />
                    )}
                  </div>
                )}

                {/* CUSTOMER VIEW */}
                {viewMode === 'customer' && (
                  customerGroupedJobs.length > 0 ? (
                    <div className="space-y-2">
                      {customerGroupedJobs.map(([customerName, cJobs]) => {
                        const isOpen = expandedCustomer === customerName
                        return (
                          <div key={customerName}>
                            <button
                              onClick={() => setExpandedCustomer(isOpen ? null : customerName)}
                              className={`w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all ${
                                isOpen
                                  ? 'bg-purple-600/20 border border-purple-500/30'
                                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Building2 className={`w-4 h-4 ${isOpen ? 'text-purple-400' : 'text-gray-500'}`} />
                                <span className={`font-semibold text-sm ${isOpen ? 'text-white' : 'text-gray-300'}`}>
                                  {customerName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs rounded-full px-2 py-0.5 ${
                                  isOpen
                                    ? 'bg-purple-500/30 text-purple-300'
                                    : 'bg-white/10 text-gray-400'
                                }`}>
                                  {cJobs.length} {cJobs.length !== 1 ? t('jobs') : t('job')}
                                </span>
                                <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                              </div>
                            </button>

                            {isOpen && (
                              <div className="space-y-3 mt-3 mb-4">
                                {cJobs.map(job => (
                                  <div key={job.id} className="relative">
                                    <MarketplaceJobCard
                                      jobSession={job}
                                      onClaim={() => handleClaimRequest(job)}
                                      onSkip={() => handleSkipJob(job)}
                                      isExpanded={expandedJobId === job.id}
                                      onToggleExpand={() => toggleExpand(job.id)}
                                    />
                                    {claimingJobId === job.id && (
                                      <ClaimingOverlay />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <FindJobsEmptyState filterByAvailability={filterByAvailability} />
                  )
                )}
              </>
            )}
          </div>
        )}

        {/* SPLITS TAB */}
        {topTab === 'splits' && (
          <div className="w-full space-y-6">
            {splitsLoading ? (
              <LoadingSpinner size="md" />
            ) : (
              <>
                {/* Incoming Split Requests */}
                <div>
                  <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                    {t('Incoming Requests')}
                    {incomingSplits.length > 0 && (
                      <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full px-2 py-0.5">
                        {incomingSplits.length}
                      </span>
                    )}
                  </h3>
                  {incomingSplits.length === 0 ? (
                    <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-gray-400">{t('No incoming split requests')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {incomingSplits.map(split => (
                        <SplitRequestCard
                          key={split.id}
                          split={split}
                          onUpdate={loadSplitsData}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Outgoing Split Requests */}
                <div>
                  <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                    {t('My Outgoing Requests')}
                    {outgoingSplits.length > 0 && (
                      <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full px-2 py-0.5">
                        {outgoingSplits.length}
                      </span>
                    )}
                  </h3>
                  {outgoingSplits.length === 0 ? (
                    <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10">
                      <p className="text-gray-400">{t('No outgoing split requests')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {outgoingSplits.map(split => {
                        const session = split.job_session
                        const template = session?.job_template
                        const partnerName = split.partner_employee?.full_name || t('Unknown')
                        const statusColors: Record<string, string> = {
                          PENDING_PARTNER: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
                          PENDING_EMPLOYER: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
                          APPROVED: 'bg-green-500/20 text-green-300 border border-green-500/30',
                          DENIED_PARTNER: 'bg-red-500/20 text-red-300 border border-red-500/30',
                          DENIED_EMPLOYER: 'bg-red-500/20 text-red-300 border border-red-500/30',
                          CANCELLED: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
                        }
                        const canCancel = split.status === 'PENDING_PARTNER' || split.status === 'PENDING_EMPLOYER'

                        return (
                          <div key={split.id} className="bg-white/10 rounded-2xl border border-white/20 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-white font-semibold text-sm truncate flex-1">
                                {template?.title || t('Unknown Job')}
                              </p>
                              <Badge className={statusColors[split.status] || statusColors.CANCELLED}>
                                {split.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Users className="w-3 h-3" />
                              <span>{t('Partner')}: {partnerName}</span>
                            </div>
                            {split.partner_minutes && (
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Clock className="w-3 h-3" />
                                <span>{t('Partner time')}: {Math.floor(split.partner_minutes / 60)}h{split.partner_minutes % 60 > 0 ? `${split.partner_minutes % 60}m` : ''}</span>
                              </div>
                            )}
                            <div className="text-xs text-gray-500">
                              {t('Requested')}: {new Date(split.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                            {canCancel && (
                              <Button
                                onClick={() => handleCancelSplit(split.id)}
                                disabled={cancelingSplitId === split.id}
                                className="w-full mt-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                                size="sm"
                              >
                                {cancelingSplitId === split.id ? '...' : t('Cancel Split')}
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* MY JOBS / HISTORY TAB */}
        {(topTab === 'myjobs' || topTab === 'history') && (
          <>
            {/* Sub-tabs */}
            <div className="bg-white/10 rounded-2xl border border-white/20 p-4 mb-6">
              <div className="flex justify-center">
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                  {activeSubTabs.map((tab) => {
                    const isActive = subTab === tab.id
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setSubTab(tab.id)}
                        className={`aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl font-bold transition-all ${
                          isActive
                            ? getSubTabStyle(tab.color, true)
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        <Icon className={`w-8 h-8 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                        <span className="text-center px-2 text-sm">{t(tab.label)}</span>
                        {tab.count > 0 && (
                          <span className={`text-xs rounded-full px-2 py-0.5 ${
                            isActive ? 'bg-white/20' : 'bg-white/10'
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div ref={contentRef} className="bg-white/10 rounded-2xl border border-white/20 p-4 scroll-mt-4">
              {loading ? (
                <LoadingSpinner size="md" />
              ) : currentJobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">{getEmptyMessage()}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentJobs.map(job => (
                    <MyJobCard
                      key={job.id}
                      jobSession={job}
                      onStatusChange={fetchJobs}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Claim Confirmation Dialog (#9) */}
      <AlertDialog open={!!confirmJob} onOpenChange={(open) => { if (!open) setConfirmJob(null) }}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-white/20 text-white max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('Claim This Job?')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                {confirmJob && (
                  <>
                    <div className="flex items-center gap-3 text-gray-200">
                      <FileText className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      <span className="font-bold text-lg text-white">{confirmJob.job_template.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-200">
                      <Building2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      <span className="text-base font-medium">{confirmJob.job_template.customer?.full_name || confirmJob.job_template.customer?.customer_code || ''}</span>
                    </div>
                    {confirmJob.scheduled_date && (
                      <div className="flex items-center gap-3 text-gray-200">
                        <Calendar className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-base capitalize">
                          {format(parseISO(confirmJob.scheduled_date), 'EEEE d MMMM', { locale: fr })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-6 text-gray-200">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-yellow-400" />
                        <span className="text-base font-bold text-yellow-300">{formatPrice(confirmJob.job_template.price_per_hour)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-400" />
                        <span className="text-base font-medium">{formatDuration(confirmJob.job_template.duration_minutes)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmJob && handleClaimJob(confirmJob)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              {t('Claim This Job')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Claiming animation overlay (reused across views)
function ClaimingOverlay() {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 bg-green-600/90 rounded-2xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 z-20">
      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 animate-bounce">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-white font-bold text-lg">{t('Job Claimed!')}</p>
      <p className="text-green-100 text-sm mt-1">{t('Waiting for approval')}</p>
    </div>
  )
}

// Empty state for Find Jobs views
function FindJobsEmptyState({ filterByAvailability }: { filterByAvailability: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="bg-white/10 rounded-2xl shadow-xl p-12 text-center border border-white/20">
      <ShoppingBag className="w-16 h-16 text-gray-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">
        {t('All caught up!')}
      </h3>
      <p className="text-gray-300 mb-4">
        {filterByAvailability
          ? t('Showing jobs matching your availability')
          : t('No jobs available right now. Check back later!')
        }
      </p>
    </div>
  )
}
