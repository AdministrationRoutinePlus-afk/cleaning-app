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
  const [newDate, setNewDate] = useState('')
  const [newDateAvailable, setNewDateAvailable] = useState(true)
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
      alert('Failed to update availability')
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
      alert('Failed to update time')
    } finally {
      setSaving(false)
    }
  }

  const handleAddSpecificDate = async () => {
    if (!newDate) return

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('employee_availability_dates')
        .insert({
          employee_id: employeeId,
          date: newDate,
          is_available: newDateAvailable,
          note: newDateNote.trim() || null
        })
        .select()
        .single()

      if (error) throw error

      setSpecificDates(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
      setNewDate('')
      setNewDateAvailable(true)
      setNewDateNote('')
    } catch (error) {
      console.error('Error adding date:', error)
      alert('Failed to add date')
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
    } catch (error) {
      console.error('Error removing date:', error)
      alert('Failed to remove date')
    } finally {
      setSaving(false)
    }
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
      <TabsList className="w-full grid grid-cols-2 mb-4">
        <TabsTrigger value="weekly">Weekly Schedule</TabsTrigger>
        <TabsTrigger value="specific">Specific Dates</TabsTrigger>
      </TabsList>

      {/* Weekly Availability */}
      <TabsContent value="weekly">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Availability</CardTitle>
            <p className="text-sm text-gray-600">
              Set your regular weekly availability schedule
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {DAYS.map(day => {
              const avail = weeklyAvailability[day]
              return (
                <div key={day} className="space-y-2 pb-4 border-b last:border-b-0">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`${day}-toggle`} className="font-medium">
                      {DAY_LABELS[day]}
                    </Label>
                    <Switch
                      id={`${day}-toggle`}
                      checked={avail?.is_available || false}
                      onCheckedChange={(checked) => handleWeeklyToggle(day, checked)}
                      disabled={saving}
                    />
                  </div>

                  {avail?.is_available && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="space-y-1">
                        <Label htmlFor={`${day}-start`} className="text-xs text-gray-600">
                          Start Time
                        </Label>
                        <Input
                          id={`${day}-start`}
                          type="time"
                          value={avail.start_time || ''}
                          onChange={(e) => handleTimeUpdate(day, 'start_time', e.target.value)}
                          disabled={saving}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${day}-end`} className="text-xs text-gray-600">
                          End Time
                        </Label>
                        <Input
                          id={`${day}-end`}
                          type="time"
                          value={avail.end_time || ''}
                          onChange={(e) => handleTimeUpdate(day, 'end_time', e.target.value)}
                          disabled={saving}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Specific Dates */}
      <TabsContent value="specific">
        <Card>
          <CardHeader>
            <CardTitle>Specific Date Overrides</CardTitle>
            <p className="text-sm text-gray-600">
              Add specific dates when you're available or unavailable
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add New Date */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="new-date">Date</Label>
                <Input
                  id="new-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="new-date-available">Available on this date?</Label>
                <Switch
                  id="new-date-available"
                  checked={newDateAvailable}
                  onCheckedChange={setNewDateAvailable}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-date-note">Note (optional)</Label>
                <Input
                  id="new-date-note"
                  type="text"
                  placeholder="e.g., Vacation, Available all day"
                  value={newDateNote}
                  onChange={(e) => setNewDateNote(e.target.value)}
                  disabled={saving}
                />
              </div>

              <Button
                onClick={handleAddSpecificDate}
                disabled={!newDate || saving}
                className="w-full"
              >
                {saving ? 'Adding...' : 'Add Date'}
              </Button>
            </div>

            {/* List of Specific Dates */}
            <div className="space-y-2">
              {specificDates.length === 0 ? (
                <p className="text-center text-gray-500 py-4 text-sm">
                  No specific dates added yet
                </p>
              ) : (
                specificDates.map(dateEntry => (
                  <div
                    key={dateEntry.id}
                    className="flex items-start justify-between p-3 bg-white border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{formatDate(dateEntry.date)}</p>
                      <p className={`text-xs mt-1 ${dateEntry.is_available ? 'text-green-600' : 'text-red-600'}`}>
                        {dateEntry.is_available ? 'Available' : 'Unavailable'}
                      </p>
                      {dateEntry.note && (
                        <p className="text-xs text-gray-600 mt-1 italic">{dateEntry.note}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSpecificDate(dateEntry.id)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
