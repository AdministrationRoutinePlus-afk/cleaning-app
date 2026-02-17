'use client'

import { useEffect, useState, useRef } from 'react'
import type { EmployeeSpecificAvailability, EmployeeWeeklyAvailability, AvailabilityMode } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar, Lock, Unlock, AlertCircle, X, Clock, Copy, CalendarDays, Repeat, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useDateFormat } from '@/lib/i18n/useDateFormat'
import { format, addDays, startOfDay, nextMonday, getDay, addWeeks } from 'date-fns'

interface SpecificAvailabilityEditorProps {
  employeeId: string
}

interface DayAvailability {
  date: Date
  dateStr: string
  isAvailable: boolean
  isLocked: boolean
  startTime: string | null
  endTime: string | null
  record: EmployeeSpecificAvailability | null
}

interface WeeklyDayAvailability {
  dayOfWeek: number
  dayName: string
  isAvailable: boolean
  startTime: string | null
  endTime: string | null
  record: EmployeeWeeklyAvailability | null
}

const DAYS_OF_WEEK = [
  { dayOfWeek: 1, dayName: 'Monday' },
  { dayOfWeek: 2, dayName: 'Tuesday' },
  { dayOfWeek: 3, dayName: 'Wednesday' },
  { dayOfWeek: 4, dayName: 'Thursday' },
  { dayOfWeek: 5, dayName: 'Friday' },
  { dayOfWeek: 6, dayName: 'Saturday' },
  { dayOfWeek: 0, dayName: 'Sunday' },
]

