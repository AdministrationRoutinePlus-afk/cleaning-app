'use client'

import { useState, useEffect, useMemo } from 'react'
import { Calendar, momentLocalizer, View } from 'react-big-calendar'
import moment from 'moment'
import type { JobSession, JobTemplate, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, Calendar as CalendarIcon } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = momentLocalizer(moment)

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate & {
    customer: Customer | null
  }
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: JobSessionWithDetails
}

export default function EmployeeSchedulePage() {
  const [sessions, setSessions] = useState<JobSessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [view, setView] = useState<View>('month')
  const [date, setDate] = useState(new Date())
  const supabase = createClient()

  useEffect(() => {
    loadScheduledJobs()
  }, [])

  const loadScheduledJobs = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get employee record
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employee) return

      // Fetch job sessions that are APPROVED or IN_PROGRESS
      const { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          )
        `)
        .eq('assigned_to', employee.id)
        .in('status', ['APPROVED', 'IN_PROGRESS'])
        .not('scheduled_date', 'is', null)
        .order('scheduled_date', { ascending: true })

      if (error) throw error

      setSessions((data as JobSessionWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading scheduled jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const events: CalendarEvent[] = useMemo(() => {
    return sessions
      .filter(session => session.scheduled_date)
      .map(session => {
        const scheduledDate = moment(session.scheduled_date)

        // Parse scheduled time if available
        let startTime = scheduledDate.clone()
        let endTime = scheduledDate.clone()

        if (session.scheduled_time) {
          const [hours, minutes] = session.scheduled_time.split(':')
          startTime.set({ hour: parseInt(hours), minute: parseInt(minutes) })
          endTime = startTime.clone()
        }

        // Add duration if available
        if (session.job_template.duration_minutes) {
          endTime.add(session.job_template.duration_minutes, 'minutes')
        } else {
          endTime.add(1, 'hour') // Default 1 hour
        }

        const customerName = session.job_template.customer?.full_name || 'Unknown Customer'
        const title = `${session.job_template.title} - ${customerName}`

        return {
          id: session.id,
          title,
          start: startTime.toDate(),
          end: endTime.toDate(),
          resource: session
        }
      })
  }, [sessions])

  const eventStyleGetter = (event: CalendarEvent) => {
    const session = event.resource
    let backgroundColor = '#3b82f6' // blue for APPROVED

    if (session.status === 'IN_PROGRESS') {
      backgroundColor = '#f59e0b' // amber for IN_PROGRESS
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        display: 'block',
        fontSize: '0.875rem',
        padding: '2px 5px'
      }
    }
  }

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event)
  }

  const exportToICS = () => {
    // Generate ICS file content
    const icsEvents = events.map(event => {
      const start = moment(event.start).format('YYYYMMDDTHHmmss')
      const end = moment(event.end).format('YYYYMMDDTHHmmss')
      const session = event.resource

      return `BEGIN:VEVENT
UID:${event.id}@cleaning-app
DTSTAMP:${moment().format('YYYYMMDDTHHmmss')}
DTSTART:${start}
DTEND:${end}
SUMMARY:${event.title}
DESCRIPTION:${session.job_template.description || ''}
LOCATION:${session.job_template.address || ''}
STATUS:CONFIRMED
END:VEVENT`
    }).join('\n')

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Cleaning App//Employee Schedule//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${icsEvents}
END:VCALENDAR`

    // Create and download file
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `schedule-${moment().format('YYYY-MM-DD')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-blue-600">Scheduled</Badge>
      case 'IN_PROGRESS':
        return <Badge className="bg-amber-500">In Progress</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
            <Button onClick={exportToICS} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export to Calendar
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              <span className="text-sm text-gray-600">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded"></div>
              <span className="text-sm text-gray-600">In Progress</span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <Card className="p-4 mb-6">
          <div className="calendar-container" style={{ height: '600px' }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              views={['month', 'week', 'work_week', 'day', 'agenda']}
              messages={{
                work_week: '2 Weeks'
              }}
              popup
            />
          </div>
        </Card>

        {/* Upcoming Jobs */}
        {sessions.length > 0 && (
          <Card className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Jobs</h2>
            <div className="space-y-3">
              {sessions.slice(0, 5).map(session => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{session.job_template.title}</h3>
                      {getStatusBadge(session.status)}
                    </div>
                    <p className="text-sm text-gray-600">
                      {session.job_template.customer?.full_name || 'Unknown Customer'}
                    </p>
                    {session.scheduled_date && (
                      <p className="text-sm text-gray-500 mt-1">
                        {moment(session.scheduled_date).format('MMMM D, YYYY')}
                        {session.scheduled_time && ` at ${moment(session.scheduled_time, 'HH:mm:ss').format('h:mm A')}`}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = `/employee/jobs/${session.id}`}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {sessions.length === 0 && (
          <Card className="p-8 text-center">
            <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No scheduled jobs</h3>
            <p className="text-gray-600">Check the marketplace for available jobs.</p>
          </Card>
        )}

        {/* Job Detail Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Job Details</DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{selectedEvent.resource.job_template.title}</h3>
                  {getStatusBadge(selectedEvent.resource.status)}
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Customer:</span>
                    <p className="text-gray-900">
                      {selectedEvent.resource.job_template.customer?.full_name || 'Unknown'}
                    </p>
                  </div>

                  <div>
                    <span className="font-medium text-gray-700">Date & Time:</span>
                    <p className="text-gray-900">
                      {moment(selectedEvent.start).format('MMMM D, YYYY [at] h:mm A')}
                    </p>
                  </div>

                  {selectedEvent.resource.job_template.duration_minutes && (
                    <div>
                      <span className="font-medium text-gray-700">Duration:</span>
                      <p className="text-gray-900">
                        {selectedEvent.resource.job_template.duration_minutes} minutes
                      </p>
                    </div>
                  )}

                  {selectedEvent.resource.job_template.address && (
                    <div>
                      <span className="font-medium text-gray-700">Address:</span>
                      <p className="text-gray-900">{selectedEvent.resource.job_template.address}</p>
                    </div>
                  )}

                  {selectedEvent.resource.job_template.description && (
                    <div>
                      <span className="font-medium text-gray-700">Description:</span>
                      <p className="text-gray-900">{selectedEvent.resource.job_template.description}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      window.location.href = `/employee/jobs/${selectedEvent.resource.id}`
                    }}
                  >
                    View Job
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedEvent(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
