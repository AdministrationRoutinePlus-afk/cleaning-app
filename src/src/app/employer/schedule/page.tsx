'use client'

/**
 * Employer Schedule Page - Custom Dark Theme Weekly Calendar
 *
 * Visual weekly calendar showing:
 * - Week navigation header with gradient
 * - 7-day grid with job counts and status indicators
 * - Employee timeline view showing who is working when
 * - Color-coded status: Offered/Claimed/Approved/In Progress/Completed
 * - Urgency indicators for unclaimed jobs
 * - Summary stats bar
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { format, addDays, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isSameMonth, differenceInDays, parseISO, startOfDay, isWithinInterval, getDay } from 'date-fns'
import type { JobSession, JobTemplate, Employee, Customer, JobSessionStatus, EmployeeWeeklyAvailability, EmployeeSpecificAvailability } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { cleanupStaleSessions } from '@/lib/jobs/cleanupStaleSessions'
import { ScheduleJobPopup } from '@/components/employer/ScheduleJobPopup'
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, Users, Briefcase, Eye, EyeOff, Calendar, GraduationCap, Star, Filter, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import LoadingSpinner from '@/components/LoadingSpinner'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate & { customer: Customer | null }
  employee: Employee | null
}

// Status configuration (styling only - labels resolved via t() at render time)
const STATUS_STYLES: Record<string, { labelKey: string; bg: string; text: string; border: string; dot: string }> = {
  OFFERED: { labelKey: 'Open', bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30', dot: 'bg-gray-500' },
  CLAIMED: { labelKey: 'Claimed', bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  APPROVED: { labelKey: 'Approved', bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  IN_PROGRESS: { labelKey: 'In Progress', bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', dot: 'bg-purple-500' },
  COMPLETED: { labelKey: 'Completed', bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', dot: 'bg-green-500' },
  EVALUATED: { labelKey: 'Evaluated', bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30', dot: 'bg-teal-500' },
  CANCELLED: { labelKey: 'Cancelled', bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', dot: 'bg-red-500' },
  MISSED: { labelKey: 'Missed', bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', dot: 'bg-red-600' },
  OVERDUE: { labelKey: 'Missed', bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', dot: 'bg-red-600' },
}

// Color palette for employees
const EMPLOYEE_COLORS = [
  { bg: 'rgba(147, 51, 234, 0.25)', border: 'border-purple-500/50', text: 'text-purple-300', ring: 'ring-purple-500' },
  { bg: 'rgba(59, 130, 246, 0.25)', border: 'border-blue-500/50', text: 'text-blue-300', ring: 'ring-blue-500' },
  { bg: 'rgba(16, 185, 129, 0.25)', border: 'border-emerald-500/50', text: 'text-emerald-300', ring: 'ring-emerald-500' },
  { bg: 'rgba(245, 158, 11, 0.25)', border: 'border-amber-500/50', text: 'text-amber-300', ring: 'ring-amber-500' },
  { bg: 'rgba(236, 72, 153, 0.25)', border: 'border-pink-500/50', text: 'text-pink-300', ring: 'ring-pink-500' },
  { bg: 'rgba(14, 165, 233, 0.25)', border: 'border-sky-500/50', text: 'text-sky-300', ring: 'ring-sky-500' },
  { bg: 'rgba(168, 85, 247, 0.25)', border: 'border-violet-500/50', text: 'text-violet-300', ring: 'ring-violet-500' },
  { bg: 'rgba(34, 197, 94, 0.25)', border: 'border-green-500/50', text: 'text-green-300', ring: 'ring-green-500' },
]

export default function EmployerSchedulePage() {
  const { t } = useTranslation()
  const [jobSessions, setJobSessions] = useState<JobSessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<JobSessionWithDetails | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = new Date()
    const weekStart = startOfWeek(today, { weekStartsOn: 1 })
    const diff = differenceInDays(today, weekStart)
    return Math.min(Math.max(diff, 0), 6)
  })
  const [showCompleted, setShowCompleted] = useState(false)
  const [statsFilter, setStatsFilter] = useState<'all' | 'unclaimed' | 'active' | 'issues' | null>(null)
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [currentMonth, setCurrentMonth] = useState(() => new Date())

  // Filter state
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterJobTemplate, setFilterJobTemplate] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Filter dropdown options (fetched once, independent of date range)
  const [filterOptions, setFilterOptions] = useState<{
    employees: { id: string; name: string }[]
    customers: { id: string; name: string }[]
    templates: { id: string; name: string; customer_id: string | null }[]
  }>({ employees: [], customers: [], templates: [] })

  // Training lookup: key = `${employee_id}:${job_template_id}`
  const [trainingLookup, setTrainingLookup] = useState<Record<string, { is_trained: boolean; can_coach: boolean }>>({})

  // Availability state
  const [showAvailabilityTab, setShowAvailabilityTab] = useState(false)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availEmployees, setAvailEmployees] = useState<Employee[]>([])
  const [weeklyAvailMap, setWeeklyAvailMap] = useState<Map<string, EmployeeWeeklyAvailability[]>>(new Map())
  const [specificAvailMap, setSpecificAvailMap] = useState<Map<string, EmployeeSpecificAvailability[]>>(new Map())
  const [availabilityEmployeeFilter, setAvailabilityEmployeeFilter] = useState('')
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)
  const [dayPanelTab, setDayPanelTab] = useState<'jobs' | 'availability'>('jobs')

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const fetchJobSessions = useCallback(async () => {
    setLoading(true)
    try {
      // Cleanup stale sessions before fetching
      await cleanupStaleSessions(supabase)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return

      // Get the employer's ID to filter job sessions by their own jobs only
      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer || !isMountedRef.current) return

      // Calculate date range based on current view with buffer
      let rangeStart: string
      let rangeEnd: string
      if (viewMode === 'week') {
        // Load 1 week before and after for multi-day jobs that overlap
        rangeStart = format(addDays(startDate, -7), 'yyyy-MM-dd')
        rangeEnd = format(addDays(startDate, 13), 'yyyy-MM-dd')
      } else {
        // Month view: load from start of calendar grid to end (with buffer)
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        rangeStart = format(addDays(startOfWeek(monthStart, { weekStartsOn: 1 }), -7), 'yyyy-MM-dd')
        rangeEnd = format(addDays(endOfWeek(monthEnd, { weekStartsOn: 1 }), 7), 'yyyy-MM-dd')
      }

      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates!inner(*, customer:customers(*)),
          employee:employees!job_sessions_assigned_to_fkey(*)
        `)
        .eq('job_template.created_by', employer.id)
        .or(`scheduled_date.gte.${rangeStart},scheduled_end_date.gte.${rangeStart}`)
        .or(`scheduled_date.lte.${rangeEnd},scheduled_end_date.lte.${rangeEnd}`)
        .order('scheduled_date', { ascending: true })

      if (error) {
        console.error('Error fetching job sessions:', error)
        toast.error(t('Failed to load job sessions'))
        return
      }

      if (isMountedRef.current) {
        setJobSessions(data as JobSessionWithDetails[])
      }

      // Fetch training data for all employee+template combinations in view
      const pairs = new Set<string>()
      for (const s of (data || [])) {
        if (s.employee && s.job_template_id) {
          const empId = typeof s.employee === 'object' && s.employee !== null && 'id' in s.employee ? (s.employee as Employee).id : null
          if (empId) pairs.add(`${empId}:${s.job_template_id}`)
        }
      }
      if (pairs.size > 0) {
        const empIds = [...new Set([...pairs].map(p => p.split(':')[0]))]
        const tmplIds = [...new Set([...pairs].map(p => p.split(':')[1]))]
        const { data: trainingData } = await supabase
          .from('employee_job_training')
          .select('employee_id, job_template_id, is_trained, can_coach')
          .in('employee_id', empIds)
          .in('job_template_id', tmplIds)

        if (trainingData && isMountedRef.current) {
          const lookup: Record<string, { is_trained: boolean; can_coach: boolean }> = {}
          for (const rec of trainingData) {
            lookup[`${rec.employee_id}:${rec.job_template_id}`] = {
              is_trained: rec.is_trained,
              can_coach: rec.can_coach,
            }
          }
          setTrainingLookup(lookup)
        }
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error(t('Failed to load schedule'))
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [supabase, viewMode, startDate, currentMonth])

  useEffect(() => {
    fetchJobSessions()
  }, [fetchJobSessions])

  // Fetch filter dropdown options once on mount (all employer's employees, customers, templates)
  const fetchFilterOptions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return

      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer || !isMountedRef.current) return

      const [employeesRes, customersRes, templatesRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, full_name')
          .eq('created_by', employer.id)
          .order('full_name'),
        supabase
          .from('customers')
          .select('id, full_name')
          .eq('created_by', employer.id)
          .eq('status', 'ACTIVE')
          .order('full_name'),
        supabase
          .from('job_templates')
          .select('id, title, job_code, customer_id')
          .eq('created_by', employer.id)
          .order('title'),
      ])

      if (isMountedRef.current) {
        setFilterOptions({
          employees: (employeesRes.data || []).map(e => ({ id: e.id, name: e.full_name })),
          customers: (customersRes.data || []).map(c => ({ id: c.id, name: c.full_name })),
          templates: (templatesRes.data || []).map(t => ({ id: t.id, name: t.title || t.job_code, customer_id: t.customer_id })),
        })
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }, [supabase])

  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])

  // Fetch availability data
  const fetchAvailabilityData = useCallback(async () => {
    setAvailabilityLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return

      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer || !isMountedRef.current) return

      // Load all active employees with availability_mode
      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .eq('created_by', employer.id)
        .eq('status', 'ACTIVE')
        .order('full_name')

      if (!employees || !isMountedRef.current) return
      setAvailEmployees(employees as Employee[])

      const empIds = employees.map(e => e.id)
      if (empIds.length === 0) {
        setWeeklyAvailMap(new Map())
        setSpecificAvailMap(new Map())
        return
      }

      // Calculate date range for specific availability
      let rangeStart: string
      let rangeEnd: string
      if (viewMode === 'week') {
        rangeStart = format(startDate, 'yyyy-MM-dd')
        rangeEnd = format(addDays(startDate, 6), 'yyyy-MM-dd')
      } else {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        rangeStart = format(startOfWeek(monthStart, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        rangeEnd = format(endOfWeek(monthEnd, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      }

      const [weeklyRes, specificRes] = await Promise.all([
        supabase
          .from('employee_weekly_availability')
          .select('*')
          .in('employee_id', empIds),
        supabase
          .from('employee_specific_availability')
          .select('*')
          .in('employee_id', empIds)
          .gte('date', rangeStart)
          .lte('date', rangeEnd),
      ])

      if (!isMountedRef.current) return

      // Group weekly availability by employee
      const wMap = new Map<string, EmployeeWeeklyAvailability[]>()
      for (const rec of (weeklyRes.data || []) as EmployeeWeeklyAvailability[]) {
        const existing = wMap.get(rec.employee_id) || []
        existing.push(rec)
        wMap.set(rec.employee_id, existing)
      }
      setWeeklyAvailMap(wMap)

      // Group specific availability by employee
      const sMap = new Map<string, EmployeeSpecificAvailability[]>()
      for (const rec of (specificRes.data || []) as EmployeeSpecificAvailability[]) {
        const existing = sMap.get(rec.employee_id) || []
        existing.push(rec)
        sMap.set(rec.employee_id, existing)
      }
      setSpecificAvailMap(sMap)
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      if (isMountedRef.current) {
        setAvailabilityLoading(false)
      }
    }
  }, [supabase, viewMode, startDate, currentMonth])

  // Fetch availability when toggled on, employee filter set, or date range changes
  useEffect(() => {
    if (showAvailabilityTab || filterEmployee) {
      fetchAvailabilityData()
    }
  }, [showAvailabilityTab, filterEmployee, fetchAvailabilityData])

  // Reset dayPanelTab when availability is turned off
  useEffect(() => {
    if (!showAvailabilityTab) {
      setDayPanelTab('jobs')
    }
  }, [showAvailabilityTab])

  // Generate 7 days for the week
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(startDate, i)),
    [startDate]
  )

  const weekEndDate = addDays(startDate, 6)
  const weekRangeText = `${format(startDate, 'MMM d')} - ${format(weekEndDate, 'MMM d')}`
  const isCurrentWeek = isSameDay(startDate, startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Navigation
  const goToThisWeek = () => {
    setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
    const today = new Date()
    const weekStart = startOfWeek(today, { weekStartsOn: 1 })
    setSelectedDayIndex(Math.min(differenceInDays(today, weekStart), 6))
  }
  const goToPreviousWeek = () => setStartDate(addDays(startDate, -7))
  const goToNextWeek = () => setStartDate(addDays(startDate, 7))

  // Month navigation
  const goToPreviousMonth = () => setCurrentMonth(addMonths(currentMonth, -1))
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const goToThisMonth = () => setCurrentMonth(new Date())
  const isCurrentMonth = isSameMonth(currentMonth, new Date())

  // Check if job is missed or overdue
  const isJobMissedOrOverdue = (session: JobSessionWithDetails) => {
    if (session.status === 'MISSED' || session.status === 'OVERDUE') return true
    if (!session.scheduled_date) return false
    const now = new Date()

    if (session.job_template?.time_window_end) {
      const [endH, endM] = session.job_template.time_window_end.split(':').map(Number)
      const endDate = new Date(session.scheduled_end_date || session.scheduled_date)
      endDate.setHours(endH, endM, 0, 0)
      if (now > endDate) {
        return session.status === 'APPROVED' || session.status === 'IN_PROGRESS'
      }
    } else {
      const endOfDay = new Date(session.scheduled_end_date || session.scheduled_date)
      endOfDay.setHours(23, 59, 59, 999)
      if (now > endOfDay) {
        return session.status === 'APPROVED' || session.status === 'IN_PROGRESS'
      }
    }
    return false
  }

  // Get jobs for a specific day
  const getJobsForDay = useCallback((day: Date) => {
    return jobSessions.filter(session => {
      if (!session.scheduled_date) return false
      const jobStart = startOfDay(parseISO(session.scheduled_date))
      const jobEnd = session.scheduled_end_date
        ? startOfDay(parseISO(session.scheduled_end_date))
        : jobStart
      return isWithinInterval(startOfDay(day), { start: jobStart, end: jobEnd })
    })
  }, [jobSessions])

  // Get urgency color for offered jobs
  const getUrgencyForOffered = (session: JobSessionWithDetails) => {
    if (session.status !== 'OFFERED' || !session.scheduled_date) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const jobDate = startOfDay(parseISO(session.scheduled_date))
    const daysUntil = differenceInDays(jobDate, today)
    if (daysUntil <= 2) return 'urgent'
    if (daysUntil <= 4) return 'warning'
    return 'normal'
  }

  // Apply filters to a list of sessions
  const applyFilters = useCallback((sessions: JobSessionWithDetails[]) => {
    let result = sessions
    if (filterEmployee) {
      result = result.filter(s => s.employee?.id === filterEmployee)
    }
    if (filterCustomer) {
      result = result.filter(s => s.job_template?.customer?.id === filterCustomer)
    }
    if (filterJobTemplate) {
      result = result.filter(s => s.job_template_id === filterJobTemplate)
    }
    if (filterStatus) {
      result = result.filter(s => {
        const effective = isJobMissedOrOverdue(s) && s.status !== 'MISSED' && s.status !== 'OVERDUE'
          ? (s.status === 'IN_PROGRESS' ? 'OVERDUE' : 'MISSED')
          : s.status
        return effective === filterStatus
      })
    }
    return result
  }, [filterEmployee, filterCustomer, filterJobTemplate, filterStatus])

  // Filtered job count for a given day (used for computing stats — no statsFilter)
  const getFilteredJobsForDay = useCallback((day: Date) => {
    return applyFilters(getJobsForDay(day))
  }, [getJobsForDay, applyFilters])

  // Display jobs for a day: regular filters + statsFilter (used by calendar cells)
  const getDisplayJobsForDay = useCallback((day: Date) => {
    let jobs = applyFilters(getJobsForDay(day))
    if (statsFilter === 'unclaimed') {
      jobs = jobs.filter(s => s.status === 'OFFERED')
    } else if (statsFilter === 'active') {
      jobs = jobs.filter(s => s.status === 'IN_PROGRESS')
    } else if (statsFilter === 'issues') {
      jobs = jobs.filter(s => isJobMissedOrOverdue(s))
    }
    return jobs
  }, [getJobsForDay, applyFilters, statsFilter])

  // Summary stats for the week (deduplicated — a multi-day job counts once)
  const weekStats = useMemo(() => {
    const seenTotal = new Set<string>()
    const seenUnclaimed = new Set<string>()
    const seenIssues = new Set<string>()
    const seenInProgress = new Set<string>()

    days.forEach(day => {
      const dayJobs = getFilteredJobsForDay(day)
      dayJobs.forEach(s => {
        seenTotal.add(s.id)
        if (s.status === 'OFFERED') seenUnclaimed.add(s.id)
        if (isJobMissedOrOverdue(s)) seenIssues.add(s.id)
        if (s.status === 'IN_PROGRESS') seenInProgress.add(s.id)
      })
    })

    return { totalJobs: seenTotal.size, unclaimed: seenUnclaimed.size, issues: seenIssues.size, inProgress: seenInProgress.size }
  }, [days, getFilteredJobsForDay])

  // Generate month calendar grid (6 rows x 7 cols)
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

  // Month summary stats (deduplicated — a multi-day job counts once)
  const monthStats = useMemo(() => {
    if (viewMode !== 'month') return { totalJobs: 0, unclaimed: 0, issues: 0, inProgress: 0 }

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const seenTotal = new Set<string>()
    const seenUnclaimed = new Set<string>()
    const seenIssues = new Set<string>()
    const seenInProgress = new Set<string>()

    let day = monthStart
    while (day <= monthEnd) {
      const dayJobs = getFilteredJobsForDay(day)
      dayJobs.forEach(s => {
        seenTotal.add(s.id)
        if (s.status === 'OFFERED') seenUnclaimed.add(s.id)
        if (isJobMissedOrOverdue(s)) seenIssues.add(s.id)
        if (s.status === 'IN_PROGRESS') seenInProgress.add(s.id)
      })
      day = addDays(day, 1)
    }

    return { totalJobs: seenTotal.size, unclaimed: seenUnclaimed.size, issues: seenIssues.size, inProgress: seenInProgress.size }
  }, [currentMonth, viewMode, getFilteredJobsForDay])

  const activeStats = viewMode === 'week' ? weekStats : monthStats

  // Selected day for month view
  const [monthSelectedDay, setMonthSelectedDay] = useState(() => new Date())

  // The selected day used across both views
  const selectedDay = viewMode === 'week' ? days[selectedDayIndex] : monthSelectedDay

  // Handle view mode switching with synced dates
  const switchToWeek = () => {
    const day = viewMode === 'month' ? monthSelectedDay : days[selectedDayIndex]
    const newWeekStart = startOfWeek(day, { weekStartsOn: 1 })
    setStartDate(newWeekStart)
    setSelectedDayIndex(Math.min(Math.max(differenceInDays(day, newWeekStart), 0), 6))
    setViewMode('week')
  }

  const switchToMonth = () => {
    const day = viewMode === 'week' ? days[selectedDayIndex] : monthSelectedDay
    setCurrentMonth(day)
    setMonthSelectedDay(day)
    setViewMode('month')
  }

  // Jobs for selected day, filtered
  const selectedDayJobs = useMemo(() => {
    let jobs = getJobsForDay(selectedDay)
    if (!showCompleted) {
      jobs = jobs.filter(s => !['COMPLETED', 'EVALUATED', 'CANCELLED'].includes(s.status))
    }
    // Apply stats filter
    if (statsFilter === 'unclaimed') {
      jobs = jobs.filter(s => s.status === 'OFFERED')
    } else if (statsFilter === 'active') {
      jobs = jobs.filter(s => s.status === 'IN_PROGRESS')
    } else if (statsFilter === 'issues') {
      jobs = jobs.filter(s => isJobMissedOrOverdue(s))
    }
    // Apply dropdown filters
    jobs = applyFilters(jobs)
    return jobs
  }, [selectedDay, getJobsForDay, showCompleted, statsFilter, applyFilters])

  // Group jobs by employee for the selected day
  const jobsByEmployee = useMemo(() => {
    const groups: { employee: Employee | null; label: string; jobs: JobSessionWithDetails[] }[] = []

    // Unassigned jobs first
    const unassigned = selectedDayJobs.filter(s => !s.employee)
    if (unassigned.length > 0) {
      groups.push({ employee: null, label: t('Unassigned'), jobs: unassigned })
    }

    // Group by employee
    const employeeMap = new Map<string, { employee: Employee; jobs: JobSessionWithDetails[] }>()
    selectedDayJobs.forEach(session => {
      if (!session.employee) return
      const existing = employeeMap.get(session.employee.id)
      if (existing) {
        existing.jobs.push(session)
      } else {
        employeeMap.set(session.employee.id, { employee: session.employee, jobs: [session] })
      }
    })

    employeeMap.forEach(({ employee, jobs }) => {
      groups.push({ employee, label: employee.full_name, jobs })
    })

    return groups
  }, [selectedDayJobs])

  // Build employee color map (consistent across the week)
  const employeeColorMap = useMemo(() => {
    const map = new Map<string, number>()
    let colorIndex = 0
    jobSessions.forEach(session => {
      if (session.employee && !map.has(session.employee.id)) {
        map.set(session.employee.id, colorIndex % EMPLOYEE_COLORS.length)
        colorIndex++
      }
    })
    return map
  }, [jobSessions])

  // Get availability for a specific employee on a given day (used for calendar indicators)
  const getEmployeeAvailForDay = useCallback((day: Date, empId: string): { isAvailable: boolean; startTime: string | null; endTime: string | null } | null => {
    const emp = availEmployees.find(e => e.id === empId)
    if (!emp || !emp.availability_mode) return null

    if (emp.availability_mode === 'fixed') {
      const dayOfWeek = getDay(day)
      const records = weeklyAvailMap.get(empId) || []
      const match = records.find(r => r.day_of_week === dayOfWeek)
      if (match) return { isAvailable: match.is_available, startTime: match.start_time, endTime: match.end_time }
    } else if (emp.availability_mode === 'custom') {
      const dateStr = format(day, 'yyyy-MM-dd')
      const records = specificAvailMap.get(empId) || []
      const match = records.find(r => r.date === dateStr)
      if (match) return { isAvailable: match.is_available, startTime: match.start_time, endTime: match.end_time }
    }
    return null
  }, [availEmployees, weeklyAvailMap, specificAvailMap])

  // Whether to show availability indicators on calendar cells
  const showCalendarAvail = !!filterEmployee

  // Whether to show job schedule indicators on calendar cells (customer or job selected)
  const showCalendarJobs = !!(filterCustomer || filterJobTemplate)

  // Get job sessions for a day matching customer/template filters (ignores employee filter)
  const getJobScheduleForDay = useCallback((day: Date) => {
    let sessions = getJobsForDay(day)
    if (filterCustomer) {
      sessions = sessions.filter(s => s.job_template?.customer?.id === filterCustomer)
    }
    if (filterJobTemplate) {
      sessions = sessions.filter(s => s.job_template_id === filterJobTemplate)
    }
    return sessions
  }, [getJobsForDay, filterCustomer, filterJobTemplate])

  // Filtered templates based on selected customer
  const filteredTemplateOptions = useMemo(() => {
    if (!filterCustomer) return filterOptions.templates
    return filterOptions.templates.filter(t => t.customer_id === filterCustomer)
  }, [filterOptions.templates, filterCustomer])

  // Compute availability for selected day
  const availabilityForSelectedDay = useMemo(() => {
    if (!showAvailabilityTab) return []

    const dayOfWeek = getDay(selectedDay) // 0=Sun..6=Sat
    const dateStr = format(selectedDay, 'yyyy-MM-dd')

    const results: { employee: Employee; isAvailable: boolean | null; startTime: string | null; endTime: string | null; mode: string }[] = []

    for (const emp of availEmployees) {
      let isAvailable: boolean | null = null
      let startTime: string | null = null
      let endTime: string | null = null
      const mode = emp.availability_mode || 'none'

      if (emp.availability_mode === 'fixed') {
        const weeklyRecords = weeklyAvailMap.get(emp.id) || []
        const match = weeklyRecords.find(r => r.day_of_week === dayOfWeek)
        if (match) {
          isAvailable = match.is_available
          startTime = match.start_time
          endTime = match.end_time
        }
      } else if (emp.availability_mode === 'custom') {
        const specificRecords = specificAvailMap.get(emp.id) || []
        const match = specificRecords.find(r => r.date === dateStr)
        if (match) {
          isAvailable = match.is_available
          startTime = match.start_time
          endTime = match.end_time
        }
      }

      results.push({ employee: emp, isAvailable, startTime, endTime, mode })
    }

    // Apply filters
    let filtered = results
    if (availabilityEmployeeFilter) {
      filtered = filtered.filter(r => r.employee.id === availabilityEmployeeFilter)
    }
    if (showAvailableOnly) {
      filtered = filtered.filter(r => r.isAvailable === true)
    }

    // Sort: available first, then not set (null), then unavailable
    filtered.sort((a, b) => {
      const order = (v: boolean | null) => v === true ? 0 : v === null ? 1 : 2
      return order(a.isAvailable) - order(b.isAvailable)
    })

    return filtered
  }, [showAvailabilityTab, selectedDay, availEmployees, weeklyAvailMap, specificAvailMap, availabilityEmployeeFilter, showAvailableOnly])

  // Availability summary counts
  const availabilitySummary = useMemo(() => {
    if (!showAvailabilityTab) return { available: 0, unavailable: 0, notSet: 0 }
    // Count from unfiltered results for summary
    const dayOfWeek = getDay(selectedDay)
    const dateStr = format(selectedDay, 'yyyy-MM-dd')
    let available = 0, unavailable = 0, notSet = 0
    for (const emp of availEmployees) {
      let isAvailable: boolean | null = null
      if (emp.availability_mode === 'fixed') {
        const match = (weeklyAvailMap.get(emp.id) || []).find(r => r.day_of_week === dayOfWeek)
        if (match) isAvailable = match.is_available
      } else if (emp.availability_mode === 'custom') {
        const match = (specificAvailMap.get(emp.id) || []).find(r => r.date === dateStr)
        if (match) isAvailable = match.is_available
      }
      if (isAvailable === true) available++
      else if (isAvailable === false) unavailable++
      else notSet++
    }
    return { available, unavailable, notSet }
  }, [showAvailabilityTab, selectedDay, availEmployees, weeklyAvailMap, specificAvailMap])

  const hasActiveFilters = filterEmployee || filterCustomer || filterJobTemplate || filterStatus
  const activeFilterCount = [filterEmployee, filterCustomer, filterJobTemplate, filterStatus].filter(Boolean).length

  const clearFilters = () => {
    setFilterEmployee('')
    setFilterCustomer('')
    setFilterJobTemplate('')
    setFilterStatus('')
  }

  const handleSelectJob = (job: JobSessionWithDetails) => {
    setSelectedJob(job)
    setPopupOpen(true)
  }

  const handleClosePopup = () => {
    setPopupOpen(false)
    setSelectedJob(null)
  }

  const handleUpdate = () => {
    fetchJobSessions()
  }

  // Get effective status label
  const getEffectiveStatus = (session: JobSessionWithDetails): string => {
    if (isJobMissedOrOverdue(session) && session.status !== 'MISSED' && session.status !== 'OVERDUE') {
      return session.status === 'IN_PROGRESS' ? 'OVERDUE' : 'MISSED'
    }
    return session.status
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={switchToWeek}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              viewMode === 'week'
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            {t('Week')}
          </button>
          <button
            onClick={switchToMonth}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              viewMode === 'month'
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            {t('Month')}
          </button>
        </div>

        {/* Slim Stats Bar + Filter Toggle */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <button
              onClick={() => setStatsFilter(null)}
              className={`font-semibold transition-all px-1.5 py-0.5 rounded ${!statsFilter ? 'text-white bg-white/15' : 'text-gray-400 hover:text-gray-300'}`}
            >
              {t('All')}
            </button>
            <span className="text-gray-600">·</span>
            <button
              onClick={() => setStatsFilter(statsFilter === 'all' ? null : 'all')}
              className={`font-semibold transition-all px-1.5 py-0.5 rounded ${statsFilter === 'all' ? 'text-blue-300 bg-blue-500/20' : 'text-blue-400 hover:text-blue-300'}`}
            >
              {activeStats.totalJobs} {t('jobs')}
            </button>
            <span className="text-gray-600">·</span>
            <button
              onClick={() => setStatsFilter(statsFilter === 'unclaimed' ? null : 'unclaimed')}
              className={`transition-all px-1.5 py-0.5 rounded ${statsFilter === 'unclaimed' ? 'text-orange-300 bg-orange-500/20 font-semibold' : activeStats.unclaimed > 0 ? 'text-orange-400 hover:text-orange-300' : 'text-gray-500'}`}
            >
              {activeStats.unclaimed} {t('unclaimed')}
            </button>
            <span className="text-gray-600">·</span>
            <button
              onClick={() => setStatsFilter(statsFilter === 'active' ? null : 'active')}
              className={`transition-all px-1.5 py-0.5 rounded ${statsFilter === 'active' ? 'text-purple-300 bg-purple-500/20 font-semibold' : activeStats.inProgress > 0 ? 'text-purple-400 hover:text-purple-300' : 'text-gray-500'}`}
            >
              {activeStats.inProgress} {t('Active').toLowerCase()}
            </button>
            <span className="text-gray-600">·</span>
            <button
              onClick={() => setStatsFilter(statsFilter === 'issues' ? null : 'issues')}
              className={`transition-all px-1.5 py-0.5 rounded ${statsFilter === 'issues' ? 'text-red-300 bg-red-500/20 font-semibold' : activeStats.issues > 0 ? 'text-red-400 hover:text-red-300' : 'text-gray-500'}`}
            >
              {activeStats.issues} {activeStats.issues !== 1 ? t('Issues').toLowerCase() : t('Issue').toLowerCase()}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const next = !showAvailabilityTab
                setShowAvailabilityTab(next)
                if (next) setDayPanelTab('availability')
              }}
              className={`p-2 rounded-lg border transition-all ${
                showAvailabilityTab ? 'bg-purple-600 text-white border-purple-500' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
              }`}
              title={t('Availability')}
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative p-2 rounded-lg border transition-all ${
                showFilters ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
              }`}
            >
              <Filter className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Filter Bar */}
        {showFilters && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 space-y-3">
            {/* Two-column layout: Employee | Customer+Job */}
            <div className="grid grid-cols-2 gap-3">
              {/* Left column: Employee */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">{t('Employee')}</span>
                <Select value={filterEmployee || '__all__'} onValueChange={v => setFilterEmployee(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white w-full">
                    <SelectValue placeholder={t('Employee')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-white/20">
                    <SelectItem value="__all__" className="text-white hover:bg-white/10">{t('All Employees')}</SelectItem>
                    {filterOptions.employees.map(e => (
                      <SelectItem key={e.id} value={e.id} className="text-white hover:bg-white/10">{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Right column: Customer + Job */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">{t('Customer')}</span>
                <Select value={filterCustomer || '__all__'} onValueChange={v => { setFilterCustomer(v === '__all__' ? '' : v); setFilterJobTemplate('') }}>
                  <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white w-full">
                    <SelectValue placeholder={t('Customer')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-white/20">
                    <SelectItem value="__all__" className="text-white hover:bg-white/10">{t('All Customers')}</SelectItem>
                    {filterOptions.customers.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-white hover:bg-white/10">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterJobTemplate || '__all__'} onValueChange={v => setFilterJobTemplate(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white w-full">
                    <SelectValue placeholder={t('Jobs')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-white/20">
                    <SelectItem value="__all__" className="text-white hover:bg-white/10">{t('All Jobs')}</SelectItem>
                    {filteredTemplateOptions.map(tmpl => (
                      <SelectItem key={tmpl.id} value={tmpl.id} className="text-white hover:bg-white/10">{tmpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status filter - full width below */}
            <Select value={filterStatus || '__all__'} onValueChange={v => setFilterStatus(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white w-full">
                <SelectValue placeholder={t('Status')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="__all__" className="text-white hover:bg-white/10">{t('All Statuses')}</SelectItem>
                <SelectItem value="OFFERED" className="text-white hover:bg-white/10">{t('Open')}</SelectItem>
                <SelectItem value="CLAIMED" className="text-white hover:bg-white/10">{t('Claimed')}</SelectItem>
                <SelectItem value="APPROVED" className="text-white hover:bg-white/10">{t('Approved')}</SelectItem>
                <SelectItem value="IN_PROGRESS" className="text-white hover:bg-white/10">{t('In Progress')}</SelectItem>
                <SelectItem value="COMPLETED" className="text-white hover:bg-white/10">{t('Completed')}</SelectItem>
                <SelectItem value="EVALUATED" className="text-white hover:bg-white/10">{t('Evaluated')}</SelectItem>
                <SelectItem value="CANCELLED" className="text-white hover:bg-white/10">{t('Cancelled')}</SelectItem>
                <SelectItem value="MISSED" className="text-white hover:bg-white/10">{t('Missed')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Legend when both sides active */}
            {(showCalendarAvail || showCalendarJobs) && (
              <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-1">
                {showCalendarAvail && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-2 rounded-sm bg-green-500" />
                    <span>{t('Available')}</span>
                    <div className="w-3 h-2 rounded-sm bg-red-500 ml-1" />
                    <span>{t('Unavailable')}</span>
                  </div>
                )}
                {showCalendarJobs && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-2 rounded-sm bg-blue-500" />
                    <span>{t('Jobs')}</span>
                  </div>
                )}
                {showCalendarAvail && showCalendarJobs && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-green-500/30 border border-green-500" />
                    <span>Match</span>
                  </div>
                )}
              </div>
            )}

            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <X className="h-3 w-3" /> {t('Clear filters')}
              </button>
            )}
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden mb-6">
          {/* Week Header */}
          <div className="bg-white/5 border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={goToPreviousWeek}
                className="p-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-gray-300" />
              </button>

              <button onClick={goToThisWeek} className="flex flex-col items-center">
                <span className="text-xl font-bold text-white">{weekRangeText}</span>
                {isCurrentWeek ? (
                  <span className="text-xs text-blue-400 font-medium">{t('This Week')}</span>
                ) : (
                  <span className="text-xs text-gray-500 hover:text-gray-300">{t('Tap for this week')}</span>
                )}
              </button>

              <button
                onClick={goToNextWeek}
                className="p-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
              >
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </button>
            </div>
          </div>

          {/* Days Grid */}
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const dayJobs = getDisplayJobsForDay(day)
                const isToday = isSameDay(day, new Date())
                const hasJobs = dayJobs.length > 0
                const isSelected = selectedDayIndex === index
                const hasUnclaimed = dayJobs.some(s => s.status === 'OFFERED')
                const hasIssues = dayJobs.some(s => isJobMissedOrOverdue(s))
                const activeCount = dayJobs.filter(s => !['COMPLETED', 'EVALUATED', 'CANCELLED'].includes(s.status)).length

                // Employee availability for this day
                const empAvail = showCalendarAvail ? getEmployeeAvailForDay(day, filterEmployee) : null
                // Job schedule for this day (customer/template filter, ignores employee)
                const jobSchedule = showCalendarJobs ? getJobScheduleForDay(day) : []
                const hasScheduledJob = jobSchedule.length > 0
                // Match: employee available AND job scheduled
                const isMatch = showCalendarAvail && showCalendarJobs && empAvail?.isAvailable === true && hasScheduledJob

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDayIndex(index)}
                    className={`flex flex-col items-center justify-center rounded-xl py-2 transition-all relative overflow-hidden ${
                      isMatch
                        ? isSelected
                          ? 'bg-green-500/25 text-green-200 border-2 border-green-500/60'
                          : 'bg-green-500/15 text-green-300 border-2 border-green-500/40 hover:border-green-400/60'
                        : hasJobs
                          ? isSelected
                            ? 'bg-blue-500/20 text-blue-300 border-2 border-blue-500/40'
                            : 'bg-white/10 text-gray-300 border-2 border-white/15 hover:border-white/30'
                          : isSelected
                            ? 'bg-white/15 text-white border-2 border-white/30'
                            : 'bg-white/5 text-gray-500 border-2 border-white/10 hover:border-white/20'
                    } ${isToday ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''}`}
                  >
                    {/* Urgency dot indicator */}
                    {hasIssues && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    )}
                    {!hasIssues && hasUnclaimed && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full" />
                    )}

                    <span className={`text-[10px] font-medium ${hasJobs || isMatch ? '' : 'text-gray-500'}`}>
                      {format(day, 'EEE')}
                    </span>
                    <span className={`text-lg font-bold ${hasJobs || isMatch ? '' : 'text-gray-600'}`}>
                      {format(day, 'd')}
                    </span>
                    {hasJobs && (
                      <span className={`text-[10px] rounded-full px-1.5 mt-0.5 ${
                        isSelected ? 'bg-white/20' : 'bg-white/15'
                      }`}>
                        {activeCount}
                      </span>
                    )}

                    {/* Split availability/job bars at bottom */}
                    {(showCalendarAvail || showCalendarJobs) && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex">
                        {showCalendarAvail && (
                          <div className={`${showCalendarJobs ? 'w-1/2' : 'w-full'} ${
                            empAvail?.isAvailable === true
                              ? 'bg-green-500'
                              : empAvail?.isAvailable === false
                                ? 'bg-red-500'
                                : 'bg-gray-600'
                          }`} />
                        )}
                        {showCalendarJobs && (
                          <div className={`${showCalendarAvail ? 'w-1/2' : 'w-full'} ${
                            hasScheduledJob ? 'bg-blue-500' : 'bg-transparent'
                          }`} />
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        )}

        {/* Month View */}
        {viewMode === 'month' && (
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden mb-6">
          {/* Month Header */}
          <div className="bg-white/5 border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={goToPreviousMonth}
                className="p-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-gray-300" />
              </button>

              <button onClick={goToThisMonth} className="flex flex-col items-center">
                <span className="text-xl font-bold text-white">{format(currentMonth, 'MMMM yyyy')}</span>
                {isCurrentMonth ? (
                  <span className="text-xs text-blue-400 font-medium">{t('This Month')}</span>
                ) : (
                  <span className="text-xs text-gray-500 hover:text-gray-300">{t('Tap for this month')}</span>
                )}
              </button>

              <button
                onClick={goToNextMonth}
                className="p-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
              >
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </button>
            </div>
          </div>

          {/* Month Grid */}
          <div className="p-3">
            {/* Day of week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-gray-500 py-1">
                  {t(d)}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day) => {
                const dayJobs = getDisplayJobsForDay(day)
                const isToday = isSameDay(day, new Date())
                const isInMonth = isSameMonth(day, currentMonth)
                const isSelected = isSameDay(day, monthSelectedDay)

                // Group jobs by status for dot display
                const statusCounts: { status: string; count: number }[] = []
                const statusMap = new Map<string, number>()
                dayJobs.forEach(s => {
                  const effectiveStatus = getEffectiveStatus(s)
                  statusMap.set(effectiveStatus, (statusMap.get(effectiveStatus) || 0) + 1)
                })
                statusMap.forEach((count, status) => {
                  statusCounts.push({ status, count })
                })

                const maxDots = 4
                const visibleDots = statusCounts.slice(0, maxDots)
                const extraCount = dayJobs.length - visibleDots.reduce((sum, d) => sum + d.count, 0)

                // Employee availability for this day
                const empAvail = showCalendarAvail && isInMonth ? getEmployeeAvailForDay(day, filterEmployee) : null
                // Job schedule for this day (customer/template filter, ignores employee)
                const jobSchedule = showCalendarJobs && isInMonth ? getJobScheduleForDay(day) : []
                const hasScheduledJob = jobSchedule.length > 0
                // Match: employee available AND job scheduled
                const isMatch = showCalendarAvail && showCalendarJobs && isInMonth && empAvail?.isAvailable === true && hasScheduledJob

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setMonthSelectedDay(day)}
                    className={`flex flex-col items-center justify-start rounded-lg p-1 min-h-[52px] transition-all relative overflow-hidden ${
                      isMatch
                        ? isSelected
                          ? 'bg-green-500/25 text-green-200 border border-green-500/60'
                          : 'bg-green-500/15 text-green-300 border border-green-500/40 hover:border-green-400/60'
                        : isSelected
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : isInMonth
                            ? 'bg-white/5 text-gray-300 border border-white/5 hover:bg-white/10 hover:border-white/20'
                            : 'text-gray-700 border border-transparent'
                    } ${isToday ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-gray-900' : ''}`}
                  >
                    <span className={`text-xs font-semibold ${
                      isMatch ? 'text-green-200' : isSelected ? 'text-white' : isInMonth ? '' : 'text-gray-700'
                    }`}>
                      {format(day, 'd')}
                    </span>

                    {/* Status dots */}
                    {dayJobs.length > 0 && isInMonth && !isMatch && (
                      <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                        {visibleDots.map(({ status, count }) => {
                          const config = STATUS_STYLES[status] || STATUS_STYLES.OFFERED
                          return (
                            <div
                              key={status}
                              className={`w-2 h-2 rounded-full ${config.dot} ${
                                status === 'IN_PROGRESS' ? 'animate-pulse' : ''
                              }`}
                              title={`${count} ${t(config.labelKey)}`}
                            />
                          )
                        })}
                        {extraCount > 0 && (
                          <span className={`text-[8px] leading-none ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                            +{extraCount}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Match checkmark */}
                    {isMatch && (
                      <span className="text-green-300 text-sm font-bold mt-0.5">✓</span>
                    )}

                    {/* Split availability/job bars at bottom */}
                    {(showCalendarAvail || showCalendarJobs) && isInMonth && !isMatch && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex">
                        {showCalendarAvail && (
                          <div className={`${showCalendarJobs ? 'w-1/2' : 'w-full'} ${
                            empAvail?.isAvailable === true
                              ? 'bg-green-500'
                              : empAvail?.isAvailable === false
                                ? 'bg-red-500'
                                : 'bg-gray-600'
                          }`} />
                        )}
                        {showCalendarJobs && (
                          <div className={`${showCalendarAvail ? 'w-1/2' : 'w-full'} ${
                            hasScheduledJob ? 'bg-blue-500' : 'bg-transparent'
                          }`} />
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        )}

        {/* Selected Day Content */}
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden mb-6">
          {/* Day Header */}
          <div className="bg-white/5 border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {format(selectedDay, 'EEEE, MMMM d')}
                  {isSameDay(selectedDay, new Date()) && (
                    <span className="ml-2 text-sm text-gray-500 font-normal">({t('Today')})</span>
                  )}
                </h3>
                {dayPanelTab === 'jobs' && selectedDayJobs.length > 0 && (
                  <p className="text-gray-400 text-sm mt-0.5">
                    {selectedDayJobs.length} {selectedDayJobs.length !== 1 ? t('jobs') : t('job')}
                  </p>
                )}
                {(showCalendarAvail || showCalendarJobs) && (() => {
                  const avail = showCalendarAvail ? getEmployeeAvailForDay(selectedDay, filterEmployee) : null
                  const empName = showCalendarAvail ? filterOptions.employees.find(e => e.id === filterEmployee)?.name : null
                  const jobSchedule = showCalendarJobs ? getJobScheduleForDay(selectedDay) : []
                  const hasJob = jobSchedule.length > 0
                  const isMatch = avail?.isAvailable === true && hasJob

                  return (
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {empName && (
                        <p className={`text-xs ${
                          avail?.isAvailable === true ? 'text-green-400' : avail?.isAvailable === false ? 'text-red-400' : 'text-gray-500'
                        }`}>
                          {empName}: {avail?.isAvailable === true
                            ? `${t('Available')}${avail.startTime ? ` ${avail.startTime.substring(0, 5)}${avail.endTime ? `-${avail.endTime.substring(0, 5)}` : ''}` : ''}`
                            : avail?.isAvailable === false
                              ? t('Unavailable')
                              : t('Not set')}
                        </p>
                      )}
                      {showCalendarJobs && (
                        <p className={`text-xs ${hasJob ? 'text-blue-400' : 'text-gray-500'}`}>
                          {hasJob ? `${jobSchedule.length} ${jobSchedule.length !== 1 ? t('jobs') : t('job')} ${t('scheduled')}` : t('No jobs scheduled')}
                        </p>
                      )}
                      {isMatch && (
                        <p className="text-xs text-green-400 font-semibold">✓ Match</p>
                      )}
                    </div>
                  )
                })()}
              </div>
              {dayPanelTab === 'jobs' && (
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="p-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
                  title={showCompleted ? t('Hide completed') : t('Show completed')}
                >
                  {showCompleted ? (
                    <EyeOff className="w-4 h-4 text-gray-300" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-300" />
                  )}
                </button>
              )}
            </div>

            {/* Tab Toggle (Jobs / Availability) */}
            {showAvailabilityTab && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setDayPanelTab('jobs')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    dayPanelTab === 'jobs'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {t('Jobs')}
                </button>
                <button
                  onClick={() => setDayPanelTab('availability')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    dayPanelTab === 'availability'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {t('Availability')}
                </button>
              </div>
            )}
          </div>

          {/* Jobs Tab Content */}
          {dayPanelTab === 'jobs' && (
          <div className="p-4">
            {selectedDayJobs.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">
                  {showCompleted ? t('No jobs scheduled') : t('No active jobs')}
                </p>
                {!showCompleted && (
                  <button
                    onClick={() => setShowCompleted(true)}
                    className="text-sm text-blue-400 hover:text-blue-300 mt-2"
                  >
                    {t('Show completed jobs')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {jobsByEmployee.map((group, groupIndex) => {
                  const colorIdx = group.employee
                    ? employeeColorMap.get(group.employee.id) ?? 0
                    : -1
                  const color = colorIdx >= 0 ? EMPLOYEE_COLORS[colorIdx] : null

                  return (
                    <div key={group.employee?.id || 'unassigned'}>
                      {/* Employee header */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          group.employee
                            ? `border ${color?.border || 'border-gray-500/50'} ${color?.text || 'text-gray-300'}`
                            : 'border border-orange-500/50 text-orange-400'
                        }`}
                          style={group.employee && color ? { backgroundColor: color.bg } : { backgroundColor: 'rgba(249, 115, 22, 0.2)' }}
                        >
                          {group.employee
                            ? group.employee.full_name.charAt(0).toUpperCase()
                            : '?'}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold text-sm ${group.employee ? 'text-white' : 'text-orange-400'}`}>
                            {group.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {group.jobs.length} {group.jobs.length !== 1 ? t('jobs') : t('job')}
                          </span>
                        </div>
                      </div>

                      {/* Jobs for this employee */}
                      <div className="space-y-2 ml-10">
                        {group.jobs.map(session => {
                          const effectiveStatus = getEffectiveStatus(session)
                          const statusConfig = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.OFFERED
                          const urgency = getUrgencyForOffered(session)
                          const isUrgent = urgency === 'urgent'
                          const isWarning = urgency === 'warning'

                          return (
                            <button
                              key={session.id}
                              onClick={() => handleSelectJob(session)}
                              className={`w-full text-left bg-white/5 rounded-xl p-3.5 border transition-all hover:bg-white/10 ${
                                isUrgent
                                  ? 'border-red-500/40 bg-red-500/5'
                                  : isWarning
                                    ? 'border-orange-500/30 bg-orange-500/5'
                                    : 'border-white/10'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig.dot} ${
                                    effectiveStatus === 'IN_PROGRESS' ? 'animate-pulse' : ''
                                  }`} />
                                  <span className="font-mono text-xs font-semibold text-gray-400">
                                    {session.full_job_code || session.job_template?.job_code}
                                  </span>
                                </div>
                                <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                                  {isUrgent && effectiveStatus === 'OFFERED' ? t('URGENT') :
                                   isWarning && effectiveStatus === 'OFFERED' ? t('WARNING') :
                                   t(statusConfig.labelKey)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <h4 className="text-white font-medium text-sm truncate">
                                  {session.job_template?.title || t('Untitled Job')}
                                </h4>
                                {session.employee && (() => {
                                  const key = `${(session.employee as Employee).id}:${session.job_template_id}`
                                  const tr = trainingLookup[key]
                                  if (tr?.can_coach) return (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex-shrink-0">
                                      <Star className="w-2.5 h-2.5" />
                                      {t('Coach')}
                                    </span>
                                  )
                                  if (tr?.is_trained) return (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30 flex-shrink-0">
                                      <GraduationCap className="w-2.5 h-2.5" />
                                      {t('Trained')}
                                    </span>
                                  )
                                  return (
                                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
                                      {t('Untrained')}
                                    </span>
                                  )
                                })()}
                              </div>

                              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                {session.job_template?.customer && (
                                  <span className="truncate">
                                    {session.job_template.customer.full_name}
                                  </span>
                                )}
                                {session.job_template?.time_window_start && (
                                  <span className="flex-shrink-0">
                                    {session.job_template.time_window_start.substring(0, 5)}
                                    {session.job_template.time_window_end &&
                                      ` - ${session.job_template.time_window_end.substring(0, 5)}`
                                    }
                                  </span>
                                )}
                                {session.job_template?.duration_minutes && (
                                  <span className="flex-shrink-0">
                                    {Math.floor(session.job_template.duration_minutes / 60)}h{session.job_template.duration_minutes % 60 > 0 ? `${session.job_template.duration_minutes % 60}m` : ''}
                                  </span>
                                )}
                              </div>

                              {/* Pay rate */}
                              {(session.price_override || session.job_template?.price_per_hour) && (
                                <div className="mt-1.5">
                                  <span className="text-xs text-green-400 font-medium">
                                    ${session.price_override || session.job_template?.price_per_hour}/hr
                                  </span>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )}

          {/* Availability Tab Content */}
          {dayPanelTab === 'availability' && (
          <div className="p-4">
            {availabilityLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <>
                {/* Filter row */}
                <div className="flex items-center gap-2 mb-4">
                  <Select value={availabilityEmployeeFilter || '__all__'} onValueChange={v => setAvailabilityEmployeeFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs bg-white/5 border-white/20 text-white flex-1">
                      <SelectValue placeholder={t('All Employees')} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-white/20">
                      <SelectItem value="__all__" className="text-white hover:bg-white/10">{t('All Employees')}</SelectItem>
                      {availEmployees.map(e => (
                        <SelectItem key={e.id} value={e.id} className="text-white hover:bg-white/10">{e.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${
                      showAvailableOnly
                        ? 'bg-green-500/20 text-green-300 border-green-500/30'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {t('Available')}
                  </button>
                </div>

                {/* Employee availability list */}
                {availabilityForSelectedDay.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">{t('No employees found')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availabilityForSelectedDay.map(({ employee, isAvailable, startTime, endTime, mode }) => {
                      const colorIdx = employeeColorMap.get(employee.id)
                      const color = colorIdx !== undefined ? EMPLOYEE_COLORS[colorIdx % EMPLOYEE_COLORS.length] : EMPLOYEE_COLORS[0]

                      return (
                        <div
                          key={employee.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            isAvailable === true
                              ? 'bg-green-500/5 border-green-500/20'
                              : isAvailable === false
                                ? 'bg-red-500/5 border-red-500/20'
                                : 'bg-white/5 border-white/10'
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border flex-shrink-0 ${color.border} ${color.text}`}
                            style={{ backgroundColor: color.bg }}
                          >
                            {employee.full_name.charAt(0).toUpperCase()}
                          </div>

                          {/* Name + mode */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-white truncate">{employee.full_name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                mode === 'fixed'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                  : mode === 'custom'
                                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                                    : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                              }`}>
                                {mode === 'fixed' ? t('Fixed') : mode === 'custom' ? t('Custom') : '—'}
                              </span>
                            </div>
                            {isAvailable === true && startTime && (
                              <span className="text-xs text-gray-400">
                                {startTime.substring(0, 5)}{endTime ? ` - ${endTime.substring(0, 5)}` : ''}
                              </span>
                            )}
                          </div>

                          {/* Status badge */}
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${
                            isAvailable === true
                              ? 'bg-green-500/20 text-green-300 border-green-500/30'
                              : isAvailable === false
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }`}>
                            {isAvailable === true ? t('Available') : isAvailable === false ? t('Unavailable') : t('Not set')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Summary footer */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-3 text-xs text-gray-400">
                  <span className="text-green-400">{availabilitySummary.available} {t('Available').toLowerCase()}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-red-400">{availabilitySummary.unavailable} {t('Unavailable').toLowerCase()}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-500">{availabilitySummary.notSet} {t('Not set').toLowerCase()}</span>
                </div>
              </>
            )}
          </div>
          )}
        </div>

      </div>

      {/* Job Details Popup */}
      <ScheduleJobPopup
        jobSession={selectedJob}
        open={popupOpen}
        onClose={handleClosePopup}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
