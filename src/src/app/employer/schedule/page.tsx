'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View, Event as CalendarEvent } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import type { JobSession, JobTemplate, Employee, JobSessionStatus } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { ScheduleJobPopup } from '@/components/employer/ScheduleJobPopup'
import 'react-big-calendar/lib/css/react-big-calendar.css'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate
  employee: Employee | null
}

interface ScheduleEvent extends CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: JobSessionWithDetails
  status: JobSessionStatus
}

// Setup the localizer for react-big-calendar
const locales = {
  'en-US': require('date-fns/locale/en-US')
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales
})

export default function EmployerSchedulePage() {
  const [jobSessions, setJobSessions] = useState<JobSessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<JobSessionWithDetails | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())

  const supabase = createClient()

  const fetchJobSessions = useCallback(async () => {
    setLoading(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        return
      }

      // Fetch job sessions with job template and employee details
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(*),
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

  // Convert job sessions to calendar events
  const events: ScheduleEvent[] = useMemo(() => {
    return jobSessions
      .filter(session => session.scheduled_date && session.scheduled_time)
      .map(session => {
        // Combine date and time to create start datetime
        const [hours, minutes] = session.scheduled_time!.split(':')
        const startDate = new Date(session.scheduled_date!)
        startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)

        // Calculate end time based on duration
        const endDate = new Date(startDate)
        const durationMinutes = session.job_template.duration_minutes || 60
        endDate.setMinutes(endDate.getMinutes() + durationMinutes)

        return {
          id: session.id,
          title: `${session.job_template.job_code} - ${session.job_template.title}`,
          start: startDate,
          end: endDate,
          resource: session,
          status: session.status
        }
      })
  }, [jobSessions])

  const handleSelectEvent = (event: ScheduleEvent) => {
    setSelectedJob(event.resource)
    setPopupOpen(true)
  }

  const handleClosePopup = () => {
    setPopupOpen(false)
    setSelectedJob(null)
  }

  const handleUpdate = () => {
    fetchJobSessions()
  }

  // Custom event styling based on status
  const eventStyleGetter = (event: ScheduleEvent) => {
    let backgroundColor = '#6b7280' // gray (default)

    switch (event.status) {
      case 'OFFERED':
        backgroundColor = '#6b7280' // gray
        break
      case 'CLAIMED':
        backgroundColor = '#eab308' // yellow
        break
      case 'APPROVED':
        backgroundColor = '#3b82f6' // blue
        break
      case 'IN_PROGRESS':
        backgroundColor = '#a855f7' // purple
        break
      case 'COMPLETED':
        backgroundColor = '#22c55e' // green
        break
      case 'CANCELLED':
        backgroundColor = '#ef4444' // red
        break
      case 'EVALUATED':
        backgroundColor = '#14b8a6' // teal
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Schedule</h1>
          <p className="text-gray-600">View and manage your job schedule</p>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">Status Legend:</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-gray-500 rounded"></div>
              <span>Offered</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>Claimed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>Approved</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Cancelled</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-teal-500 rounded"></div>
              <span>Evaluated</span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow p-4">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-gray-500">Loading schedule...</div>
            </div>
          ) : (
            <div className="h-[600px] md:h-[700px]">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                views={['month', 'week', 'day']}
                popup
                style={{ height: '100%' }}
                className="employer-schedule-calendar"
              />
            </div>
          )}
        </div>

        {/* Job Details Popup */}
        <ScheduleJobPopup
          jobSession={selectedJob}
          open={popupOpen}
          onClose={handleClosePopup}
          onUpdate={handleUpdate}
        />
      </div>

      {/* Custom CSS for calendar mobile responsiveness */}
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
