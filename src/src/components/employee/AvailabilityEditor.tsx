'use client'

import { useEffect, useState } from 'react'
import type { EmployeeAvailability, EmployeeAvailabilityDate, DayOfWeek } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { CalendarDays, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface AvailabilityEditorProps {
  employeeId: string
}

const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday'
}

export function AvailabilityEditor({ employeeId }: AvailabilityEditorProps) {
  const [weeklyAvailability, setWeeklyAvailability] = useState<Record<DayOfWeek, EmployeeAvailability | null>>({
    MON: null,
    TUE: null,
    WED: null,
    THU: null,
    FRI: null,
    SAT: null,
    SUN: null
  })
  const [specificDates, setSpecificDates] = useState<EmployeeAvailabilityDate[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [editingDate, setEditingDate] = useState<EmployeeAvailabilityDate | null>(null)
  const [newDateAvailable, setNewDateAvailable] = useState(true)
  const [newDateStartTime, setNewDateStartTime] = useState('')
  const [newDateEndTime, setNewDateEndTime] = useState('')
  const [newDateNote, setNewDateNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadAvailability()
  }, [employeeId])

  const loadAvailability = async () => {
    setLoading(true)
    try {
      // Load weekly availability
      const { data: weekly, error: weeklyError } = await supabase
        .from('employee_availability')
        .select('*')
        .eq('employee_id', employeeId)

      if (weeklyError) throw weeklyError

      const availabilityMap: Record<DayOfWeek, EmployeeAvailability | null> = {
        MON: null,
        TUE: null,
        WED: null,
        THU: null,
        FRI: null,
        SAT: null,
        SUN: null
      }

      weekly?.forEach(avail => {
        availabilityMap[avail.day_of_week as DayOfWeek] = avail
      })

      setWeeklyAvailability(availabilityMap)

      // Load specific dates
      const { data: dates, error: datesError } = await supabase
        .from('employee_availability_dates')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (datesError) throw datesError
      setSpecificDates(dates || [])
    } catch (error) {
      console.error('Error loading availability:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleWeeklyToggle = async (day: DayOfWeek, isAvailable: boolean) => {
    setSaving(true)
    try {
      const existing = weeklyAvailability[day]

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('employee_availability')
          .update({ is_available: isAvailable })
          .eq('id', existing.id)

        if (error) throw error

        setWeeklyAvailability(prev => ({
          ...prev,
          [day]: { ...existing, is_available: isAvailable }
        }))
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('employee_availability')
          .insert({
            employee_id: employeeId,
            day_of_week: day,
            is_available: isAvailable,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
          .select()
          .single()

        if (error) throw error

        setWeeklyAvailability(prev => ({
          ...prev,
          [day]: data
        }))
      }
    } catch (error) {
      console.error('Error updating availability:', error)
      toast.error('Failed to update availability')
    } finally {
      setSaving(false)
    }
  }

  const handleTimeUpdate = async (day: DayOfWeek, field: 'start_time' | 'end_time', value: string) => {
    setSaving(true)
    try {
      const existing = weeklyAvailability[day]
      if (!existing) return

      const { error } = await supabase
        .from('employee_availability')
        .update({ [field]: value || null })
        .eq('id', existing.id)

      if (error) throw error

      setWeeklyAvailability(prev => ({
        ...prev,
        [day]: { ...existing, [field]: value || null }
      }))
    } catch (error) {
      console.error('Error updating time:', error)
      toast.error('Failed to update time')
    } finally {
      setSaving(false)
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date) {
      // Check if this date already has settings
      const dateStr = date.toISOString().split('T')[0]
      const existing = specificDates.find(d => d.date === dateStr)

      if (existing) {
        setEditingDate(existing)
        setNewDateAvailable(existing.is_available)
        setNewDateStartTime(existing.start_time || '')
        setNewDateEndTime(existing.end_time || '')
        setNewDateNote(existing.note || '')
      } else {
        setEditingDate(null)
        setNewDateAvailable(true)
        setNewDateStartTime('')
        setNewDateEndTime('')
        setNewDateNote('')
      }
    }
  }

  const handleSaveSpecificDate = async () => {
    if (!selectedDate) return

    setSaving(true)
    try {
      const dateStr = selectedDate.toISOString().split('T')[0]

      if (editingDate) {
        // Update existing date
        const { error } = await supabase
          .from('employee_availability_dates')
          .update({
            is_available: newDateAvailable,
            start_time: newDateStartTime || null,
            end_time: newDateEndTime || null,
            note: newDateNote.trim() || null
          })
          .eq('id', editingDate.id)

        if (error) throw error

        setSpecificDates(prev =>
          prev.map(d => d.id === editingDate.id
            ? { ...d, is_available: newDateAvailable, start_time: newDateStartTime || null, end_time: newDateEndTime || null, note: newDateNote.trim() || null }
            : d
          )
        )
      } else {
        // Create new date
        const { data, error } = await supabase
          .from('employee_availability_dates')
          .insert({
            employee_id: employeeId,
            date: dateStr,
            is_available: newDateAvailable,
            start_time: newDateStartTime || null,
            end_time: newDateEndTime || null,
            note: newDateNote.trim() || null
          })
          .select()
          .single()

        if (error) throw error

        setSpecificDates(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
      }

      // Reset form
      setSelectedDate(undefined)
      setEditingDate(null)
      setNewDateAvailable(true)
      setNewDateStartTime('')
      setNewDateEndTime('')
      setNewDateNote('')
    } catch (error) {
      console.error('Error saving date:', error)
      toast.error('Failed to save date availability')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveSpecificDate = async (dateId: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('employee_availability_dates')
        .delete()
        .eq('id', dateId)

      if (error) throw error

      setSpecificDates(prev => prev.filter(d => d.id !== dateId))

      // Clear form if we're editing this date
      if (editingDate?.id === dateId) {
        setSelectedDate(undefined)
        setEditingDate(null)
        setNewDateAvailable(true)
        setNewDateStartTime('')
        setNewDateEndTime('')
        setNewDateNote('')
      }
    } catch (error) {
      console.error('Error removing date:', error)
      toast.error('Failed to remove date')
    } finally {
      setSaving(false)
    }
  }

  const hasDateSettings = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return specificDates.some(d => d.date === dateStr)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="weekly" className="w-full">
      <TabsList className="w-full grid grid-cols-2 mb-4 bg-white/10">
        <TabsTrigger value="weekly" className="text-xs data-[state=active]:bg-white/20 data-[state=active]:text-white text-gray-300">
          <Clock className="w-3 h-3 mr-1" />
          <span className="hidden sm:inline">Weekly</span>
          <span className="sm:hidden">Week</span>
        </TabsTrigger>
        <TabsTrigger value="calendar" className="text-xs data-[state=active]:bg-white/20 data-[state=active]:text-white text-gray-300">
          <CalendarDays className="w-3 h-3 mr-1" />
          <span className="hidden sm:inline">Calendar</span>
          <span className="sm:hidden">Cal</span>
        </TabsTrigger>
      </TabsList>

      {/* Weekly Availability */}
      <TabsContent value="weekly">
        <Card className="bg-white/10 border-white/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Weekly Schedule</CardTitle>
            <p className="text-xs text-gray-300">
              Set your default weekly availability
            </p>
          </CardHeader>
          <CardContent className="space-y-2 px-3">
            {DAYS.map(day => {
              const avail = weeklyAvailability[day]
              const isAvailable = avail?.is_available || false
              return (
                <div
                  key={day}
                  className={`rounded-lg border transition-all ${
                    isAvailable
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-white/20 bg-white/5'
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        isAvailable
                          ? 'bg-green-500 text-white'
                          : 'bg-white/20 text-gray-400'
                      }`}>
                        {day}
                      </div>
                      <span className="font-semibold text-white text-sm">{DAY_LABELS[day]}</span>
                    </div>
                    <Switch
                      id={`${day}-toggle`}
                      checked={isAvailable}
                      onCheckedChange={(checked) => handleWeeklyToggle(day, checked)}
                      disabled={saving}
                    />
                  </div>

                  {/* Time Inputs */}
                  {isAvailable && avail && (
                    <div className="px-3 pb-3 pt-0 space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor={`${day}-start`} className="text-[10px] font-semibold text-gray-300 uppercase">
                            From
                          </Label>
                          <Input
                            id={`${day}-start`}
                            type="time"
                            value={avail.start_time || ''}
                            onChange={(e) => handleTimeUpdate(day, 'start_time', e.target.value)}
                            disabled={saving}
                            className="h-11 bg-white/10 border-white/30 text-white text-sm px-3"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${day}-end`} className="text-[10px] font-semibold text-gray-300 uppercase">
                            To
                          </Label>
                          <Input
                            id={`${day}-end`}
                            type="time"
                            value={avail.end_time || ''}
                            onChange={(e) => handleTimeUpdate(day, 'end_time', e.target.value)}
                            disabled={saving}
                            className="h-11 bg-white/10 border-white/30 text-white text-sm px-3"
                          />
                        </div>
                      </div>
                      {avail.start_time && avail.end_time && (
                        <p className="text-[10px] text-green-300 font-medium text-center">
                          {avail.start_time} - {avail.end_time}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Calendar View */}
      <TabsContent value="calendar">
        <Card className="bg-white/10 border-white/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Monthly Calendar</CardTitle>
            <p className="text-xs text-gray-300">
              Tap a date to set your availability
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Calendar */}
            <div className="bg-white/5 rounded-lg p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="w-full mx-auto"
                classNames={{
                  months: "w-full flex justify-center",
                  month: "w-full space-y-3",
                  caption: "flex justify-center pt-1 relative items-center mb-3",
                  caption_label: "text-sm font-semibold text-white",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 rounded-md hover:bg-white/10 text-white",
                  nav_button_previous: "absolute left-0",
                  nav_button_next: "absolute right-0",
                  table: "w-full border-collapse",
                  head_row: "flex w-full mb-1",
                  head_cell: "text-gray-400 rounded-md font-medium text-[10px] uppercase flex-1 text-center h-8 flex items-center justify-center",
                  row: "flex w-full mt-1",
                  cell: "flex-1 text-center p-0.5 relative",
                  day: "h-10 w-full p-0 font-normal text-white hover:bg-white/10 rounded-md transition-colors text-xs flex items-center justify-center",
                  day_selected: "!bg-blue-500 text-white hover:!bg-blue-600",
                  day_today: "!bg-blue-500/30 !text-blue-300 font-bold border-2 border-blue-400",
                  day_outside: "text-gray-600 opacity-50",
                  day_disabled: "text-gray-600 opacity-30",
                  day_hidden: "invisible",
                }}
                modifiers={{
                  hasSettings: (date) => hasDateSettings(date),
                  available: (date) => {
                    const dateStr = date.toISOString().split('T')[0]
                    const dateData = specificDates.find(d => d.date === dateStr)
                    return dateData?.is_available || false
                  },
                  unavailable: (date) => {
                    const dateStr = date.toISOString().split('T')[0]
                    const dateData = specificDates.find(d => d.date === dateStr)
                    return dateData?.is_available === false
                  }
                }}
                modifiersStyles={{
                  available: {
                    backgroundColor: 'rgb(34 197 94)',
                    color: 'white',
                    fontWeight: 'bold'
                  },
                  unavailable: {
                    backgroundColor: 'rgb(239 68 68)',
                    color: 'white',
                    fontWeight: 'bold'
                  }
                }}
              />
            </div>

            {/* Legend */}
            <div className="flex gap-2 text-[10px] justify-center flex-wrap px-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span className="text-gray-300">Available</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500"></div>
                <span className="text-gray-300">Unavailable</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-400"></div>
                <span className="text-gray-300">Today</span>
              </div>
            </div>

            {/* Selected Date Edit Panel */}
            {selectedDate && (
              <div className="border-t border-white/20 pt-3 space-y-3">
                <div className="flex items-center justify-between px-3">
                  <h3 className="font-semibold text-sm text-white">
                    {formatDate(selectedDate.toISOString().split('T')[0])}
                  </h3>
                  {editingDate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSpecificDate(editingDate.id)}
                      disabled={saving}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 -mr-2 h-7 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Available Toggle */}
                <div className={`mx-3 p-3 rounded-lg border transition-all ${
                  newDateAvailable
                    ? 'border-green-500/50 bg-green-500/10'
                    : 'border-red-500/50 bg-red-500/10'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <Label htmlFor="date-available" className="text-sm font-semibold text-white">
                      {newDateAvailable ? 'Available' : 'Unavailable'}
                    </Label>
                    <Switch
                      id="date-available"
                      checked={newDateAvailable}
                      onCheckedChange={setNewDateAvailable}
                      disabled={saving}
                    />
                  </div>

                  {/* Time Window */}
                  {newDateAvailable && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="date-start" className="text-[10px] font-semibold text-gray-300 uppercase">
                            From
                          </Label>
                          <Input
                            id="date-start"
                            type="time"
                            value={newDateStartTime}
                            onChange={(e) => setNewDateStartTime(e.target.value)}
                            disabled={saving}
                            className="h-11 bg-white/10 border-white/30 text-white text-sm px-3"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="date-end" className="text-[10px] font-semibold text-gray-300 uppercase">
                            To
                          </Label>
                          <Input
                            id="date-end"
                            type="time"
                            value={newDateEndTime}
                            onChange={(e) => setNewDateEndTime(e.target.value)}
                            disabled={saving}
                            className="h-11 bg-white/10 border-white/30 text-white text-sm px-3"
                          />
                        </div>
                      </div>
                      {newDateStartTime && newDateEndTime && (
                        <p className="text-[10px] text-green-300 font-medium text-center">
                          {newDateStartTime} - {newDateEndTime}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Note */}
                  <div className="space-y-1 mt-3">
                    <Label htmlFor="date-note" className="text-[10px] font-semibold text-gray-300 uppercase">
                      Note (Optional)
                    </Label>
                    <Input
                      id="date-note"
                      type="text"
                      placeholder="e.g., Vacation, Doctor"
                      value={newDateNote}
                      onChange={(e) => setNewDateNote(e.target.value)}
                      disabled={saving}
                      className="bg-white/10 border-white/30 text-white placeholder:text-gray-500 text-sm h-10 px-3"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="px-3">
                  <Button
                    onClick={handleSaveSpecificDate}
                    disabled={saving}
                    className="w-full h-11 text-sm font-semibold bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? 'Saving...' : editingDate ? 'Update Date' : 'Save Date'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
