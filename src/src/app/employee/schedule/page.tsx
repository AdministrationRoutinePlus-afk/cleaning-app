'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Calendar, momentLocalizer, View } from 'react-big-calendar'
import moment from 'moment'
import type { JobSession, JobTemplate, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, Calendar as CalendarIcon } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import LoadingSpinner from '@/components/LoadingSpinner'

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
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [exportRange, setExportRange] = useState<'week' | '2weeks' | 'month' | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [printTheme, setPrintTheme] = useState<'dark' | 'light'>('dark')
  const calendarRef = useRef<HTMLDivElement>(null)
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

  const openExportDialog = () => {
    setShowExportDialog(true)
    setShowPreview(false)
    setExportRange('week')
  }

  const handleShowPreview = () => {
    setShowPreview(true)
  }

  const generateCalendarPDF = async (range: 'week' | '2weeks' | 'month') => {
    // Wait for dialog content to be fully rendered
    await new Promise(resolve => setTimeout(resolve, 300))

    const calendarElement = calendarRef.current
    if (!calendarElement) {
      console.error('Calendar element not found')
      setShowExportDialog(false)
      setExportRange(null)
      alert('Failed to generate PDF: Calendar element not found')
      return
    }

    try {
      const canvas = await html2canvas(calendarElement, {
        scale: 2,
        backgroundColor: printTheme === 'dark' ? '#1a1a1a' : '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          // Fix color functions that html2canvas doesn't support
          const clonedElement = clonedDoc.querySelector('[data-pdf-export]')
          if (clonedElement) {
            // Force all computed styles to be explicit
            const allElements = clonedElement.querySelectorAll('*')
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement
              const computedStyle = window.getComputedStyle(el)
              // Override problematic color properties with fallback colors
              if (computedStyle.color) {
                try {
                  htmlEl.style.color = computedStyle.color
                } catch (e) {
                  // Ignore errors
                }
              }
              if (computedStyle.backgroundColor) {
                try {
                  htmlEl.style.backgroundColor = computedStyle.backgroundColor
                } catch (e) {
                  // Ignore errors
                }
              }
            })
          }
        }
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Handle very tall content by splitting into pages
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= 297 // A4 height in mm

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= 297
      }

      const rangeText = range === 'week' ? '1-Week' : range === '2weeks' ? '2-Weeks' : 'Month'
      pdf.save(`schedule-${rangeText}-${moment().format('YYYY-MM-DD')}.pdf`)

      setShowExportDialog(false)
      setExportRange(null)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setShowExportDialog(false)
      setExportRange(null)
    }
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
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Card className="mb-6 p-6 bg-white/5 backdrop-blur-md border-white/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <h1 className="text-3xl font-bold text-white">My Schedule</h1>

            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="inline-flex bg-gradient-to-r from-white/10 to-white/5 rounded-xl p-1.5 border border-white/20 shadow-lg">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    viewMode === 'calendar'
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Calendar
                </button>
              </div>

              {/* Export Button */}
              <button
                onClick={openExportDialog}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-500/50 hover:from-blue-500 hover:to-blue-600 transition-all duration-200 shadow-lg shadow-blue-600/30 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Get the next 7 days pictures
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 bg-blue-600 rounded-full shadow-lg shadow-blue-600/50"></div>
              <span className="text-sm font-medium text-gray-300">Scheduled</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 bg-amber-500 rounded-full shadow-lg shadow-amber-500/50"></div>
              <span className="text-sm font-medium text-gray-300">In Progress</span>
            </div>
          </div>
        </Card>

        {/* List View */}
        {viewMode === 'list' && (
          <Card className="p-4 mb-6 bg-white/10 backdrop-blur-md border-white/20">
            <h2 className="text-lg font-semibold text-white mb-4">Your Schedule</h2>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300">No scheduled jobs yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session, index) => {
                const date = moment(session.scheduled_date)
                const isToday = date.isSame(moment(), 'day')
                const isTomorrow = date.isSame(moment().add(1, 'day'), 'day')

                return (
                  <div
                    key={session.id}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      session.status === 'IN_PROGRESS'
                        ? 'bg-amber-500/20 border-amber-500/50'
                        : isToday
                        ? 'bg-blue-500/20 border-blue-500/50'
                        : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                    }`}
                    onClick={() => window.location.href = `/employee/jobs/${session.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isToday && (
                            <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              TODAY
                            </span>
                          )}
                          {isTomorrow && (
                            <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              TOMORROW
                            </span>
                          )}
                          {session.status === 'IN_PROGRESS' && (
                            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              IN PROGRESS
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">
                          {session.job_template.title}
                        </h3>
                        <p className="text-sm text-gray-300 mb-2">
                          {session.job_template.customer?.full_name || session.job_template.client_code || 'Unknown Customer'}
                        </p>
                      </div>
                    </div>

                    {/* Duration */}
                    {session.job_template.duration_minutes && (
                      <div className="bg-white/5 rounded-lg p-2 mb-3 border border-white/10">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400">Duration:</span>
                          <span className="text-white font-semibold ml-auto">
                            {Math.floor(session.job_template.duration_minutes / 60)}h {session.job_template.duration_minutes % 60}m
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Time Window */}
                    {(session.job_template.time_window_start || session.job_template.time_window_end) && (
                      <div className="bg-white/5 rounded-lg p-3 mb-3 border border-white/10 space-y-2">
                        <div className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">
                          Time Window
                        </div>

                        {/* Start */}
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500 uppercase">Start</div>
                          <div className="text-sm text-white font-medium">
                            {date.format('ddd, MMM D, YYYY')}
                          </div>
                          {session.job_template.time_window_start && (
                            <div className="text-lg text-white font-bold">
                              {session.job_template.time_window_start.substring(0, 5)}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-white/10 my-2"></div>

                        {/* End */}
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500 uppercase">End</div>
                          <div className="text-sm text-white font-medium">
                            {session.scheduled_end_date
                              ? moment(session.scheduled_end_date).format('ddd, MMM D, YYYY')
                              : date.format('ddd, MMM D, YYYY')}
                          </div>
                          {session.job_template.time_window_end && (
                            <div className="text-lg text-white font-bold">
                              {session.job_template.time_window_end.substring(0, 5)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {session.job_template.address && (
                      <div className="bg-white/5 rounded-lg p-2 mb-2">
                        <p className="text-xs text-gray-400 mb-1">LOCATION</p>
                        <p className="text-sm text-white">{session.job_template.address}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-xs text-gray-400 font-mono">
                        {session.job_template.job_code}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-white/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.location.href = `/employee/jobs/${session.id}`
                        }}
                      >
                        View Details →
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </Card>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <>
            {/* Custom View Toolbar */}
            <div className="mb-4 flex justify-center">
              <div className="inline-flex bg-white/5 rounded-lg p-1 border border-white/10">
                <button
                  onClick={() => setView('month')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    view === 'month'
                      ? 'bg-white/20 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setView('week')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    view === 'week'
                      ? 'bg-white/20 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Week
                </button>
              </div>
            </div>

            {/* Month view uses the calendar */}
            {view === 'month' && (
              <Card className="p-4 mb-6 bg-white/10 backdrop-blur-md border-white/20">
                <div className="calendar-dark-theme calendar-simplified">
                  <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: 600 }}
                    onSelectEvent={handleSelectEvent}
                    eventPropGetter={eventStyleGetter}
                    view="month"
                    onView={setView}
                    date={date}
                    onNavigate={setDate}
                    views={['month']}
                    formats={{
                      dayFormat: 'ddd D',
                      weekdayFormat: 'ddd',
                    }}
                  />
                </div>
              </Card>
            )}

            {/* Custom Week View */}
            {view === 'week' && (
              <Card className="p-4 mb-6 bg-white/10 backdrop-blur-md border-white/20">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Next 7 Days: {moment(date).format('MMM D')} - {moment(date).add(6, 'days').format('MMM D, YYYY')}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDate(moment(date).subtract(7, 'days').toDate())}
                      className="px-3 py-1 bg-white/10 border border-white/20 text-white rounded hover:bg-white/20"
                    >
                      ← Prev 7 Days
                    </button>
                    <button
                      onClick={() => setDate(new Date())}
                      className="px-3 py-1 bg-white/10 border border-white/20 text-white rounded hover:bg-white/20"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setDate(moment(date).add(7, 'days').toDate())}
                      className="px-3 py-1 bg-white/10 border border-white/20 text-white rounded hover:bg-white/20"
                    >
                      Next 7 Days →
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex gap-3 pb-4" style={{ minWidth: 'max-content' }}>
                    {Array.from({ length: 7 }).map((_, i) => {
                      const dayDate = moment(date).add(i, 'days')
                      const dayEvents = events.filter(e =>
                        moment(e.start).isSame(dayDate, 'day')
                      )
                      const isToday = dayDate.isSame(moment(), 'day')

                      return (
                        <div
                          key={i}
                          className={`flex-shrink-0 w-64 bg-white/5 rounded-lg border-2 p-3 ${
                            isToday ? 'border-blue-500/50' : 'border-white/10'
                          }`}
                        >
                          <div className="mb-3">
                            <div className={`text-sm font-semibold ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                              {dayDate.format('ddd')}
                            </div>
                            <div className={`text-2xl font-bold ${isToday ? 'text-blue-300' : 'text-white'}`}>
                              {dayDate.format('D')}
                            </div>
                          </div>
                          <div className="space-y-2">
                            {dayEvents.length === 0 ? (
                              <div className="text-sm text-gray-500 italic py-4 text-center">
                                No jobs
                              </div>
                            ) : (
                              dayEvents.map(event => (
                                <div
                                  key={event.id}
                                  onClick={() => handleSelectEvent(event)}
                                  className="bg-gradient-to-br from-blue-600/80 to-blue-700/80 p-3 rounded-lg cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all border border-blue-500/30"
                                >
                                  <div className="text-sm font-semibold text-white mb-1">
                                    {event.resource.job_template.title}
                                  </div>
                                  <div className="text-xs text-blue-200">
                                    {event.resource.job_template.customer?.full_name || 'No customer'}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>
            )}

          </>
        )}

        {/* Upcoming Jobs - Show in both views */}
        {sessions.length > 0 && viewMode === 'list' && (
          <Card className="p-4 bg-white/10 backdrop-blur-md border-white/20">
            <h2 className="text-lg font-semibold text-white mb-4">Upcoming Jobs</h2>
            <div className="space-y-3">
              {sessions.slice(0, 5).map(session => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/10"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white">{session.job_template.title}</h3>
                      {getStatusBadge(session.status)}
                    </div>
                    <p className="text-sm text-gray-300">
                      {session.job_template.customer?.full_name || session.job_template.client_code || 'Unknown Customer'}
                    </p>
                    {session.scheduled_date && (
                      <p className="text-sm text-gray-400 mt-1">
                        {moment(session.scheduled_date).format('MMMM D, YYYY')}
                        {session.scheduled_time && ` at ${moment(session.scheduled_time, 'HH:mm:ss').format('h:mm A')}`}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = `/employee/jobs/${session.id}`}
                    className="text-white hover:bg-white/10"
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {sessions.length === 0 && (
          <Card className="p-8 text-center bg-white/10 backdrop-blur-md border-white/20">
            <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No scheduled jobs</h3>
            <p className="text-gray-300">Check the marketplace for available jobs.</p>
          </Card>
        )}

        {/* Job Detail Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white">
                {selectedEvent?.resource.job_template.title}
              </DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <div className="space-y-3">
                {/* Status Badge */}
                <div>
                  {getStatusBadge(selectedEvent.resource.status)}
                </div>

                {/* Customer */}
                {selectedEvent.resource.job_template.customer && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="text-gray-400">Customer:</span>
                    <span className="text-white font-medium">
                      {selectedEvent.resource.job_template.customer.full_name}
                    </span>
                  </div>
                )}

                {/* Duration */}
                {selectedEvent.resource.job_template.duration_minutes && (
                  <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-white font-semibold ml-auto">
                        {Math.floor(selectedEvent.resource.job_template.duration_minutes / 60)}h{' '}
                        {selectedEvent.resource.job_template.duration_minutes % 60}m
                      </span>
                    </div>
                  </div>
                )}

                {/* Time Window */}
                {(selectedEvent.resource.job_template.time_window_start || selectedEvent.resource.job_template.time_window_end) && (
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-2">
                    <div className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">
                      Time Window
                    </div>

                    {/* Start */}
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500 uppercase">Start</div>
                      <div className="text-sm text-white font-medium">
                        {moment(selectedEvent.resource.scheduled_date).format('ddd, MMM D, YYYY')}
                      </div>
                      {selectedEvent.resource.job_template.time_window_start && (
                        <div className="text-lg text-white font-bold">
                          {selectedEvent.resource.job_template.time_window_start.substring(0, 5)}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/10 my-2"></div>

                    {/* End */}
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500 uppercase">End</div>
                      <div className="text-sm text-white font-medium">
                        {moment(selectedEvent.resource.scheduled_end_date || selectedEvent.resource.scheduled_date).format('ddd, MMM D, YYYY')}
                      </div>
                      {selectedEvent.resource.job_template.time_window_end && (
                        <div className="text-lg text-white font-bold">
                          {selectedEvent.resource.job_template.time_window_end.substring(0, 5)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Address */}
                {selectedEvent.resource.job_template.address && (
                  <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                    <div className="text-xs text-gray-400 mb-1">LOCATION</div>
                    <div className="text-sm text-white">{selectedEvent.resource.job_template.address}</div>
                  </div>
                )}

                {/* Description */}
                {selectedEvent.resource.job_template.description && (
                  <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                    <div className="text-xs text-gray-400 mb-1">DESCRIPTION</div>
                    <div className="text-sm text-white">{selectedEvent.resource.job_template.description}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    onClick={() => {
                      window.location.href = `/employee/jobs/${selectedEvent.resource.id}`
                    }}
                  >
                    View Full Details
                  </button>
                  <button
                    className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg border border-white/20 transition-colors"
                    onClick={() => setSelectedEvent(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Export Calendar Dialog */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className={`${showPreview ? 'max-w-6xl' : 'max-w-md'} max-h-[90vh] overflow-auto bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20`}>
            {!showPreview ? (
              /* Theme Selection Screen */
              <>
                <DialogHeader>
                  <DialogTitle className="text-white text-center text-2xl mb-2">
                    Export Your 7-Day Schedule
                  </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center gap-6 py-8">
                  <p className="text-gray-300 text-base">Choose your preferred theme:</p>

                  <div className="flex flex-col gap-4 w-full max-w-xs">
                    <button
                      onClick={() => {
                        setPrintTheme('dark')
                      }}
                      className={`px-8 py-6 rounded-xl text-base font-semibold transition-all duration-200 ${
                        printTheme === 'dark'
                          ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-white shadow-xl border-2 border-blue-500'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 border-2 border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-2xl">🌙</span>
                        <span>Dark Theme</span>
                      </div>
                      <p className={`text-xs mt-2 ${printTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Better for screens
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        setPrintTheme('light')
                      }}
                      className={`px-8 py-6 rounded-xl text-base font-semibold transition-all duration-200 ${
                        printTheme === 'light'
                          ? 'bg-gradient-to-r from-gray-100 to-white text-gray-900 shadow-xl border-2 border-blue-500'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 border-2 border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-2xl">☀️</span>
                        <span>Light Theme</span>
                      </div>
                      <p className={`text-xs mt-2 ${printTheme === 'light' ? 'text-gray-600' : 'text-gray-500'}`}>
                        Saves ink when printing
                      </p>
                    </button>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => {
                        handleShowPreview()
                        setTimeout(() => generateCalendarPDF('week'), 500)
                      }}
                      className="px-8 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-500/50 hover:from-blue-500 hover:to-blue-600 transition-all duration-200 shadow-lg shadow-blue-600/30 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Generate PDF
                    </button>
                    <button
                      onClick={() => setShowExportDialog(false)}
                      className="px-8 py-3 rounded-xl text-base font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Preview and Export Screen */
              <>
                <DialogHeader>
                  <DialogTitle className="text-white text-center text-2xl mb-4">
                    Preview Your Schedule
                  </DialogTitle>
                </DialogHeader>
            <div
              ref={calendarRef}
              data-pdf-export
              style={{
                width: '210mm',
                minHeight: '297mm',
                backgroundColor: printTheme === 'dark' ? '#1a1a1a' : '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                padding: '12mm 15mm'
              }}
            >
              <div style={{ width: '100%', maxWidth: '100%' }}>
                <h2 style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: printTheme === 'dark' ? '#ffffff' : '#111827',
                  marginBottom: '6px',
                  textAlign: 'center'
                }}>
                  My Schedule - Next 7 Days
                </h2>
                <p style={{
                  color: printTheme === 'dark' ? '#9ca3af' : '#6b7280',
                  textAlign: 'center',
                  marginBottom: '16px',
                  fontSize: '14px'
                }}>
                  {moment().format('MMMM D, YYYY')} - {moment().add(7, 'days').format('MMMM D, YYYY')}
                </p>

                <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '8px',
                marginBottom: '16px'
              }}>
                {Array.from({ length: 7 }).map((_, i) => {
                  const dayDate = moment().add(i, 'days')
                  const dayJobs = sessions.filter(session =>
                    moment(session.scheduled_date).isSame(dayDate, 'day')
                  )
                  const isToday = dayDate.isSame(moment(), 'day')

                  return (
                    <div
                      key={i}
                      style={{
                        padding: '10px',
                        backgroundColor: printTheme === 'dark'
                          ? (isToday ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)')
                          : (isToday ? 'rgba(59, 130, 246, 0.1)' : '#f9fafb'),
                        borderRadius: '8px',
                        border: printTheme === 'dark'
                          ? (isToday ? '2px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)')
                          : (isToday ? '2px solid rgba(59, 130, 246, 0.4)' : '1px solid #e5e7eb'),
                        minHeight: '140px'
                      }}
                    >
                      <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: printTheme === 'dark'
                            ? (isToday ? '#60a5fa' : '#9ca3af')
                            : (isToday ? '#2563eb' : '#6b7280'),
                          marginBottom: '2px',
                          textTransform: 'uppercase'
                        }}>
                          {dayDate.format('ddd')}
                        </div>
                        <div style={{
                          fontSize: '22px',
                          fontWeight: 'bold',
                          color: printTheme === 'dark'
                            ? (isToday ? '#93c5fd' : '#ffffff')
                            : (isToday ? '#1d4ed8' : '#111827')
                        }}>
                          {dayDate.format('D')}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: printTheme === 'dark' ? '#6b7280' : '#9ca3af'
                        }}>
                          {dayDate.format('MMM')}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {dayJobs.length === 0 ? (
                          <div style={{
                            textAlign: 'center',
                            padding: '12px 0',
                            color: printTheme === 'dark' ? '#6b7280' : '#9ca3af',
                            fontSize: '10px',
                            fontStyle: 'italic'
                          }}>
                            No jobs
                          </div>
                        ) : (
                          dayJobs.map(session => (
                            <div
                              key={session.id}
                              style={{
                                padding: '6px',
                                backgroundColor: printTheme === 'dark'
                                  ? (session.status === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)')
                                  : (session.status === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)'),
                                borderRadius: '6px',
                                border: printTheme === 'dark'
                                  ? (session.status === 'IN_PROGRESS' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)')
                                  : (session.status === 'IN_PROGRESS' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(59, 130, 246, 0.5)')
                              }}
                            >
                              <div style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: printTheme === 'dark' ? '#ffffff' : '#111827',
                                marginBottom: '3px',
                                lineHeight: '1.2'
                              }}>
                                {session.job_template.title}
                              </div>
                              <div style={{
                                fontSize: '9px',
                                color: printTheme === 'dark' ? '#d1d5db' : '#4b5563',
                                marginBottom: '4px'
                              }}>
                                {session.job_template.customer?.full_name || 'No customer'}
                              </div>
                              {session.job_template.time_window_start && (
                                <div style={{
                                  fontSize: '9px',
                                  color: printTheme === 'dark' ? '#9ca3af' : '#6b7280',
                                  fontWeight: '500'
                                }}>
                                  {session.job_template.time_window_start.substring(0, 5)}
                                  {session.job_template.time_window_end &&
                                    ` - ${session.job_template.time_window_end.substring(0, 5)}`
                                  }
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

                {/* Legend */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '24px',
                  paddingTop: '12px',
                  borderTop: printTheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: '#2563eb'
                    }}></div>
                    <span style={{
                      color: printTheme === 'dark' ? '#d1d5db' : '#4b5563',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>Scheduled</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: '#f59e0b'
                    }}></div>
                    <span style={{
                      color: printTheme === 'dark' ? '#d1d5db' : '#4b5563',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>In Progress</span>
                  </div>
                </div>

                {/* Detailed Job List */}
                {(() => {
                  const next7DaysJobs = sessions.filter(session => {
                    const sessionDate = moment(session.scheduled_date)
                    return sessionDate.isBetween(moment(), moment().add(7, 'days'), 'day', '[]')
                  }).sort((a, b) => moment(a.scheduled_date).diff(moment(b.scheduled_date)))

                  if (next7DaysJobs.length === 0) return null

                  return (
                    <div style={{
                      paddingTop: '12px',
                      borderTop: printTheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: printTheme === 'dark' ? '#ffffff' : '#111827',
                        marginBottom: '10px',
                        textAlign: 'center'
                      }}>
                        Job Details
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {next7DaysJobs.map((session, index) => {
                          const jobDate = moment(session.scheduled_date)
                          const endDate = session.scheduled_end_date
                            ? moment(session.scheduled_end_date)
                            : jobDate

                          return (
                            <div
                              key={session.id}
                              style={{
                                padding: '8px',
                                backgroundColor: printTheme === 'dark'
                                  ? 'rgba(255, 255, 255, 0.05)'
                                  : '#f9fafb',
                                borderRadius: '6px',
                                border: printTheme === 'dark'
                                  ? '1px solid rgba(255, 255, 255, 0.1)'
                                  : '1px solid #e5e7eb',
                                display: 'grid',
                                gridTemplateColumns: '1.5fr 2fr 1fr',
                                gap: '12px',
                                alignItems: 'center'
                              }}
                            >
                              {/* Job Info */}
                              <div>
                                <div style={{
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  color: printTheme === 'dark' ? '#ffffff' : '#111827',
                                  marginBottom: '2px'
                                }}>
                                  {session.job_template.title}
                                </div>
                                <div style={{
                                  fontSize: '9px',
                                  color: printTheme === 'dark' ? '#9ca3af' : '#6b7280'
                                }}>
                                  {session.job_template.customer?.full_name || 'No customer'}
                                </div>
                                {session.job_template.address && (
                                  <div style={{
                                    fontSize: '8px',
                                    color: printTheme === 'dark' ? '#6b7280' : '#9ca3af',
                                    marginTop: '2px'
                                  }}>
                                    📍 {session.job_template.address}
                                  </div>
                                )}
                              </div>

                              {/* Time Window */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '8px'
                              }}>
                                {/* Start */}
                                <div>
                                  <div style={{
                                    fontSize: '8px',
                                    color: printTheme === 'dark' ? '#6b7280' : '#9ca3af',
                                    textTransform: 'uppercase',
                                    marginBottom: '2px',
                                    fontWeight: '600'
                                  }}>
                                    Start
                                  </div>
                                  <div style={{
                                    fontSize: '9px',
                                    color: printTheme === 'dark' ? '#d1d5db' : '#4b5563',
                                    fontWeight: '600'
                                  }}>
                                    {jobDate.format('ddd, MMM D')}
                                  </div>
                                  {session.job_template.time_window_start && (
                                    <div style={{
                                      fontSize: '11px',
                                      color: printTheme === 'dark' ? '#ffffff' : '#111827',
                                      fontWeight: 'bold',
                                      marginTop: '1px'
                                    }}>
                                      {session.job_template.time_window_start.substring(0, 5)}
                                    </div>
                                  )}
                                </div>

                                {/* End */}
                                <div>
                                  <div style={{
                                    fontSize: '8px',
                                    color: printTheme === 'dark' ? '#6b7280' : '#9ca3af',
                                    textTransform: 'uppercase',
                                    marginBottom: '2px',
                                    fontWeight: '600'
                                  }}>
                                    End
                                  </div>
                                  <div style={{
                                    fontSize: '9px',
                                    color: printTheme === 'dark' ? '#d1d5db' : '#4b5563',
                                    fontWeight: '600'
                                  }}>
                                    {endDate.format('ddd, MMM D')}
                                  </div>
                                  {session.job_template.time_window_end && (
                                    <div style={{
                                      fontSize: '11px',
                                      color: printTheme === 'dark' ? '#ffffff' : '#111827',
                                      fontWeight: 'bold',
                                      marginTop: '1px'
                                    }}>
                                      {session.job_template.time_window_end.substring(0, 5)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Status & Duration */}
                              <div style={{ textAlign: 'right' }}>
                                <div style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '9px',
                                  fontWeight: '600',
                                  backgroundColor: session.status === 'IN_PROGRESS'
                                    ? 'rgba(245, 158, 11, 0.2)'
                                    : 'rgba(59, 130, 246, 0.2)',
                                  color: session.status === 'IN_PROGRESS'
                                    ? (printTheme === 'dark' ? '#fbbf24' : '#d97706')
                                    : (printTheme === 'dark' ? '#60a5fa' : '#2563eb'),
                                  border: session.status === 'IN_PROGRESS'
                                    ? '1px solid rgba(245, 158, 11, 0.4)'
                                    : '1px solid rgba(59, 130, 246, 0.4)',
                                  marginBottom: '4px'
                                }}>
                                  {session.status === 'IN_PROGRESS' ? 'In Progress' : 'Scheduled'}
                                </div>
                                {session.job_template.duration_minutes && (
                                  <div style={{
                                    fontSize: '8px',
                                    color: printTheme === 'dark' ? '#9ca3af' : '#6b7280',
                                    marginTop: '2px'
                                  }}>
                                    {Math.floor(session.job_template.duration_minutes / 60)}h {session.job_template.duration_minutes % 60}m
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Generate PDF Button */}
            <div className="flex justify-center gap-3 mt-6 pt-6 border-t border-white/10">
              <button
                onClick={() => setShowPreview(false)}
                className="px-8 py-4 rounded-xl text-base font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-200"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  generateCalendarPDF('week')
                }}
                className="px-8 py-4 rounded-xl text-base font-semibold bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-500/50 hover:from-blue-500 hover:to-blue-600 transition-all duration-200 shadow-lg shadow-blue-600/30 flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Generate PDF
              </button>
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-8 py-4 rounded-xl text-base font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
