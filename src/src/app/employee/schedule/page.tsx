'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { JobSession, JobTemplate, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { DashboardDrawer } from '@/components/employee/DashboardDrawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { format, addDays, startOfDay, isWithinInterval, parseISO, isSameDay } from 'date-fns'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import LoadingSpinner from '@/components/LoadingSpinner'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate & {
    customer: Customer | null
  }
}

export default function EmployeeSchedulePage() {
  const [sessions, setSessions] = useState<JobSessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()))
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [printTheme, setPrintTheme] = useState<'dark' | 'light'>('dark')
  const calendarRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

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

  // Get jobs for a specific day (respects time window spanning multiple days)
  const getJobsForDay = (day: Date) => {
    return sessions.filter(session => {
      if (!session.scheduled_date) return false

      const jobStart = startOfDay(parseISO(session.scheduled_date))
      const jobEnd = session.scheduled_end_date
        ? startOfDay(parseISO(session.scheduled_end_date))
        : jobStart

      // Check if this day is within the job's time window
      return isWithinInterval(startOfDay(day), { start: jobStart, end: jobEnd })
    })
  }

  // Check job status for display
  const getJobStatus = (session: JobSessionWithDetails, day: Date) => {
    const now = new Date()
    const isToday = isSameDay(day, now)

    if (session.status === 'IN_PROGRESS') {
      return { label: 'IN PROGRESS', color: 'bg-green-500', pulse: true }
    }

    // Check if within time window
    if (session.job_template.time_window_start && session.job_template.time_window_end && session.scheduled_date) {
      const [startH, startM] = session.job_template.time_window_start.split(':').map(Number)
      const [endH, endM] = session.job_template.time_window_end.split(':').map(Number)

      const windowStart = new Date(session.scheduled_date)
      windowStart.setHours(startH, startM, 0, 0)

      const endDate = session.scheduled_end_date || session.scheduled_date
      const windowEnd = new Date(endDate)
      windowEnd.setHours(endH, endM, 0, 0)

      const isWithinWindow = now >= windowStart && now <= windowEnd
      const isPastWindow = now > windowEnd

      if (isPastWindow && session.status === 'APPROVED') {
        return { label: 'MISSED', color: 'bg-red-500', pulse: false }
      }

      if (isWithinWindow && session.status === 'APPROVED') {
        return { label: 'START NOW', color: 'bg-green-500', pulse: false }
      }
    }

    if (isToday) {
      return { label: 'TODAY', color: 'bg-blue-500', pulse: false }
    }

    return { label: 'SCHEDULED', color: 'bg-blue-500/50', pulse: false }
  }

  // Navigation handlers
  const goToToday = () => setStartDate(startOfDay(new Date()))
  const goToPreviousWeek = () => setStartDate(addDays(startDate, -7))
  const goToNextWeek = () => setStartDate(addDays(startDate, 7))

  // Generate 7 days starting from startDate
  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))

  // PDF Export functions
  const openExportDialog = () => {
    setShowExportDialog(true)
    setShowPreview(false)
  }

  const generateCalendarPDF = async () => {
    await new Promise(resolve => setTimeout(resolve, 300))

    const calendarElement = calendarRef.current
    if (!calendarElement) {
      console.error('Calendar element not found')
      setShowExportDialog(false)
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
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= 297

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= 297
      }

      pdf.save(`schedule-7-days-${format(new Date(), 'yyyy-MM-dd')}.pdf`)

      setShowExportDialog(false)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setShowExportDialog(false)
    }
  }

  // Get jobs for next 7 days for PDF
  const getNext7DaysJobs = () => {
    const today = startOfDay(new Date())
    return sessions.filter(session => {
      if (!session.scheduled_date) return false
      const sessionDate = startOfDay(parseISO(session.scheduled_date))
      const endDate = session.scheduled_end_date
        ? startOfDay(parseISO(session.scheduled_end_date))
        : sessionDate
      const in7Days = addDays(today, 7)
      return sessionDate <= in7Days && endDate >= today
    }).sort((a, b) => {
      const dateA = parseISO(a.scheduled_date!)
      const dateB = parseISO(b.scheduled_date!)
      return dateA.getTime() - dateB.getTime()
    })
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="min-h-screen p-4 pb-24 flex flex-col items-center">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white text-center mb-3">My Schedule</h1>

          {/* Navigation */}
          <div className="flex items-center justify-between bg-white/10 rounded-xl p-2 border border-white/20">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-300" />
            </button>

            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm font-medium text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Today
            </button>

            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>

          {/* Export PDF Button */}
          <button
            onClick={openExportDialog}
            className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 border border-blue-500/50 shadow-lg shadow-blue-600/20"
          >
            <Download className="w-5 h-5" />
            Export PDF Schedule
          </button>
        </div>

        {/* Days with Jobs */}
        <div className="space-y-3">
          {days.map((day, index) => {
            const dayJobs = getJobsForDay(day)
            const isToday = isSameDay(day, new Date())
            const dayName = format(day, 'EEEE')
            const dayDate = format(day, 'MMM d')

            return (
              <DashboardDrawer
                key={day.toISOString()}
                title={`${dayName}, ${dayDate}`}
                icon={
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                    isToday
                      ? 'bg-blue-500 text-white'
                      : dayJobs.length > 0
                        ? 'bg-purple-500/30 text-purple-300'
                        : 'bg-white/10 text-gray-400'
                  }`}>
                    {format(day, 'd')}
                  </div>
                }
                defaultOpen={index === 0}
                badge={dayJobs.length > 0 ? dayJobs.length : undefined}
                badgeColor={isToday ? 'blue' : 'green'}
              >
                {dayJobs.length === 0 ? (
                  <div className="py-4 text-center text-gray-400 text-sm">
                    No jobs scheduled
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayJobs.map(session => {
                      const status = getJobStatus(session, day)
                      const hasImage = session.job_template.image_url
                      const isMultiDay = session.scheduled_date && session.scheduled_end_date &&
                        !isSameDay(parseISO(session.scheduled_date), parseISO(session.scheduled_end_date))

                      return (
                        <div
                          key={`${session.id}-${day.toISOString()}`}
                          onClick={() => window.location.href = `/employee/jobs/${session.id}`}
                          className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all cursor-pointer"
                        >
                          <div className="flex gap-3">
                            {/* Job Image */}
                            <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-white/10">
                              {hasImage ? (
                                <Image
                                  src={session.job_template.image_url!}
                                  alt={session.job_template.title}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-2xl">🧹</span>
                                </div>
                              )}
                            </div>

                            {/* Job Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="text-white font-semibold truncate">
                                  {session.job_template.title}
                                </h3>
                                <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${status.color} ${status.pulse ? 'animate-pulse' : ''}`}>
                                  {status.label}
                                </span>
                              </div>

                              <p className="text-gray-400 text-sm truncate mb-1">
                                {session.job_template.customer?.full_name || 'No customer'}
                              </p>

                              {/* Time Window */}
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                {session.job_template.time_window_start && (
                                  <span>
                                    {session.job_template.time_window_start.substring(0, 5)}
                                    {session.job_template.time_window_end &&
                                      ` - ${session.job_template.time_window_end.substring(0, 5)}`
                                    }
                                  </span>
                                )}
                                {isMultiDay && (
                                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px]">
                                    {format(parseISO(session.scheduled_date!), 'MMM d')} → {format(parseISO(session.scheduled_end_date!), 'MMM d')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Duration and Pay */}
                          <div className="flex gap-2 mt-3">
                            {session.job_template.duration_minutes && (
                              <div className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-center">
                                <p className="text-[10px] text-gray-500 uppercase">Duration</p>
                                <p className="text-sm font-semibold text-white">
                                  {Math.floor(session.job_template.duration_minutes / 60)}h {session.job_template.duration_minutes % 60}m
                                </p>
                              </div>
                            )}
                            {session.job_template.price_per_hour && (
                              <div className="flex-1 bg-yellow-500/10 rounded-lg px-3 py-2 text-center border border-yellow-500/20">
                                <p className="text-[10px] text-yellow-400 uppercase">Pay Rate</p>
                                <p className="text-sm font-semibold text-white">
                                  ${session.job_template.price_per_hour.toFixed(2)}/hr
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </DashboardDrawer>
            )
          })}
        </div>

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="mt-8 text-center py-12 bg-white/5 rounded-2xl border border-white/10">
            <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No scheduled jobs</h3>
            <p className="text-gray-400 text-sm">Check the marketplace for available jobs.</p>
          </div>
        )}
      </div>

      {/* Export PDF Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className={`${showPreview ? 'max-w-4xl' : 'max-w-md'} max-h-[90vh] overflow-auto bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20`}>
          {!showPreview ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-center text-xl mb-2">
                  Export 7-Day Schedule
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-col items-center gap-6 py-6">
                <p className="text-gray-300 text-sm">Choose your preferred theme:</p>

                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button
                    onClick={() => setPrintTheme('dark')}
                    className={`px-6 py-4 rounded-xl text-sm font-semibold transition-all ${
                      printTheme === 'dark'
                        ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-white border-2 border-blue-500'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10 border-2 border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl">🌙</span>
                      <span>Dark Theme</span>
                    </div>
                    <p className={`text-xs mt-1 ${printTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      Better for screens
                    </p>
                  </button>

                  <button
                    onClick={() => setPrintTheme('light')}
                    className={`px-6 py-4 rounded-xl text-sm font-semibold transition-all ${
                      printTheme === 'light'
                        ? 'bg-gradient-to-r from-gray-100 to-white text-gray-900 border-2 border-blue-500'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10 border-2 border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl">☀️</span>
                      <span>Light Theme</span>
                    </div>
                    <p className={`text-xs mt-1 ${printTheme === 'light' ? 'text-gray-600' : 'text-gray-500'}`}>
                      Saves ink when printing
                    </p>
                  </button>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      setShowPreview(true)
                      setTimeout(() => generateCalendarPDF(), 500)
                    }}
                    className="px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Generate PDF
                  </button>
                  <button
                    onClick={() => setShowExportDialog(false)}
                    className="px-6 py-3 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-center text-xl mb-4">
                  Generating PDF...
                </DialogTitle>
              </DialogHeader>

              {/* PDF Content */}
              <div
                ref={calendarRef}
                data-pdf-export
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  backgroundColor: printTheme === 'dark' ? '#1a1a1a' : '#ffffff',
                  padding: '12mm 15mm',
                }}
              >
                <h2 style={{
                  fontSize: '24px',
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
                  {format(new Date(), 'MMMM d, yyyy')} - {format(addDays(new Date(), 6), 'MMMM d, yyyy')}
                </p>

                {/* 7 Day Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  {Array.from({ length: 7 }).map((_, i) => {
                    const dayDate = addDays(new Date(), i)
                    const dayJobs = getJobsForDay(dayDate)
                    const isToday = i === 0

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
                          minHeight: '120px'
                        }}
                      >
                        <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                          <div style={{
                            fontSize: '10px',
                            fontWeight: '600',
                            color: printTheme === 'dark'
                              ? (isToday ? '#60a5fa' : '#9ca3af')
                              : (isToday ? '#2563eb' : '#6b7280'),
                            textTransform: 'uppercase'
                          }}>
                            {format(dayDate, 'EEE')}
                          </div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: printTheme === 'dark'
                              ? (isToday ? '#93c5fd' : '#ffffff')
                              : (isToday ? '#1d4ed8' : '#111827')
                          }}>
                            {format(dayDate, 'd')}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {dayJobs.length === 0 ? (
                            <div style={{
                              textAlign: 'center',
                              padding: '8px 0',
                              color: printTheme === 'dark' ? '#6b7280' : '#9ca3af',
                              fontSize: '9px',
                              fontStyle: 'italic'
                            }}>
                              No jobs
                            </div>
                          ) : (
                            dayJobs.map(session => (
                              <div
                                key={session.id}
                                style={{
                                  padding: '4px 6px',
                                  backgroundColor: printTheme === 'dark'
                                    ? (session.status === 'IN_PROGRESS' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)')
                                    : (session.status === 'IN_PROGRESS' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)'),
                                  borderRadius: '4px',
                                  border: printTheme === 'dark'
                                    ? '1px solid rgba(255, 255, 255, 0.1)'
                                    : '1px solid rgba(0, 0, 0, 0.1)'
                                }}
                              >
                                <div style={{
                                  fontSize: '9px',
                                  fontWeight: '600',
                                  color: printTheme === 'dark' ? '#ffffff' : '#111827',
                                  lineHeight: '1.2'
                                }}>
                                  {session.job_template.title}
                                </div>
                                <div style={{
                                  fontSize: '8px',
                                  color: printTheme === 'dark' ? '#9ca3af' : '#6b7280'
                                }}>
                                  {session.job_template.customer?.full_name || ''}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Job Details List */}
                {(() => {
                  const next7DaysJobs = getNext7DaysJobs()
                  if (next7DaysJobs.length === 0) return null

                  return (
                    <div style={{
                      paddingTop: '12px',
                      borderTop: printTheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: printTheme === 'dark' ? '#ffffff' : '#111827',
                        marginBottom: '10px',
                        textAlign: 'center'
                      }}>
                        Job Details
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {next7DaysJobs.map(session => {
                          const jobDate = parseISO(session.scheduled_date!)
                          const endDate = session.scheduled_end_date
                            ? parseISO(session.scheduled_end_date)
                            : jobDate

                          return (
                            <div
                              key={session.id}
                              style={{
                                padding: '8px',
                                backgroundColor: printTheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f9fafb',
                                borderRadius: '6px',
                                border: printTheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
                                display: 'grid',
                                gridTemplateColumns: '1.5fr 2fr 1fr',
                                gap: '8px',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <div style={{
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  color: printTheme === 'dark' ? '#ffffff' : '#111827'
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

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                  <div style={{
                                    fontSize: '8px',
                                    color: printTheme === 'dark' ? '#6b7280' : '#9ca3af',
                                    textTransform: 'uppercase',
                                    fontWeight: '600'
                                  }}>
                                    Start
                                  </div>
                                  <div style={{
                                    fontSize: '9px',
                                    color: printTheme === 'dark' ? '#d1d5db' : '#4b5563',
                                    fontWeight: '600'
                                  }}>
                                    {format(jobDate, 'EEE, MMM d')}
                                  </div>
                                  {session.job_template.time_window_start && (
                                    <div style={{
                                      fontSize: '10px',
                                      color: printTheme === 'dark' ? '#ffffff' : '#111827',
                                      fontWeight: 'bold'
                                    }}>
                                      {session.job_template.time_window_start.substring(0, 5)}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div style={{
                                    fontSize: '8px',
                                    color: printTheme === 'dark' ? '#6b7280' : '#9ca3af',
                                    textTransform: 'uppercase',
                                    fontWeight: '600'
                                  }}>
                                    End
                                  </div>
                                  <div style={{
                                    fontSize: '9px',
                                    color: printTheme === 'dark' ? '#d1d5db' : '#4b5563',
                                    fontWeight: '600'
                                  }}>
                                    {format(endDate, 'EEE, MMM d')}
                                  </div>
                                  {session.job_template.time_window_end && (
                                    <div style={{
                                      fontSize: '10px',
                                      color: printTheme === 'dark' ? '#ffffff' : '#111827',
                                      fontWeight: 'bold'
                                    }}>
                                      {session.job_template.time_window_end.substring(0, 5)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <div style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '8px',
                                  fontWeight: '600',
                                  backgroundColor: session.status === 'IN_PROGRESS'
                                    ? 'rgba(34, 197, 94, 0.2)'
                                    : 'rgba(59, 130, 246, 0.2)',
                                  color: session.status === 'IN_PROGRESS'
                                    ? (printTheme === 'dark' ? '#4ade80' : '#16a34a')
                                    : (printTheme === 'dark' ? '#60a5fa' : '#2563eb')
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

              <div className="flex justify-center gap-3 mt-4">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setShowExportDialog(false)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
