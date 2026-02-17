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
import { useTranslation } from '@/lib/i18n/useTranslation'

interface QuickPublishDialogProps {
  job: JobTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}

export function QuickPublishDialog({ job, open, onOpenChange, onUpdate }: QuickPublishDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledEndDate, setScheduledEndDate] = useState('')
  const [timeWindowStart, setTimeWindowStart] = useState(job.time_window_start || '')
  const [timeWindowEnd, setTimeWindowEnd] = useState(job.time_window_end || '')
  const [selectedEmployee, setSelectedEmployee] = useState('anyone')

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    if (open) {
      fetchEmployees()
      setScheduledDate('')
      setScheduledEndDate('')
      setTimeWindowStart(job.time_window_start || '')
      setTimeWindowEnd(job.time_window_end || '')
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
    if (!scheduledDate || !scheduledEndDate) {
      toast.error(t('Please select start and end dates'))
      return
    }
    if (!timeWindowStart || !timeWindowEnd) {
      toast.error(t('Please set the time window'))
      return
    }

    const today = format(new Date(), 'yyyy-MM-dd')
    if (scheduledDate < today) {
      toast.error(t('Scheduled date cannot be in the past'))
      return
    }
    if (scheduledEndDate < scheduledDate) {
      toast.error(t('End date cannot be before start date'))
      return
    }

    setLoading(true)
    try {
      const nextNum = await getNextSessionNumber(supabase, job.id)
      const sessionCode = `A${nextNum.toString().padStart(3, '0')}`
      const fullJobCode = `${job.job_code}-${sessionCode}`

      const isAssigned = selectedEmployee !== 'anyone'
      const status = isAssigned ? 'APPROVED' : 'OFFERED'

      const { error } = await supabase
        .from('job_sessions')
        .insert({
          job_template_id: job.id,
          session_code: sessionCode,
          full_job_code: fullJobCode,
          scheduled_date: scheduledDate,
          scheduled_end_date: scheduledEndDate !== scheduledDate ? scheduledEndDate : null,
          scheduled_time: timeWindowStart || null,
          assigned_to: isAssigned ? selectedEmployee : null,
          status,
        })

      if (error) throw error

      toast.success(isAssigned ? t('Job assigned successfully') : t('Job published to marketplace'))
      onOpenChange(false)
      onUpdate()
    } catch (error) {
      console.error('Error publishing job:', error)
      toast.error(t('Failed to publish job'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white">{t('Quick Publish')}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('Create a single session for')} {job.job_code} — {job.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-gray-300">{t('Start')} *</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => {
                  setScheduledDate(e.target.value)
                  if (!scheduledEndDate || e.target.value > scheduledEndDate) {
                    setScheduledEndDate(e.target.value)
                  }
                }}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="bg-white/5 border-white/20 text-white flex-1"
              />
              <Input
                type="time"
                value={timeWindowStart}
                onChange={(e) => setTimeWindowStart(e.target.value)}
                className="bg-white/5 border-white/20 text-white w-32"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">{t('End')} *</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={scheduledEndDate}
                onChange={(e) => setScheduledEndDate(e.target.value)}
                min={scheduledDate || format(new Date(), 'yyyy-MM-dd')}
                className="bg-white/5 border-white/20 text-white flex-1"
              />
              <Input
                type="time"
                value={timeWindowEnd}
                onChange={(e) => setTimeWindowEnd(e.target.value)}
                className="bg-white/5 border-white/20 text-white w-32"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">{t('Assign to')}</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder={t('Anyone (marketplace)')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="anyone" className="text-white hover:bg-white/10">
                  {t('Anyone (marketplace)')}
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
                ? t('Session will be OFFERED on the marketplace')
                : t('Session will be directly APPROVED for this employee')}
            </p>
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
            onClick={handlePublish}
            disabled={loading || !scheduledDate || !scheduledEndDate || !timeWindowStart || !timeWindowEnd}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? t('Publishing...') : t('Publish')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
