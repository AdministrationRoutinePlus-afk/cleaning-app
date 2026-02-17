'use client'

import { useState, useEffect, useRef } from 'react'
import type { JobTemplate, DayOfWeek } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { generateSessionRecords, getNextSessionNumber, createJobSessions, SessionGeneratorInput } from '@/lib/jobs/sessionGenerator'
import { X, Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useDateFormat } from '@/lib/i18n/useDateFormat'

const DAYS_OF_WEEK_KEYS = [
  { value: 'SUN', labelKey: 'Sunday' },
  { value: 'MON', labelKey: 'Monday' },
  { value: 'TUE', labelKey: 'Tuesday' },
  { value: 'WED', labelKey: 'Wednesday' },
  { value: 'THU', labelKey: 'Thursday' },
  { value: 'FRI', labelKey: 'Friday' },
  { value: 'SAT', labelKey: 'Saturday' },
]

interface BulkSchedulerDialogProps {
  job: JobTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}

export function BulkSchedulerDialog({ job, open, onOpenChange, onUpdate }: BulkSchedulerDialogProps) {
  const { t } = useTranslation()
  const { formatDate: formatDateLocale } = useDateFormat()
  const [loading, setLoading] = useState(false)
  const [previewCount, setPreviewCount] = useState(0)

  // Pre-fill from template
  const [isRecurring, setIsRecurring] = useState(job.is_recurring)
  const [windowStartDay, setWindowStartDay] = useState(job.window_start_day || '')
  const [windowEndDay, setWindowEndDay] = useState(job.window_end_day || '')
  const [timeWindowStart, setTimeWindowStart] = useState(job.time_window_start || '')
  const [timeWindowEnd, setTimeWindowEnd] = useState(job.time_window_end || '')
  const [startDate, setStartDate] = useState(job.start_date || '')
  const [endDate, setEndDate] = useState(job.end_date || '')
  const [specificDates, setSpecificDates] = useState<string[]>(job.specific_dates || [])
  const [excludeDates, setExcludeDates] = useState<string[]>(job.exclude_dates || [])
  const [newSpecificDate, setNewSpecificDate] = useState('')
  const [newExcludeDate, setNewExcludeDate] = useState('')

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    if (open) {
      // Reset to template values
      setIsRecurring(job.is_recurring)
      setWindowStartDay(job.window_start_day || '')
      setWindowEndDay(job.window_end_day || '')
      setTimeWindowStart(job.time_window_start || '')
      setTimeWindowEnd(job.time_window_end || '')
      setStartDate(job.start_date || '')
      setEndDate(job.end_date || '')
      setSpecificDates(job.specific_dates || [])
      setExcludeDates(job.exclude_dates || [])
    }
  }, [open])

  // Update preview count when scheduling params change
  useEffect(() => {
    if (!open) return
    const input: SessionGeneratorInput = {
      is_recurring: isRecurring,
      window_start_day: windowStartDay,
      window_end_day: windowEndDay,
      time_window_start: timeWindowStart,
      time_window_end: timeWindowEnd,
      start_date: startDate,
      end_date: endDate,
      specific_dates: specificDates,
      exclude_dates: excludeDates,
    }
    const sessions = generateSessionRecords('preview', 'PREVIEW', input)
    setPreviewCount(sessions.length)
  }, [isRecurring, windowStartDay, windowEndDay, timeWindowStart, timeWindowEnd, startDate, endDate, specificDates, excludeDates, open])

  const handleGenerate = async () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    if (isRecurring && startDate && startDate < today) {
      toast.error(t('Start date cannot be in the past'))
      return
    }
    if (!isRecurring && specificDates.some(d => d < today)) {
      toast.error(t('Specific dates cannot be in the past'))
      return
    }

    setLoading(true)
    try {
      const nextNum = await getNextSessionNumber(supabase, job.id)
      const input: SessionGeneratorInput = {
        is_recurring: isRecurring,
        window_start_day: windowStartDay,
        window_end_day: windowEndDay,
        time_window_start: timeWindowStart,
        time_window_end: timeWindowEnd,
        start_date: startDate,
        end_date: endDate,
        specific_dates: specificDates,
        exclude_dates: excludeDates,
      }

      const count = await createJobSessions(supabase, job.id, job.job_code, input, nextNum, job.preferred_employee_id || undefined)
      if (count >= 0) {
        toast.success(`${t('Created')} ${count} ${count !== 1 ? t('sessions') : t('session')}`)
        onOpenChange(false)
        onUpdate()
      } else {
        toast.error(t('Failed to create sessions'))
      }
    } catch (error) {
      console.error('Error generating sessions:', error)
      toast.error(t('Failed to generate sessions'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white">{t('Bulk Schedule')}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('Generate multiple sessions for')} {job.job_code} — {job.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recurring vs One-time */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsRecurring(false)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !isRecurring ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {t('One-time')}
            </button>
            <button
              type="button"
              onClick={() => setIsRecurring(true)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isRecurring ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {t('Recurring')}
            </button>
          </div>

          {/* Time Window */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
            <Label className="text-xs text-gray-400 font-semibold uppercase">{t('Job Window')}</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">{t('From Day')}</Label>
                <Select value={windowStartDay} onValueChange={setWindowStartDay}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder={t('Select day')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-white/20">
                    {DAYS_OF_WEEK_KEYS.map(day => (
                      <SelectItem key={day.value} value={day.value} className="text-white hover:bg-white/10">{t(day.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">{t('From Time')}</Label>
                <Input
                  type="time"
                  value={timeWindowStart}
                  onChange={(e) => setTimeWindowStart(e.target.value)}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
            </div>
            <div className="flex justify-center">
              <span className="text-gray-500 text-sm">{t('to')}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">{t('To Day')}</Label>
                <Select value={windowEndDay} onValueChange={setWindowEndDay}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder={t('Select day')} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-white/20">
                    {DAYS_OF_WEEK_KEYS.map(day => (
                      <SelectItem key={day.value} value={day.value} className="text-white hover:bg-white/10">{t(day.labelKey)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">{t('To Time')}</Label>
                <Input
                  type="time"
                  value={timeWindowEnd}
                  onChange={(e) => setTimeWindowEnd(e.target.value)}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
            </div>

            {/* Window Preview */}
            {windowStartDay && windowEndDay && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                <p className="text-xs text-blue-300 font-medium">
                  {t(DAYS_OF_WEEK_KEYS.find(d => d.value === windowStartDay)?.labelKey || '')} {timeWindowStart || ''}
                  {' \u2192 '}
                  {t(DAYS_OF_WEEK_KEYS.find(d => d.value === windowEndDay)?.labelKey || '')} {timeWindowEnd || ''}
                </p>
              </div>
            )}
          </div>

          {/* Scheduling */}
          {isRecurring ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{t('Start Date')}</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{t('End Date')}</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || format(new Date(), 'yyyy-MM-dd')}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>

              {/* Skip Dates */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">{t('Skip Dates')}</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newExcludeDate}
                    onChange={(e) => setNewExcludeDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="flex-1 bg-white/5 border-white/20 text-white"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (newExcludeDate && !excludeDates.includes(newExcludeDate)) {
                        setExcludeDates([...excludeDates, newExcludeDate].sort())
                        setNewExcludeDate('')
                      }
                    }}
                    disabled={!newExcludeDate}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {excludeDates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {excludeDates.map(date => (
                      <Badge key={date} variant="outline" className="flex items-center gap-1 bg-red-500/20 text-red-300 border-red-500/30">
                        {formatDateLocale(parseISO(date), 'MMM d')}
                        <button
                          type="button"
                          onClick={() => setExcludeDates(excludeDates.filter(d => d !== date))}
                          className="ml-1 hover:text-red-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-xs text-gray-500">{t('Select Date(s)')}</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newSpecificDate}
                  onChange={(e) => setNewSpecificDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="flex-1 bg-white/5 border-white/20 text-white"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (newSpecificDate && !specificDates.includes(newSpecificDate)) {
                      setSpecificDates([...specificDates, newSpecificDate].sort())
                      setNewSpecificDate('')
                    }
                  }}
                  disabled={!newSpecificDate}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('Add')}
                </Button>
              </div>
              {specificDates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {specificDates.map(date => (
                    <Badge key={date} variant="secondary" className="flex items-center gap-1 py-1 bg-white/10 text-gray-200 border border-white/20">
                      {formatDateLocale(parseISO(date), 'EEE, MMM d')}
                      <button
                        type="button"
                        onClick={() => setSpecificDates(specificDates.filter(d => d !== date))}
                        className="ml-1 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 space-y-3">
            <p className="text-sm text-blue-300 font-medium">
              {previewCount > 0
                ? `${t('This will create')} ${previewCount} ${previewCount !== 1 ? t('sessions') : t('session')} ${t('as')} ${job.preferred_employee_id ? t('APPROVED (pre-assigned)') : t('OFFERED')}`
                : t('Configure scheduling to preview sessions')}
            </p>
            {previewCount > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-medium">{t('Scheduled dates:')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const input: SessionGeneratorInput = {
                      is_recurring: isRecurring,
                      window_start_day: windowStartDay,
                      window_end_day: windowEndDay,
                      time_window_start: timeWindowStart,
                      time_window_end: timeWindowEnd,
                      start_date: startDate,
                      end_date: endDate,
                      specific_dates: specificDates,
                      exclude_dates: excludeDates,
                    }
                    const sessions = generateSessionRecords('preview', 'PREVIEW', input)
                    const displaySessions = sessions.slice(0, 10)
                    const remaining = sessions.length - 10
                    return (
                      <>
                        {displaySessions.map((s, i) => (
                          <span
                            key={i}
                            className="inline-block text-xs px-2 py-1 rounded-md bg-blue-500/20 text-blue-200 border border-blue-500/30"
                          >
                            {formatDateLocale(parseISO(s.scheduled_date), 'EEE, MMM d')}
                          </span>
                        ))}
                        {remaining > 0 && (
                          <span className="inline-block text-xs px-2 py-1 rounded-md bg-white/10 text-gray-400 border border-white/10">
                            + {remaining} {t('more')}
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || previewCount === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? t('Generating...') : `${t('Generate')} ${previewCount} ${previewCount !== 1 ? t('Sessions') : t('Session')}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
