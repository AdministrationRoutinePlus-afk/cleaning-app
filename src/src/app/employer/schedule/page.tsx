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
import { format, addDays, startOfWeek, isSameDay, differenceInDays, parseISO, startOfDay, isWithinInterval } from 'date-fns'
import type { JobSession, JobTemplate, Employee, Customer, JobSessionStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { ScheduleJobPopup } from '@/components/employer/ScheduleJobPopup'
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, Users, Briefcase, Eye, EyeOff, Calendar } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { toast } from 'sonner'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate & { customer: Customer | null }
  employee: Employee | null
}

// Status configuration
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  OFFERED: { label: 'Open', bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30', dot: 'bg-gray-500' },
  CLAIMED: { label: 'Claimed', bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  APPROVED: { label: 'Approved', bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', dot: 'bg-purple-500' },
  COMPLETED: { label: 'Completed', bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30', dot: 'bg-green-500' },
  EVALUATED: { label: 'Evaluated', bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30', dot: 'bg-teal-500' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', dot: 'bg-red-500' },
  MISSED: { label: 'Missed', bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', dot: 'bg-red-600' },
  OVERDUE: { label: 'Overdue', bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', dot: 'bg-red-600' },
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMountedRef.current) return

      // Get the employer's ID to filter job sessions by their own jobs only
      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer || !isMountedRef.current) return

      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates!inner(*, customer:customers(*)),
          employee:employees(*)
        `)
        .eq('job_template.created_by', employer.id)
        .order('scheduled_date', { ascending: true })

      if (error) {
        console.error('Error fetching job sessions:', error)
        toast.error('Failed to load job sessions')
        return
      }

      if (isMountedRef.current) {
        setJobSessions(data as JobSessionWithDetails[])
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to load schedule')
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [supabase])

  useEffect(() => {
    fetchJobSessions()
  }, [fetchJobSessions])

  // Generate 7 days for the week
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(startDate, i)),
    [startDate]
  )

  const selectedDay = days[selectedDayIndex]
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

  // Summary stats for the week
  const weekStats = useMemo(() => {
    let totalJobs = 0
    let unclaimed = 0
    let issues = 0
    let inProgress = 0

    days.forEach(day => {
      const dayJobs = getJobsForDay(day)
      totalJobs += dayJobs.length
      unclaimed += dayJobs.filter(s => s.status === 'OFFERED').length
      issues += dayJobs.filter(s => isJobMissedOrOverdue(s)).length
      inProgress += dayJobs.filter(s => s.status === 'IN_PROGRESS').length
    })

    return { totalJobs, unclaimed, issues, inProgress }
  }, [days, getJobsForDay])

  // Jobs for selected day, filtered
  const selectedDayJobs = useMemo(() => {
    const jobs = getJobsForDay(selectedDay)
    if (showCompleted) return jobs
    return jobs.filter(s => !['COMPLETED', 'EVALUATED', 'CANCELLED'].includes(s.status))
  }, [selectedDay, getJobsForDay, showCompleted])

  // Group jobs by employee for the selected day
  const jobsByEmployee = useMemo(() => {
    const groups: { employee: Employee | null; label: string; jobs: JobSessionWithDetails[] }[] = []

    // Unassigned jobs first
    const unassigned = selectedDayJobs.filter(s => !s.employee)
    if (unassigned.length > 0) {
      groups.push({ employee: null, label: 'Unassigned', jobs: unassigned })
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

        {/* Summary Stats Bar */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-white/5 rounded-xl p-2 text-center border border-white/10">
            <Briefcase className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{weekStats.totalJobs}</div>
            <div className="text-[10px] text-gray-500 uppercase">This Week</div>
          </div>
          <div className={`rounded-xl p-2 text-center border ${weekStats.unclaimed > 0 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/5 border-white/10'}`}>
            <Eye className="w-4 h-4 text-orange-400 mx-auto mb-1" />
            <div className={`text-lg font-bold ${weekStats.unclaimed > 0 ? 'text-orange-400' : 'text-white'}`}>{weekStats.unclaimed}</div>
            <div className="text-[10px] text-gray-500 uppercase">Unclaimed</div>
          </div>
          <div className="bg-white/5 rounded-xl p-2 text-center border border-white/10">
            <Clock className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{weekStats.inProgress}</div>
            <div className="text-[10px] text-gray-500 uppercase">Active</div>
          </div>
          <div className={`rounded-xl p-2 text-center border ${weekStats.issues > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
            <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <div className={`text-lg font-bold ${weekStats.issues > 0 ? 'text-red-400' : 'text-white'}`}>{weekStats.issues}</div>
            <div className="text-[10px] text-gray-500 uppercase">Issues</div>
          </div>
        </div>

        {/* Week Navigation & Days */}
        <div className="bg-white/10 rounded-2xl border border-white/20 overflow-hidden mb-6">
          {/* Week Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={goToPreviousWeek}
                className="p-2 rounded-xl bg-white/20 border border-white/30 hover:bg-white/30 transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>

              <button onClick={goToThisWeek} className="flex flex-col items-center">
                <span className="text-xl font-bold text-white">{weekRangeText}</span>
                {isCurrentWeek ? (
                  <span className="text-xs text-blue-200 font-medium">This Week</span>
                ) : (
                  <span className="text-xs text-white/70 hover:text-white">Tap for this week</span>
                )}
              </button>

              <button
                onClick={goToNextWeek}
                className="p-2 rounded-xl bg-white/20 border border-white/30 hover:bg-white/30 transition-all"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Days Grid */}
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const dayJobs = getJobsForDay(day)
                const isToday = isSameDay(day, new Date())
                const hasJobs = dayJobs.length > 0
                const isSelected = selectedDayIndex === index
                const hasUnclaimed = dayJobs.some(s => s.status === 'OFFERED')
                const hasIssues = dayJobs.some(s => isJobMissedOrOverdue(s))
                const activeCount = dayJobs.filter(s => !['COMPLETED', 'EVALUATED', 'CANCELLED'].includes(s.status)).length

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDayIndex(index)}
                    className={`flex flex-col items-center justify-center rounded-xl py-2 transition-all relative ${
                      hasJobs
                        ? isSelected
                          ? 'bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-400'
                          : 'bg-gradient-to-br from-purple-600/30 to-purple-800/30 text-purple-300 border-2 border-purple-500/30 hover:border-purple-400/50'
                        : isSelected
                          ? 'bg-white/20 text-white border-2 border-white/40'
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

                    <span className={`text-[10px] font-medium ${hasJobs ? '' : 'text-gray-500'}`}>
                      {format(day, 'EEE')}
                    </span>
                    <span className={`text-lg font-bold ${hasJobs ? '' : 'text-gray-600'}`}>
                      {format(day, 'd')}
                    </span>
                    {hasJobs && (
                      <span className={`text-[10px] rounded-full px-1.5 mt-0.5 ${
                        isSelected ? 'bg-white/20' : 'bg-purple-500/30'
                      }`}>
                        {activeCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Selected Day Content */}
        <div className="bg-white/10 rounded-2xl border border-white/20 overflow-hidden mb-6">
          {/* Day Header */}
          <div className={`p-4 ${
            selectedDayJobs.length > 0
              ? 'bg-gradient-to-r from-purple-600 to-pink-600'
              : 'bg-gradient-to-r from-gray-600 to-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {format(selectedDay, 'EEEE, MMMM d')}
                  {isSameDay(selectedDay, new Date()) && (
                    <span className="ml-2 text-sm text-white/70 font-normal">(Today)</span>
                  )}
                </h3>
                {selectedDayJobs.length > 0 && (
                  <p className="text-white/80 text-sm mt-0.5">
                    {selectedDayJobs.length} job{selectedDayJobs.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="p-2 rounded-lg bg-white/20 border border-white/30 hover:bg-white/30 transition-all"
                title={showCompleted ? 'Hide completed' : 'Show completed'}
              >
                {showCompleted ? (
                  <EyeOff className="w-4 h-4 text-white" />
                ) : (
                  <Eye className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          </div>

          <div className="p-4">
            {selectedDayJobs.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">
                  {showCompleted ? 'No jobs scheduled' : 'No active jobs'}
                </p>
                {!showCompleted && (
                  <button
                    onClick={() => setShowCompleted(true)}
                    className="text-sm text-purple-400 hover:text-purple-300 mt-2"
                  >
                    Show completed jobs
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
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
                        <div>
                          <span className={`font-semibold text-sm ${group.employee ? 'text-white' : 'text-orange-400'}`}>
                            {group.label}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {group.jobs.length} job{group.jobs.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Jobs for this employee */}
                      <div className="space-y-2 ml-10">
                        {group.jobs.map(session => {
                          const effectiveStatus = getEffectiveStatus(session)
                          const statusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.OFFERED
                          const urgency = getUrgencyForOffered(session)
                          const isUrgent = urgency === 'urgent'
                          const isWarning = urgency === 'warning'

                          return (
                            <button
                              key={session.id}
                              onClick={() => handleSelectJob(session)}
                              className={`w-full text-left bg-white/5 rounded-xl p-3 border transition-all hover:bg-white/10 ${
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
                                  {isUrgent && effectiveStatus === 'OFFERED' ? 'URGENT' :
                                   isWarning && effectiveStatus === 'OFFERED' ? 'WARNING' :
                                   statusConfig.label}
                                </span>
                              </div>

                              <h4 className="text-white font-medium text-sm truncate">
                                {session.job_template?.title || 'Untitled Job'}
                              </h4>

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
        </div>

        {/* Legend */}
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { dot: 'bg-gray-500', label: 'Open' },
              { dot: 'bg-yellow-500', label: 'Claimed' },
              { dot: 'bg-blue-500', label: 'Approved' },
              { dot: 'bg-purple-500', label: 'In Progress' },
              { dot: 'bg-green-500', label: 'Completed' },
              { dot: 'bg-red-500', label: 'Issue' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                <span className="text-[10px] text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>
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
