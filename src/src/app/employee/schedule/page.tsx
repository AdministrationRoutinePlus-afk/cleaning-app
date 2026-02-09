'use client'

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { JobSession, JobTemplate, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { cleanupStaleSessions } from '@/lib/jobs/cleanupStaleSessions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { format, addDays, startOfDay, startOfWeek, isWithinInterval, parseISO, isSameDay } from 'date-fns'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate & {
    customer: Customer | null
  }
}

export default function EmployeeSchedulePage() {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<JobSessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [printTheme, setPrintTheme] = useState<'dark' | 'light'>('dark')
  const calendarRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadScheduledJobs()
    return () => { isMountedRef.current = false }
  }, [])

  const loadScheduledJobs = async () => {
    setLoading(true)
    try {
      // Cleanup stale sessions before fetching
      await cleanupStaleSessions(supabase)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get employee record
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employee) return

      // Fetch job sessions that are APPROVED or IN_PROGRESS (include split_with)
      let { data, error } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          )
        `)
        .or(`assigned_to.eq.${employee.id},split_with.eq.${employee.id}`)
        .in('status', ['APPROVED', 'IN_PROGRESS'])
        .not('scheduled_date', 'is', null)
        .order('scheduled_date', { ascending: true })

      // Fallback if split_with column doesn't exist yet
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
          .eq('assigned_to', employee.id)
          .in('status', ['APPROVED', 'IN_PROGRESS'])
          .not('scheduled_date', 'is', null)
          .order('scheduled_date', { ascending: true })

        data = fallback.data
        error = fallback.error
        if (error) throw error
      }

      setSessions((data as JobSessionWithDetails[]) || [])
    } catch (error) {
      console.error('Error loading scheduled jobs:', error)
      toast.error(t('Failed to load your schedule'))
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
      return { label: t('IN PROGRESS'), color: 'bg-green-500', pulse: true }
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
        return { label: t('MISSED'), color: 'bg-red-500', pulse: false }
      }

      if (isWithinWindow && session.status === 'APPROVED') {
        return { label: t('START NOW'), color: 'bg-green-500', pulse: false }
      }
    }

    if (isToday) {
      return { label: t('TODAY'), color: 'bg-blue-500', pulse: false }
    }

    return { label: t('SCHEDULED'), color: 'bg-blue-500/50', pulse: false }
  }

  // Navigation handlers
  const goToThisWeek = () => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const goToPreviousWeek = () => setStartDate(addDays(startDate, -7))
  const goToNextWeek = () => setStartDate(addDays(startDate, 7))

  // Check if viewing current week
  const isCurrentWeek = isSameDay(startDate, startOfWeek(new Date(), { weekStartsOn: 1 }))

  // Format week range for display
  const weekEndDate = addDays(startDate, 6)
  const weekRangeText = `${format(startDate, 'MMM d')} - ${format(weekEndDate, 'MMM d')}`

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
      toast.error('Failed to generate PDF: Calendar element not found')
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
      toast.error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  // Track selected day
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const selectedDay = days[selectedDayIndex]
  const selectedDayJobs = getJobsForDay(selectedDay)

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Week Navigation & Days */}
        <div className="bg-white/10 rounded-2xl border border-white/20 overflow-hidden mb-6">
          {/* Week Header with Navigation - Colorful gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={goToPreviousWeek}
                className="p-2 rounded-xl bg-white/20 border border-white/30 hover:bg-white/30 transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>

              <button
                onClick={goToThisWeek}
                className="flex flex-col items-center"
              >
                <span className="text-xl font-bold text-white">{weekRangeText}</span>
                {isCurrentWeek ? (
                  <span className="text-xs text-blue-200 font-medium">{t('This Week')}</span>
                ) : (
                  <span className="text-xs text-white/70 hover:text-white">{t('Tap for this week')}</span>
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

          {/* Days Grid - 7 columns */}
          <div className="p-4">

          {/* Days Grid - 7 columns */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              const dayJobs = getJobsForDay(day)
              const isToday = isSameDay(day, new Date())
              const hasJobs = dayJobs.length > 0
              const isSelected = selectedDayIndex === index

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDayIndex(index)}
                  className={`flex flex-col items-center justify-center rounded-xl py-2 transition-all ${
                    hasJobs
                      ? isSelected
                        ? 'bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-400'
                        : 'bg-gradient-to-br from-purple-600/30 to-purple-800/30 text-purple-300 border-2 border-purple-500/30 hover:border-purple-400/50'
                      : isSelected
                        ? 'bg-white/20 text-white border-2 border-white/40'
                        : 'bg-white/5 text-gray-500 border-2 border-white/10 hover:border-white/20'
                  } ${isToday ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900' : ''}`}
                >
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
                      {dayJobs.length}
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
          {/* Day Header - Colorful gradient */}
          <div className={`p-4 ${
            selectedDayJobs.length > 0
              ? 'bg-gradient-to-r from-purple-600 to-pink-600'
              : 'bg-gradient-to-r from-gray-600 to-gray-700'
          }`}>
            <h3 className="text-lg font-bold text-white text-center">
              {format(selectedDay, 'EEEE, MMMM d')}
              {isSameDay(selectedDay, new Date()) && (
                <span className="ml-2 text-sm text-white/70 font-normal">({t('Today')})</span>
              )}
            </h3>
            {selectedDayJobs.length > 0 && (
              <p className="text-center text-white/80 text-sm mt-1">
                {selectedDayJobs.length} job{selectedDayJobs.length !== 1 ? 's' : ''} scheduled
              </p>
            )}
          </div>

          <div className="p-4">
            {selectedDayJobs.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">{t('No jobs scheduled')}</p>
              </div>
            ) : (
            <div className="space-y-3">
              {selectedDayJobs.map(session => {
                const status = getJobStatus(session, selectedDay)
                const hasImage = session.job_template.image_url
                const isMultiDay = session.scheduled_date && session.scheduled_end_date &&
                  !isSameDay(parseISO(session.scheduled_date), parseISO(session.scheduled_end_date))

                return (
                  <div
                    key={`${session.id}-${selectedDay.toISOString()}`}
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
                          {session.job_template.customer?.full_name || t('No customer')}
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
                          <p className="text-[10px] text-gray-500 uppercase">{t('Duration')}</p>
                          <p className="text-sm font-semibold text-white">
                            {Math.floor(session.job_template.duration_minutes / 60)}h {session.job_template.duration_minutes % 60}m
                          </p>
                        </div>
                      )}
                      {session.job_template.price_per_hour && (
                        <div className="flex-1 bg-yellow-500/10 rounded-lg px-3 py-2 text-center border border-yellow-500/20">
                          <p className="text-[10px] text-yellow-400 uppercase">{t('Pay Rate')}</p>
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
          </div>
        </div>

        {/* Export PDF Button - Square like other tabs */}
        <div className="flex justify-center">
          <button
            onClick={openExportDialog}
            className="aspect-square w-32 flex flex-col items-center justify-center gap-2 rounded-2xl font-bold text-sm transition-all bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400 hover:from-blue-500 hover:to-blue-700"
          >
            <Download className="w-8 h-8" />
            <span>{t('Export PDF')}</span>
          </button>
        </div>

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="mt-8 text-center py-12 bg-white/5 rounded-2xl border border-white/10">
            <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">{t('No scheduled jobs')}</h3>
            <p className="text-gray-400 text-sm">{t('Check the marketplace for available jobs.')}</p>
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
                  {t('Export 7-Day Schedule')}
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-col items-center gap-6 py-6">
                <p className="text-gray-300 text-sm">{t('Choose your preferred theme:')}</p>

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
                      <span>{t('Dark Theme')}</span>
                    </div>
                    <p className={`text-xs mt-1 ${printTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('Better for screens')}
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
                      <span>{t('Light Theme')}</span>
                    </div>
                    <p className={`text-xs mt-1 ${printTheme === 'light' ? 'text-gray-600' : 'text-gray-500'}`}>
                      {t('Saves ink when printing')}
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
                    {t('Generate PDF')}
                  </button>
                  <button
                    onClick={() => setShowExportDialog(false)}
                    className="px-6 py-3 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                  >
                    {t('Cancel')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-center text-xl mb-4">
                  {t('Generating PDF...')}
                </DialogTitle>
              </DialogHeader>

              {/* PDF Content - Gantt Chart Style */}
              <div
                ref={calendarRef}
                data-pdf-export
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  backgroundColor: printTheme === 'dark' ? '#1a1a1a' : '#ffffff',
                  padding: '10mm 8mm',
                }}
              >
                <h2 style={{
                  fontSize: '22px',
                  fontWeight: 'bold',
                  color: printTheme === 'dark' ? '#ffffff' : '#111827',
                  marginBottom: '4px',
                  textAlign: 'center'
                }}>
                  {t('Weekly Schedule')}
                </h2>
                <p style={{
                  color: printTheme === 'dark' ? '#9ca3af' : '#6b7280',
                  textAlign: 'center',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  {format(startDate, 'MMMM d')} - {format(weekEndDate, 'MMMM d, yyyy')}
                </p>

                {/* Gantt Chart */}
                {(() => {
                  const jobsWithDates = getNext7DaysJobs()
                  const colors = [
                    { bg: 'rgba(147, 51, 234, 0.3)', border: 'rgb(147, 51, 234)', text: printTheme === 'dark' ? '#c4b5fd' : '#7c3aed' },
                    { bg: 'rgba(59, 130, 246, 0.3)', border: 'rgb(59, 130, 246)', text: printTheme === 'dark' ? '#93c5fd' : '#2563eb' },
                    { bg: 'rgba(16, 185, 129, 0.3)', border: 'rgb(16, 185, 129)', text: printTheme === 'dark' ? '#6ee7b7' : '#059669' },
                    { bg: 'rgba(245, 158, 11, 0.3)', border: 'rgb(245, 158, 11)', text: printTheme === 'dark' ? '#fcd34d' : '#d97706' },
                    { bg: 'rgba(239, 68, 68, 0.3)', border: 'rgb(239, 68, 68)', text: printTheme === 'dark' ? '#fca5a5' : '#dc2626' },
                    { bg: 'rgba(236, 72, 153, 0.3)', border: 'rgb(236, 72, 153)', text: printTheme === 'dark' ? '#f9a8d4' : '#db2777' },
                  ]

                  return (
                    <div style={{
                      border: printTheme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      {/* Header Row - Days of week */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '100px repeat(7, 1fr)',
                        backgroundColor: printTheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f3f4f6',
                        borderBottom: printTheme === 'dark' ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          padding: '8px',
                          fontWeight: 'bold',
                          fontSize: '10px',
                          color: printTheme === 'dark' ? '#9ca3af' : '#6b7280',
                          borderRight: printTheme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb'
                        }}>
                          {t('JOB')}
                        </div>
                        {days.map((day, i) => {
                          const isWeekend = [0, 6].includes(day.getDay())
                          const isToday = isSameDay(day, new Date())
                          return (
                            <div
                              key={i}
                              style={{
                                padding: '6px 4px',
                                textAlign: 'center',
                                borderRight: i < 6 ? (printTheme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb') : 'none',
                                backgroundColor: isToday
                                  ? (printTheme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)')
                                  : isWeekend
                                    ? (printTheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f9fafb')
                                    : 'transparent'
                              }}
                            >
                              <div style={{
                                fontSize: '9px',
                                fontWeight: '600',
                                color: isToday
                                  ? (printTheme === 'dark' ? '#60a5fa' : '#2563eb')
                                  : isWeekend
                                    ? (printTheme === 'dark' ? '#f87171' : '#dc2626')
                                    : (printTheme === 'dark' ? '#9ca3af' : '#6b7280'),
                                textTransform: 'uppercase'
                              }}>
                                {format(day, 'EEE')}
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: isToday
                                  ? (printTheme === 'dark' ? '#93c5fd' : '#1d4ed8')
                                  : (printTheme === 'dark' ? '#ffffff' : '#111827')
                              }}>
                                {format(day, 'd')}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Job Rows - Gantt bars */}
                      {jobsWithDates.length === 0 ? (
                        <div style={{
                          padding: '30px',
                          textAlign: 'center',
                          color: printTheme === 'dark' ? '#6b7280' : '#9ca3af',
                          fontSize: '12px'
                        }}>
                          {t('No jobs scheduled for this week')}
                        </div>
                      ) : (
                        jobsWithDates.map((session, jobIndex) => {
                          const jobStart = parseISO(session.scheduled_date!)
                          const jobEnd = session.scheduled_end_date
                            ? parseISO(session.scheduled_end_date)
                            : jobStart
                          const color = colors[jobIndex % colors.length]

                          return (
                            <div
                              key={session.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '100px repeat(7, 1fr)',
                                borderBottom: jobIndex < jobsWithDates.length - 1
                                  ? (printTheme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb')
                                  : 'none',
                                minHeight: '50px'
                              }}
                            >
                              {/* Job Info Column */}
                              <div style={{
                                padding: '6px 8px',
                                borderRight: printTheme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center'
                              }}>
                                <div style={{
                                  fontSize: '9px',
                                  fontWeight: 'bold',
                                  color: printTheme === 'dark' ? '#ffffff' : '#111827',
                                  lineHeight: '1.2',
                                  marginBottom: '2px'
                                }}>
                                  {session.job_template.title}
                                </div>
                                <div style={{
                                  fontSize: '8px',
                                  color: printTheme === 'dark' ? '#9ca3af' : '#6b7280'
                                }}>
                                  {session.job_template.customer?.full_name || ''}
                                </div>
                                {session.job_template.time_window_start && (
                                  <div style={{
                                    fontSize: '8px',
                                    color: color.text,
                                    fontWeight: '600',
                                    marginTop: '2px'
                                  }}>
                                    {session.job_template.time_window_start.substring(0, 5)}
                                    {session.job_template.time_window_end && ` - ${session.job_template.time_window_end.substring(0, 5)}`}
                                  </div>
                                )}
                              </div>

                              {/* Day Cells with Gantt Bar */}
                              {days.map((day, dayIndex) => {
                                const dayStart = startOfDay(day)
                                const isInRange = isWithinInterval(dayStart, {
                                  start: startOfDay(jobStart),
                                  end: startOfDay(jobEnd)
                                })
                                const isFirstDay = isSameDay(day, jobStart)
                                const isLastDay = isSameDay(day, jobEnd)
                                const isWeekend = [0, 6].includes(day.getDay())

                                return (
                                  <div
                                    key={dayIndex}
                                    style={{
                                      padding: '4px 2px',
                                      borderRight: dayIndex < 6 ? (printTheme === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f3f4f6') : 'none',
                                      display: 'flex',
                                      alignItems: 'center',
                                      backgroundColor: isWeekend
                                        ? (printTheme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fafafa')
                                        : 'transparent'
                                    }}
                                  >
                                    {isInRange && (
                                      <div style={{
                                        width: '100%',
                                        height: '32px',
                                        backgroundColor: color.bg,
                                        borderTop: `2px solid ${color.border}`,
                                        borderBottom: `2px solid ${color.border}`,
                                        borderLeft: isFirstDay ? `2px solid ${color.border}` : 'none',
                                        borderRight: isLastDay ? `2px solid ${color.border}` : 'none',
                                        borderRadius: isFirstDay && isLastDay ? '4px' : isFirstDay ? '4px 0 0 4px' : isLastDay ? '0 4px 4px 0' : '0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginLeft: isFirstDay ? '0' : '-2px',
                                        marginRight: isLastDay ? '0' : '-2px',
                                        paddingLeft: isFirstDay ? '0' : '2px',
                                        paddingRight: isLastDay ? '0' : '2px'
                                      }}>
                                        {isFirstDay && (
                                          <span style={{
                                            fontSize: '7px',
                                            fontWeight: 'bold',
                                            color: color.text,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            padding: '0 2px'
                                          }}>
                                            {session.job_template.duration_minutes
                                              ? `${Math.floor(session.job_template.duration_minutes / 60)}h${session.job_template.duration_minutes % 60 > 0 ? session.job_template.duration_minutes % 60 + 'm' : ''}`
                                              : ''}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )
                })()}

                {/* Legend */}
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: printTheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f9fafb',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: printTheme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
                      border: '2px solid rgb(59, 130, 246)',
                      borderRadius: '2px'
                    }}></div>
                    <span style={{ fontSize: '9px', color: printTheme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                      {t('Job spans these days')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: printTheme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                      borderRadius: '2px'
                    }}></div>
                    <span style={{ fontSize: '9px', color: printTheme === 'dark' ? '#f87171' : '#dc2626' }}>
                      {t('Weekend')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: printTheme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                      border: '2px solid rgb(59, 130, 246)',
                      borderRadius: '2px'
                    }}></div>
                    <span style={{ fontSize: '9px', color: printTheme === 'dark' ? '#60a5fa' : '#2563eb' }}>
                      {t('Today')}
                    </span>
                  </div>
                </div>
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
                  {t('Close')}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
