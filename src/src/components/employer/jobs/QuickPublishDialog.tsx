'use client'

import { useState, useEffect, useRef } from 'react'
import type { JobTemplate, Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getNextSessionNumber } from '@/lib/jobs/sessionGenerator'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface QuickPublishDialogProps {
  job: JobTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}

export function QuickPublishDialog({ job, open, onOpenChange, onUpdate }: QuickPublishDialogProps) {
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState(job.time_window_start || '')
  const [selectedEmployee, setSelectedEmployee] = useState('anyone')

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    if (open) {
      fetchEmployees()
      setScheduledDate('')
      setScheduledTime(job.time_window_start || '')
      setSelectedEmployee('anyone')
    }
  }, [open])

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('full_name')
    setEmployees(data || [])
  }

  const handlePublish = async () => {
    if (!scheduledDate) {
      toast.error('Please select a date')
      return
    }

    const today = format(new Date(), 'yyyy-MM-dd')
    if (scheduledDate < today) {
      toast.error('Scheduled date cannot be in the past')
      return
    }

    setLoading(true)
    try {
      const nextNum = await getNextSessionNumber(supabase, job.id)
      const sessionCode = `A${nextNum.toString().padStart(3, '0')}`
      const fullJobCode = `${job.job_code}-${sessionCode}`

      const isAssigned = selectedEmployee !== 'anyone'
      const status = isAssigned ? 'APPROVED' : 'OFFERED'

      // Calculate scheduled_end_date from window days
      let scheduledEndDate: string | null = null
      if (job.window_start_day && job.window_end_day) {
        const dayMap: Record<string, number> = {
          'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6
        }
        const startDayNum = dayMap[job.window_start_day] ?? 0
        const endDayNum = dayMap[job.window_end_day] ?? startDayNum
        let windowDays = endDayNum - startDayNum
        if (windowDays < 0) windowDays += 7
        if (windowDays === 0 && job.window_start_day !== job.window_end_day) windowDays = 7
        if (windowDays > 0) {
          const startDate = new Date(scheduledDate)
          const endDate = new Date(startDate)
          endDate.setDate(endDate.getDate() + windowDays)
          scheduledEndDate = endDate.toISOString().split('T')[0]
        }
      }

      const { error } = await supabase
        .from('job_sessions')
        .insert({
          job_template_id: job.id,
          session_code: sessionCode,
          full_job_code: fullJobCode,
          scheduled_date: scheduledDate,
          scheduled_end_date: scheduledEndDate,
          scheduled_time: scheduledTime || null,
          assigned_to: isAssigned ? selectedEmployee : null,
          status,
        })

      if (error) throw error

      toast.success(isAssigned ? 'Job assigned successfully' : 'Job published to marketplace')
      onOpenChange(false)
      onUpdate()
    } catch (error) {
      console.error('Error publishing job:', error)
      toast.error('Failed to publish job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white">Quick Publish</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a single session for {job.job_code} — {job.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Date *</Label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="bg-white/5 border-white/20 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Time (optional)</Label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="bg-white/5 border-white/20 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Assign to</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder="Anyone (marketplace)" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="anyone" className="text-white hover:bg-white/10">
                  Anyone (marketplace)
                </SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id} className="text-white hover:bg-white/10">
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {selectedEmployee === 'anyone'
                ? 'Session will be OFFERED on the marketplace'
                : 'Session will be directly APPROVED for this employee'}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={loading || !scheduledDate}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