export function SpecificAvailabilityEditor({ employeeId }: SpecificAvailabilityEditorProps) {
  const { t } = useTranslation()
  const { formatDate } = useDateFormat()
  const [mode, setMode] = useState<AvailabilityMode | null>(null)
  const [days, setDays] = useState<DayAvailability[]>([])
  const [weeklyDays, setWeeklyDays] = useState<WeeklyDayAvailability[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showReminder, setShowReminder] = useState(false)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null)
  const [selectedWeeklyDayIndex, setSelectedWeeklyDayIndex] = useState<number | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editIsAvailable, setEditIsAvailable] = useState(true)
  const [copyToNextSchedule, setCopyToNextSchedule] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('copyAvailabilityToNext') === 'true'
    }
    return false
  })
  const daysScrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const scrollDays = (direction: 'left' | 'right') => {
    if (daysScrollRef.current) {
      const scrollAmount = 200
      daysScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  // Load saved availability_mode on mount
  useEffect(() => {
    const loadMode = async () => {
      const { data } = await supabase
        .from('employees')
        .select('availability_mode')
        .eq('id', employeeId)
        .single()
      if (data?.availability_mode) {
        setMode(data.availability_mode as AvailabilityMode)
      }
    }
    loadMode()
  }, [employeeId])

  useEffect(() => {
    if (mode === 'custom') {
      initializeDays()
    } else if (mode === 'fixed') {
      initializeWeeklyDays()
    }
  }, [employeeId, mode])

  const selectMode = async (newMode: AvailabilityMode) => {
    setMode(newMode)
    try {
      await supabase
        .from('employees')
        .update({ availability_mode: newMode })
        .eq('id', employeeId)
    } catch (error) {
      console.error('Error saving mode:', error)
    }
  }

  // Scroll to content after loading completes
  useEffect(() => {
    if (!loading && mode !== null) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [loading, mode])

  const getStartMonday = () => {
    const today = startOfDay(new Date())
    const dayOfWeek = getDay(today)
    let startMonday = nextMonday(today)
    if (dayOfWeek === 0 || dayOfWeek >= 3) {
      startMonday = addWeeks(startMonday, 1)
    }
    return startMonday
  }

  const initializeDays = async () => {
    setLoading(true)
    try {
      const startMonday = getStartMonday()
      const next14Days: DayAvailability[] = []

      for (let i = 0; i < 14; i++) {
        const date = addDays(startMonday, i)
        const dateStr = format(date, 'yyyy-MM-dd')
        next14Days.push({
          date,
          dateStr,
          isAvailable: false,
          isLocked: false,
          startTime: null,
          endTime: null,
          record: null
        })
      }

      const { data, error } = await supabase
        .from('employee_specific_availability')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', format(startMonday, 'yyyy-MM-dd'))
        .lte('date', format(addDays(startMonday, 13), 'yyyy-MM-dd'))

      if (error) throw error

      const records = data as EmployeeSpecificAvailability[]
      const updatedDays = next14Days.map(day => {
        const record = records.find(r => r.date === day.dateStr)
        if (record) {
          return {
            ...day,
            isAvailable: record.is_available,
            isLocked: record.is_locked,
            startTime: record.start_time,
            endTime: record.end_time,
            record
          }
        }
        return day
      })

      setDays(updatedDays)
      checkReminder(updatedDays)
    } catch (error) {
      console.error('Error loading availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const initializeWeeklyDays = async () => {
    setLoading(true)
    try {
      const weeklyTemplate: WeeklyDayAvailability[] = DAYS_OF_WEEK.map(d => ({
        dayOfWeek: d.dayOfWeek,
        dayName: d.dayName,
        isAvailable: false,
        startTime: null,
        endTime: null,
        record: null
      }))

      const { data, error } = await supabase
        .from('employee_weekly_availability')
        .select('*')
        .eq('employee_id', employeeId)

      if (error) throw error

      const records = data as EmployeeWeeklyAvailability[]
      const updatedWeekly = weeklyTemplate.map(day => {
        const record = records.find(r => r.day_of_week === day.dayOfWeek)
        if (record) {
          return {
            ...day,
            isAvailable: record.is_available,
            startTime: record.start_time,
            endTime: record.end_time,
            record
          }
        }
        return day
      })

      setWeeklyDays(updatedWeekly)
    } catch (error) {
      console.error('Error loading weekly availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkReminder = (daysData: DayAvailability[]) => {
    const week2Days = daysData.slice(7)
    const week2NotSet = week2Days.every(day => !day.record)
    const week1Days = daysData.slice(0, 7)
    const week1NotSet = week1Days.some(day => !day.record)

    if (week1NotSet || week2NotSet) {
      setShowReminder(true)
    } else {
      setShowReminder(false)
    }
  }

  // Custom schedule functions
  const openDayEditor = (index: number) => {
    const day = days[index]
    if (day.isLocked) return

    setSelectedDayIndex(index)
    setEditIsAvailable(day.isAvailable)
    setEditStartTime(day.startTime ? day.startTime.slice(0, 5) : '')
    setEditEndTime(day.endTime ? day.endTime.slice(0, 5) : '')
  }

  const closeDayEditor = () => {
    setSelectedDayIndex(null)
    setEditStartTime('')
    setEditEndTime('')
  }

  const saveDayAvailability = async () => {
    if (selectedDayIndex === null) return

    const day = days[selectedDayIndex]
    if (day.isLocked) return

    setSaving(true)
    try {
      const updateData = {
        is_available: editIsAvailable,
        start_time: editStartTime || null,
        end_time: editEndTime || null,
        updated_at: new Date().toISOString()
      }

      if (day.record) {
        const { error } = await supabase
          .from('employee_specific_availability')
          .update(updateData)
          .eq('id', day.record.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('employee_specific_availability')
          .insert({
            employee_id: employeeId,
            date: day.dateStr,
            ...updateData
          })
          .select()
          .single()

        if (error) throw error
        day.record = data
      }

      setDays(prev => prev.map((d, i) =>
        i === selectedDayIndex ? {
          ...d,
          isAvailable: editIsAvailable,
          startTime: editStartTime || null,
          endTime: editEndTime || null,
          record: day.record
        } : d
      ))

      closeDayEditor()
    } catch (error) {
      console.error('Error saving availability:', error)
      toast.error(t('Failed to save availability'))
    } finally {
      setSaving(false)
    }
  }

  // Weekly schedule functions
  const openWeeklyDayEditor = (index: number) => {
    const day = weeklyDays[index]
    setSelectedWeeklyDayIndex(index)
    setEditIsAvailable(day.isAvailable)
    setEditStartTime(day.startTime ? day.startTime.slice(0, 5) : '')
    setEditEndTime(day.endTime ? day.endTime.slice(0, 5) : '')
  }

  const closeWeeklyDayEditor = () => {
    setSelectedWeeklyDayIndex(null)
    setEditStartTime('')
    setEditEndTime('')
  }

  const saveWeeklyDayAvailability = async () => {
    if (selectedWeeklyDayIndex === null) return

    const day = weeklyDays[selectedWeeklyDayIndex]

    setSaving(true)
    try {
      const updateData = {
        is_available: editIsAvailable,
        start_time: editStartTime || null,
        end_time: editEndTime || null,
        updated_at: new Date().toISOString()
      }

      if (day.record) {
        const { error } = await supabase
          .from('employee_weekly_availability')
          .update(updateData)
          .eq('id', day.record.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('employee_weekly_availability')
          .insert({
            employee_id: employeeId,
            day_of_week: day.dayOfWeek,
            ...updateData
          })
          .select()
          .single()

        if (error) throw error
        day.record = data
      }

      setWeeklyDays(prev => prev.map((d, i) =>
        i === selectedWeeklyDayIndex ? {
          ...d,
          isAvailable: editIsAvailable,
          startTime: editStartTime || null,
          endTime: editEndTime || null,
          record: day.record
        } : d
      ))

      closeWeeklyDayEditor()
    } catch (error) {
      console.error('Error saving weekly availability:', error)
      toast.error(t('Failed to save availability'))
    } finally {
      setSaving(false)
    }
  }

  const lockAllDays = async () => {
    setSaving(true)
    try {
      const now = new Date().toISOString()

      const existingRecordIds = days.filter(d => d.record).map(d => d.record!.id)
      if (existingRecordIds.length > 0) {
        const { error } = await supabase
          .from('employee_specific_availability')
          .update({
            is_locked: true,
            locked_at: now,
            updated_at: now
          })
          .in('id', existingRecordIds)

        if (error) throw error
      }

      const daysWithoutRecords = days.filter(d => !d.record)
      if (daysWithoutRecords.length > 0) {
        const newRecords = daysWithoutRecords.map(d => ({
          employee_id: employeeId,
          date: d.dateStr,
          is_available: d.isAvailable,
          start_time: d.startTime,
          end_time: d.endTime,
          is_locked: true,
          locked_at: now
        }))

        const { error } = await supabase
          .from('employee_specific_availability')
          .insert(newRecords)

        if (error) throw error
      }

      if (copyToNextSchedule) {
        await copyToNextPeriod()
      }

      await initializeDays()
      setShowReminder(false)
    } catch (error) {
      console.error('Error locking availability:', error)
      toast.error(t('Failed to lock availability'))
    } finally {
      setSaving(false)
    }
  }

  const unlockAllDays = async () => {
    setSaving(true)
    try {
      const existingRecordIds = days.filter(d => d.record && d.isLocked).map(d => d.record!.id)
      if (existingRecordIds.length > 0) {
        const { error } = await supabase
          .from('employee_specific_availability')
          .update({
            is_locked: false,
            locked_at: null,
            updated_at: new Date().toISOString()
          })
          .in('id', existingRecordIds)

        if (error) throw error
      }

      await initializeDays()
    } catch (error) {
      console.error('Error unlocking availability:', error)
      toast.error(t('Failed to unlock availability'))
    } finally {
      setSaving(false)
    }
  }

  const handleCopyToNextChange = (checked: boolean) => {
    setCopyToNextSchedule(checked)
    if (typeof window !== 'undefined') {
      localStorage.setItem('copyAvailabilityToNext', String(checked))
    }
  }

  const copyToNextPeriod = async () => {
    if (!copyToNextSchedule || days.length === 0) return

    try {
      const nextPeriodStart = addWeeks(days[0].date, 2)

      const nextPeriodRecords = days.map((day, index) => {
        const nextDate = addDays(nextPeriodStart, index)
        return {
          employee_id: employeeId,
          date: format(nextDate, 'yyyy-MM-dd'),
          is_available: day.isAvailable,
          start_time: day.startTime,
          end_time: day.endTime,
          is_locked: false
        }
      })

      for (const record of nextPeriodRecords) {
        const { error } = await supabase
          .from('employee_specific_availability')
          .upsert(record, { onConflict: 'employee_id,date' })

        if (error) {
          console.error('Error copying to next period:', error)
        }
      }
    } catch (error) {
      console.error('Error copying schedule to next period:', error)
    }
  }

  const isAllLocked = days.every(d => d.isLocked || d.record?.is_locked)
  const selectedDay = selectedDayIndex !== null ? days[selectedDayIndex] : null
  const selectedWeeklyDay = selectedWeeklyDayIndex !== null ? weeklyDays[selectedWeeklyDayIndex] : null

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="w-12 h-16 bg-white/10 rounded-lg shrink-0"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Mode Selector - Square Buttons */}
        <div className={`flex justify-center ${mode === null ? 'min-h-[200px] items-center' : ''}`}>
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
            <button
              onClick={() => selectMode('fixed')}
              className={`aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl font-bold text-base transition-all ${
                mode === 'fixed'
                  ? 'bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/30 border-2 border-purple-400'
                  : 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <Repeat className={`w-10 h-10 ${mode === 'fixed' ? 'text-white' : 'text-gray-400'}`} />
              <span className="text-center px-2">{t('Fixed Weekly')}</span>
            </button>
            <button
              onClick={() => selectMode('custom')}
              className={`aspect-square flex flex-col items-center justify-center gap-3 rounded-2xl font-bold text-base transition-all ${
                mode === 'custom'
                  ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400'
                  : 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <CalendarDays className={`w-10 h-10 ${mode === 'custom' ? 'text-white' : 'text-gray-400'}`} />
              <span className="text-center px-2">{t('Custom Dates')}</span>
            </button>
          </div>
        </div>

        {mode === 'custom' && (
          /* Custom Schedule (2-week view) */
          <div ref={contentRef} className="space-y-3 scroll-mt-4">
            {/* Lock/Unlock Button */}
            <div className="flex justify-end">
              <Button
                onClick={isAllLocked ? unlockAllDays : lockAllDays}
                disabled={saving}
                size="sm"
                className={`${
                  isAllLocked
                    ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                }`}
              >
                {isAllLocked ? (
                  <>
                    <Unlock className="w-4 h-4 mr-1" />
                    {t('Unlock')}
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-1" />
                    {t('Lock All')}
                  </>
                )}
              </Button>
            </div>

            {/* Date Range Indicator */}
            {days.length > 0 && (
              <div className="text-center text-xl font-bold text-white">
                {formatDate(days[0].date, 'MMM d')} - {formatDate(days[days.length - 1].date, 'MMM d, yyyy')}
              </div>
            )}

            {showReminder && !isAllLocked && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <p className="text-sm text-amber-300">
                  {t('Set your availability and lock when ready!')}
                </p>
              </div>
            )}

            {/* Days Grid with Navigation */}
            <div className="relative">
              {/* Left Arrow */}
              <button
                onClick={() => scrollDays('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-gray-800/90 rounded-full border border-white/20 hover:bg-gray-700 transition-colors hidden md:flex"
                style={{ marginLeft: '-8px' }}
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>

              {/* Scrollable Days */}
              <div
                ref={daysScrollRef}
                className="flex gap-2 overflow-x-auto pb-3 px-1 md:px-6"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(255,255,255,0.3) transparent'
                }}
              >
                {days.map((day, index) => {
                const isToday = format(day.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                const dayName = formatDate(day.date, 'EEE')
                const dayNum = format(day.date, 'd')
                const hasTime = day.startTime || day.endTime
                const isConfigured = day.record !== null

                const getButtonStyle = () => {
                  if (!isConfigured) {
                    return 'bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30'
                  }
                  if (day.isAvailable) {
                    return day.isLocked
                      ? 'bg-green-500/30 border border-green-500/50'
                      : 'bg-green-500/20 border border-green-500/40 hover:bg-green-500/30'
                  }
                  return day.isLocked
                    ? 'bg-red-500/30 border border-red-500/50'
                    : 'bg-red-500/20 border border-red-500/40 hover:bg-red-500/30'
                }

                const getTextColor = () => {
                  if (!isConfigured) return 'text-blue-300'
                  return day.isAvailable ? 'text-green-300' : 'text-red-300'
                }

                const getNumColor = () => {
                  if (!isConfigured) return 'text-blue-200'
                  return day.isAvailable ? 'text-green-200' : 'text-red-200'
                }

                return (
                  <button
                    key={day.dateStr}
                    onClick={() => openDayEditor(index)}
                    disabled={day.isLocked || saving}
                    className={`
                      flex flex-col items-center justify-center
                      w-14 h-20 rounded-lg shrink-0
                      transition-all duration-200
                      ${day.isLocked ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                      ${isToday ? 'ring-2 ring-white' : ''}
                      ${getButtonStyle()}
                    `}
                  >
                    <span className={`text-[10px] font-medium ${getTextColor()}`}>
                      {dayName}
                    </span>
                    <span className={`text-lg font-bold ${getNumColor()}`}>
                      {dayNum}
                    </span>
                    {hasTime && day.isAvailable && isConfigured ? (
                      <span className="text-[8px] text-green-400 mt-0.5">
                        {day.startTime?.slice(0, 5) || '—'}
                      </span>
                    ) : day.isLocked ? (
                      <Lock className="w-3 h-3 text-gray-400 mt-0.5" />
                    ) : null}
                  </button>
                )
              })}
              </div>

              {/* Right Arrow */}
              <button
                onClick={() => scrollDays('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-gray-800/90 rounded-full border border-white/20 hover:bg-gray-700 transition-colors hidden md:flex"
                style={{ marginRight: '-8px' }}
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 text-xs text-gray-400 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500/40"></div>
                <span>{t('Not set')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500/40"></div>
                <span>{t('Available')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500/40"></div>
                <span>{t('Unavailable')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>{t('Locked')}</span>
              </div>
            </div>

            {/* Default Schedule Option */}
            <div
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                copyToNextSchedule
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
              onClick={() => handleCopyToNextChange(!copyToNextSchedule)}
            >
              <Checkbox
                id="copyToNext"
                checked={copyToNextSchedule}
                onCheckedChange={handleCopyToNextChange}
                className="border-white/30 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 mt-0.5"
              />
              <label htmlFor="copyToNext" className="text-sm text-gray-300 cursor-pointer leading-relaxed">
                {t('Copy this schedule to the following 2 weeks when locked')}
              </label>
            </div>
          </div>
        )}

        {mode === 'fixed' && (
          /* Fixed Weekly Schedule (Mon-Sun) */
          <div ref={contentRef} className="space-y-3 scroll-mt-4">
            <p className="text-sm text-gray-400 text-center">
              {t('Set your recurring weekly availability')}
            </p>

            {/* Weekly Days Grid */}
            <div className="space-y-2">
              {weeklyDays.map((day, index) => {
                const isConfigured = day.record !== null
                const hasTime = day.startTime || day.endTime

                return (
                  <button
                    key={day.dayOfWeek}
                    onClick={() => openWeeklyDayEditor(index)}
                    disabled={saving}
                    className={`
                      w-full flex items-center justify-between p-4 rounded-xl
                      transition-all duration-200 cursor-pointer active:scale-[0.98]
                      ${!isConfigured
                        ? 'bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30'
                        : day.isAvailable
                          ? 'bg-green-500/20 border border-green-500/40 hover:bg-green-500/30'
                          : 'bg-red-500/20 border border-red-500/40 hover:bg-red-500/30'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${
                        !isConfigured ? 'text-blue-200' : day.isAvailable ? 'text-green-200' : 'text-red-200'
                      }`}>
                        {t(day.dayName)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasTime && day.isAvailable && isConfigured ? (
                        <span className="text-sm text-green-400">
                          {day.startTime?.slice(0, 5)} - {day.endTime?.slice(0, 5)}
                        </span>
                      ) : isConfigured ? (
                        <span className={`text-sm ${day.isAvailable ? 'text-green-400' : 'text-red-400'}`}>
                          {day.isAvailable ? t('Available') : t('Unavailable')}
                        </span>
                      ) : (
                        <span className="text-sm text-blue-400">{t('Not set')}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 text-xs text-gray-400 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500/40"></div>
                <span>{t('Not set')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500/40"></div>
                <span>{t('Available')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500/40"></div>
                <span>{t('Unavailable')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Day Editor Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl w-full max-w-sm border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">
                {formatDate(selectedDay.date, 'EEEE, MMM d')}
              </h3>
              <button
                onClick={closeDayEditor}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Availability Toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-white">{t('Available')}</Label>
                <button
                  onClick={() => setEditIsAvailable(!editIsAvailable)}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    editIsAvailable ? 'bg-green-500' : 'bg-red-500'
                  }`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full shadow transform transition-transform ${
                    editIsAvailable ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Time Window */}
              {editIsAvailable && (
                <TimeWindowEditor
                  startTime={editStartTime}
                  endTime={editEndTime}
                  onStartTimeChange={setEditStartTime}
                  onEndTimeChange={setEditEndTime}
                />
              )}
            </div>

            <div className="flex gap-3 p-4 border-t border-white/10">
              <Button
                onClick={closeDayEditor}
                className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/20"
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={saveDayAvailability}
                disabled={saving}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                {saving ? t('Saving...') : t('Save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Day Editor Modal */}
      {selectedWeeklyDay && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl w-full max-w-sm border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">
                {t(selectedWeeklyDay.dayName)}
              </h3>
              <button
                onClick={closeWeeklyDayEditor}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Availability Toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-white">{t('Available')}</Label>
                <button
                  onClick={() => setEditIsAvailable(!editIsAvailable)}
                  className={`w-14 h-8 rounded-full transition-colors ${
                    editIsAvailable ? 'bg-green-500' : 'bg-red-500'
                  }`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full shadow transform transition-transform ${
                    editIsAvailable ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Time Window */}
              {editIsAvailable && (
                <TimeWindowEditor
                  startTime={editStartTime}
                  endTime={editEndTime}
                  onStartTimeChange={setEditStartTime}
                  onEndTimeChange={setEditEndTime}
                />
              )}
            </div>

            <div className="flex gap-3 p-4 border-t border-white/10">
              <Button
                onClick={closeWeeklyDayEditor}
                className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/20"
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={saveWeeklyDayAvailability}
                disabled={saving}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                {saving ? t('Saving...') : t('Save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Time Window Editor Component
function TimeWindowEditor({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange
}: {
  startTime: string
  endTime: string
  onStartTimeChange: (time: string) => void
  onEndTimeChange: (time: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3 pt-2 border-t border-white/10">
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Clock className="w-4 h-4" />
        <span>{t('Time Window (optional)')}</span>
      </div>

      {/* Start Time */}
      <div>
        <Label className="text-xs text-gray-400 mb-2 block">{t('Start Time')}</Label>
        <div className="flex gap-2">
          <select
            value={startTime ? startTime.split(':')[0] : ''}
            onChange={(e) => {
              const hour = e.target.value
              if (hour) {
                const mins = startTime ? startTime.split(':')[1] : '00'
                onStartTimeChange(`${hour}:${mins}`)
              } else {
                onStartTimeChange('')
              }
            }}
            className="flex-1 bg-white/10 border border-white/20 text-white rounded-lg px-3 py-3 text-base"
          >
            <option value="" className="bg-gray-800">{t('Hour')}</option>
            {Array.from({ length: 17 }, (_, i) => i + 6).map(hour => (
              <option key={hour} value={hour.toString().padStart(2, '0')} className="bg-gray-800">
                {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
              </option>
            ))}
          </select>
          <select
            value={startTime ? startTime.split(':')[1] : ''}
            onChange={(e) => {
              const mins = e.target.value
              const hour = startTime ? startTime.split(':')[0] : '09'
              onStartTimeChange(`${hour}:${mins}`)
            }}
            disabled={!startTime}
            className="w-24 bg-white/10 border border-white/20 text-white rounded-lg px-3 py-3 text-base disabled:opacity-50"
          >
            <option value="00" className="bg-gray-800">:00</option>
            <option value="15" className="bg-gray-800">:15</option>
            <option value="30" className="bg-gray-800">:30</option>
            <option value="45" className="bg-gray-800">:45</option>
          </select>
        </div>
      </div>

      {/* End Time */}
      <div>
        <Label className="text-xs text-gray-400 mb-2 block">{t('End Time')}</Label>
        <div className="flex gap-2">
          <select
            value={endTime ? endTime.split(':')[0] : ''}
            onChange={(e) => {
              const hour = e.target.value
              if (hour) {
                const mins = endTime ? endTime.split(':')[1] : '00'
                onEndTimeChange(`${hour}:${mins}`)
              } else {
                onEndTimeChange('')
              }
            }}
            className="flex-1 bg-white/10 border border-white/20 text-white rounded-lg px-3 py-3 text-base"
          >
            <option value="" className="bg-gray-800">{t('Hour')}</option>
            {Array.from({ length: 17 }, (_, i) => i + 6).map(hour => (
              <option key={hour} value={hour.toString().padStart(2, '0')} className="bg-gray-800">
                {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
              </option>
            ))}
          </select>
          <select
            value={endTime ? endTime.split(':')[1] : ''}
            onChange={(e) => {
              const mins = e.target.value
              const hour = endTime ? endTime.split(':')[0] : '17'
              onEndTimeChange(`${hour}:${mins}`)
            }}
            disabled={!endTime}
            className="w-24 bg-white/10 border border-white/20 text-white rounded-lg px-3 py-3 text-base disabled:opacity-50"
          >
            <option value="00" className="bg-gray-800">:00</option>
            <option value="15" className="bg-gray-800">:15</option>
            <option value="30" className="bg-gray-800">:30</option>
            <option value="45" className="bg-gray-800">:45</option>
          </select>
        </div>
      </div>

      {/* Clear Times Button */}
      {(startTime || endTime) && (
        <button
          type="button"
          onClick={() => {
            onStartTimeChange('')
            onEndTimeChange('')
          }}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          {t('Clear times (available all day)')}
        </button>
      )}

      <p className="text-xs text-gray-500">
        {t('Leave empty if available all day')}
      </p>
    </div>
  )
}

// Export with alias for drawer usage
export { SpecificAvailabilityEditor as SpecificAvailabilityContent }
