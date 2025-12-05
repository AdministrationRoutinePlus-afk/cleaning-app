'use client'

/**
 * Employer Schedule Page - Redesigned with 3 Tabs
 *
 * TAB 1: OPEN JOBS (OFFERED status)
 * - Gray: >4 days away
 * - Orange: ≤4 days (warning)
 * - Red: ≤2 days (urgent)
 *
 * TAB 2: ASSIGNED JOBS
 * - Yellow: CLAIMED (pending approval)
 * - Blue: APPROVED
 *
 * TAB 3: WORK IN PROGRESS
 * - Purple: IN_PROGRESS
 * - Green: COMPLETED
 * - Teal: EVALUATED
 *
 * Each tab has:
 * - Calendar view (visual)
 * - List view (detailed info)
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, differenceInDays } from 'date-fns'
import type { JobSession, JobTemplate, Employee, Customer, JobSessionStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { ScheduleJobPopup } from '@/components/employer/ScheduleJobPopup'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import 'react-big-calendar/lib/css/react-big-calendar.css'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate & { customer: Customer | null }
  employee: Employee | null
}

interface ScheduleEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: JobSessionWithDetails
  status: JobSessionStatus
  daysUntil: number
}

const locales = { 'en-US': require('date-fns/locale/en-US') }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

type ViewMode = 'calendar' | 'list'
type ScheduleTab = 'open' | 'assigned' | 'progress'

export default function EmployerSchedulePage() {
  const [jobSessions, setJobSessions] = useState<JobSessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<JobSessionWithDetails | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const [calendarView, setCalendarView] = useState<View>('month')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [activeTab, setActiveTab] = useState<ScheduleTab>('open')
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')

  const supabase = createClient()

  const fetchJobSessions = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(*, customer:customers(*)),
          employee:employees(*)
        `)
        .order('scheduled_date', { ascending: true })

      if (error) {
        console.error('Error fetching job sessions:', error)
        return
      }

      setJobSessions(data as JobSessionWithDetails[])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchJobSessions()
  }, [fetchJobSessions])

  // Filter jobs by tab
  const filteredSessions = useMemo(() => {
    switch (activeTab) {
      case 'open':
        return jobSessions.filter(s => s.status === 'OFFERED')
      case 'assigned':
        return jobSessions.filter(s => ['CLAIMED', 'APPROVED'].includes(s.status))
      case 'progress':
        return jobSessions.filter(s => ['IN_PROGRESS', 'COMPLETED', 'EVALUATED'].includes(s.status))
      default:
        return []
    }
  }, [jobSessions, activeTab])

  // Convert to calendar events
  const events: ScheduleEvent[] = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return filteredSessions
      .filter(session => session.scheduled_date && session.scheduled_time)
      .map(session => {
        const [hours, minutes] = session.scheduled_time!.split(':')
        const startDate = new Date(session.scheduled_date!)
        startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)

        const endDate = new Date(startDate)
        const durationMinutes = session.job_template?.duration_minutes || 60
        endDate.setMinutes(endDate.getMinutes() + durationMinutes)

        const jobDate = new Date(session.scheduled_date!)
        jobDate.setHours(0, 0, 0, 0)
        const daysUntil = differenceInDays(jobDate, today)

        return {
          id: session.id,
          title: `${session.job_template?.job_code || ''} - ${session.job_template?.title || 'Job'}`,
          start: startDate,
          end: endDate,
          resource: session,
          status: session.status,
          daysUntil
        }
      })
  }, [filteredSessions])

  const handleSelectEvent = (event: ScheduleEvent) => {
    setSelectedJob(event.resource)
    setPopupOpen(true)
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

  // Get urgency label for open jobs
  const getUrgencyInfo = (daysUntil: number) => {
    if (daysUntil <= 2) return { label: 'Urgent', color: 'bg-red-500' }
    if (daysUntil <= 4) return { label: 'Warning', color: 'bg-orange-500' }
    return { label: 'Open', color: 'bg-gray-500' }
  }

  // Status badge color
  const getStatusBadge = (status: JobSessionStatus, daysUntil?: number) => {
    switch (status) {
      case 'OFFERED':
        if (daysUntil !== undefined) {
          const urgency = getUrgencyInfo(daysUntil)
          return <Badge className={urgency.color}>{urgency.label}</Badge>
        }
        return <Badge className="bg-gray-500">Open</Badge>
      case 'CLAIMED':
        return <Badge className="bg-yellow-500">Claimed</Badge>
      case 'APPROVED':
        return <Badge className="bg-blue-500">Approved</Badge>
      case 'IN_PROGRESS':
        return <Badge className="bg-purple-500">In Progress</Badge>
      case 'COMPLETED':
        return <Badge className="bg-green-500">Completed</Badge>
      case 'EVALUATED':
        return <Badge className="bg-teal-500">Evaluated</Badge>
      default:
        return <Badge className="bg-gray-500">{status}</Badge>
    }
  }

  // Calendar event styling
  const eventStyleGetter = (event: ScheduleEvent) => {
    let backgroundColor = '#6b7280'

    switch (event.status) {
      case 'OFFERED':
        if (event.daysUntil <= 2) backgroundColor = '#ef4444'
        else if (event.daysUntil <= 4) backgroundColor = '#f97316'
        else backgroundColor = '#6b7280'
        break
      case 'CLAIMED':
        backgroundColor = '#eab308'
        break
      case 'APPROVED':
        backgroundColor = '#3b82f6'
        break
      case 'IN_PROGRESS':
        backgroundColor = '#a855f7'
        break
      case 'COMPLETED':
        backgroundColor = '#22c55e'
        break
      case 'EVALUATED':
        backgroundColor = '#14b8a6'
        break
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '0.85rem',
        padding: '2px 5px'
      }
    }
  }

  // Tab-specific legends
  const renderLegend = () => {
    switch (activeTab) {
      case 'open':
        return (
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-500 rounded"></div>
              <span>Open (&gt;4 days)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span>Warning (≤4 days)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Urgent (≤2 days)</span>
            </div>
          </div>
        )
      case 'assigned':
        return (
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>Claimed (pending)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>Approved</span>
            </div>
          </div>
        )
      case 'progress':
        return (
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-teal-500 rounded"></div>
              <span>Evaluated</span>
            </div>
          </div>
        )
    }
  }

  // Calculate days until for list view
  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return 999
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const jobDate = new Date(dateStr)
    jobDate.setHours(0, 0, 0, 0)
    return differenceInDays(jobDate, today)
  }

  // Sort sessions for list view
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      const dateA = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0
      const dateB = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0
      return dateA - dateB
    })
  }, [filteredSessions])

  // Tab counts
  const openCount = jobSessions.filter(s => s.status === 'OFFERED').length
  const assignedCount = jobSessions.filter(s => ['CLAIMED', 'APPROVED'].includes(s.status)).length
  const progressCount = jobSessions.filter(s => ['IN_PROGRESS', 'COMPLETED', 'EVALUATED'].includes(s.status)).length

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Schedule</h1>
          <p className="text-gray-600">View and manage your job schedule</p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ScheduleTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="open" className="text-xs sm:text-sm">
              Open Jobs ({openCount})
            </TabsTrigger>
            <TabsTrigger value="assigned" className="text-xs sm:text-sm">
              Assigned ({assignedCount})
            </TabsTrigger>
            <TabsTrigger value="progress" className="text-xs sm:text-sm">
              In Progress ({progressCount})
            </TabsTrigger>
          </TabsList>

          {/* View Toggle + Legend */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm mb-2">Legend:</h3>
                {renderLegend()}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  onClick={() => setViewMode('calendar')}
                >
                  Calendar
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  onClick={() => setViewMode('list')}
                >
                  List
                </Button>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {['open', 'assigned', 'progress'].map((tab) => (
            <TabsContent key={tab} value={tab}>
              {loading ? (
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-center h-96">
                    <div className="text-gray-500">Loading schedule...</div>
                  </div>
                </div>
              ) : viewMode === 'calendar' ? (
                /* Calendar View */
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="h-[600px] md:h-[700px]">
                    <Calendar
                      localizer={localizer}
                      events={events}
                      startAccessor="start"
                      endAccessor="end"
                      view={calendarView}
                      onView={setCalendarView}
                      date={calendarDate}
                      onNavigate={setCalendarDate}
                      onSelectEvent={handleSelectEvent}
                      eventPropGetter={eventStyleGetter}
                      views={{ month: true, week: true, day: true }}
                      popup
                      style={{ height: '100%' }}
                      className="employer-schedule-calendar"
                    />
                  </div>
                </div>
              ) : (
                /* List View */
                <div className="space-y-3">
                  {sortedSessions.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-gray-500">
                        No jobs in this category
                      </CardContent>
                    </Card>
                  ) : (
                    sortedSessions.map((session) => {
                      const daysUntil = getDaysUntil(session.scheduled_date)
                      return (
                        <Card
                          key={session.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handleSelectJob(session)}
                        >
                          <CardContent className="py-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              {/* Left: Job Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-mono text-sm font-semibold text-gray-600">
                                    {session.full_job_code || session.job_template?.job_code}
                                  </span>
                                  {getStatusBadge(session.status, session.status === 'OFFERED' ? daysUntil : undefined)}
                                </div>
                                <p className="font-medium text-gray-900 truncate">
                                  {session.job_template?.title || 'Untitled Job'}
                                </p>
                                {session.job_template?.customer && (
                                  <p className="text-sm text-gray-500">
                                    Customer: {session.job_template.customer.full_name}
                                  </p>
                                )}
                                {session.job_template?.address && (
                                  <p className="text-sm text-gray-500 truncate">
                                    {session.job_template.address}
                                  </p>
                                )}
                              </div>

                              {/* Middle: Date/Time */}
                              <div className="sm:text-center">
                                {session.scheduled_date && (
                                  <>
                                    <p className="font-medium">
                                      {format(new Date(session.scheduled_date), 'EEE, MMM d')}
                                    </p>
                                    {session.scheduled_time && (
                                      <p className="text-sm text-gray-500">{session.scheduled_time}</p>
                                    )}
                                    {session.job_template?.duration_minutes && (
                                      <p className="text-xs text-gray-400">
                                        {Math.floor(session.job_template.duration_minutes / 60)}h {session.job_template.duration_minutes % 60}m
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>

                              {/* Right: Employee Info */}
                              <div className="sm:text-right sm:min-w-[150px]">
                                {session.employee ? (
                                  <>
                                    <p className="font-medium text-gray-900">
                                      {session.employee.full_name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {session.employee.phone || session.employee.email}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">No employee assigned</p>
                                )}
                                {session.job_template?.price_per_hour && (
                                  <p className="text-sm text-green-600 font-medium">
                                    ${session.price_override || session.job_template.price_per_hour}/hr
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Job Details Popup */}
        <ScheduleJobPopup
          jobSession={selectedJob}
          open={popupOpen}
          onClose={handleClosePopup}
          onUpdate={handleUpdate}
        />
      </div>

      {/* Calendar CSS */}
      <style jsx global>{`
        .employer-schedule-calendar {
          font-size: 14px;
        }
        @media (max-width: 768px) {
          .employer-schedule-calendar {
            font-size: 12px;
          }
          .rbc-toolbar {
            flex-direction: column;
            gap: 0.5rem;
          }
          .rbc-toolbar-label {
            font-size: 1rem;
            margin: 0.5rem 0;
          }
          .rbc-btn-group {
            font-size: 0.875rem;
          }
          .rbc-header {
            padding: 0.25rem;
          }
          .rbc-event {
            font-size: 0.75rem;
            padding: 1px 3px;
          }
        }
        .rbc-event {
          cursor: pointer;
        }
        .rbc-event:hover {
          opacity: 1 !important;
        }
        .rbc-today {
          background-color: #f0f9ff;
        }
      `}</style>
    </div>
  )
}
