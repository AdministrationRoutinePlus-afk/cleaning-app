'use client'

import { useState, useEffect } from 'react'
import type { JobTemplate, Employee } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Edit2, Copy, Trash2, Play, Pause, UserPlus } from 'lucide-react'

interface JobCardProps {
  job: JobTemplate
  onUpdate: () => void
}

export function JobCard({ job, onUpdate }: JobCardProps) {
  const [loading, setLoading] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (assignDialogOpen) {
      fetchEmployees()
    }
  }, [assignDialogOpen])

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('full_name')
    setEmployees(data || [])
  }

  const handleAssign = async () => {
    if (!selectedEmployee || !scheduledDate) {
      toast.error('Please select an employee and date')
      return
    }

    setLoading(true)
    try {
      const { data: existingSessions } = await supabase
        .from('job_sessions')
        .select('session_code')
        .eq('job_template_id', job.id)
        .order('session_code', { ascending: false })
        .limit(1)

      let nextSessionNum = 1
      if (existingSessions && existingSessions.length > 0) {
        const lastCode = existingSessions[0].session_code
        const numPart = parseInt(lastCode.substring(1))
        nextSessionNum = numPart + 1
      }

      const sessionCode = `A${nextSessionNum.toString().padStart(3, '0')}`
      const fullJobCode = `${job.job_code}-${sessionCode}`

      const { error } = await supabase
        .from('job_sessions')
        .insert({
          job_template_id: job.id,
          session_code: sessionCode,
          full_job_code: fullJobCode,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime || null,
          assigned_to: selectedEmployee,
          status: 'APPROVED',
        })

      if (error) throw error

      setAssignDialogOpen(false)
      setSelectedEmployee('')
      setScheduledDate('')
      setScheduledTime('')
      onUpdate()
    } catch (error) {
      console.error('Error assigning job:', error)
      toast.error('Failed to assign job')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    setLoading(true)
    try {
      const newStatus = job.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE'
      const { error } = await supabase
        .from('job_templates')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', job.id)

      if (error) throw error
      onUpdate()
    } catch (error) {
      console.error('Error updating job status:', error)
      toast.error('Failed to update job status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job template?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_templates')
        .delete()
        .eq('id', job.id)

      if (error) throw error
      onUpdate()
    } catch (error) {
      console.error('Error deleting job:', error)
      toast.error('Failed to delete job. Make sure there are no active sessions.')
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async () => {
    setLoading(true)
    try {
      const { data: existingJobs } = await supabase
        .from('job_templates')
        .select('template_number')
        .eq('client_code', job.client_code)
        .order('template_number', { ascending: false })
        .limit(1)

      let nextNumber = 1
      if (existingJobs && existingJobs.length > 0) {
        const lastNumber = parseInt(existingJobs[0].template_number)
        nextNumber = lastNumber + 1
      }

      const templateNumber = nextNumber.toString().padStart(2, '0')

      const duplicate = {
        client_code: job.client_code,
        template_number: templateNumber,
        version_letter: 'A',
        title: `${job.title} (Copy)`,
        description: job.description,
        address: job.address,
        duration_minutes: job.duration_minutes,
        price_per_hour: job.price_per_hour,
        notes: job.notes,
        timezone: job.timezone,
        available_days: job.available_days,
        time_window_start: job.time_window_start,
        time_window_end: job.time_window_end,
        is_recurring: job.is_recurring,
        frequency_per_week: job.frequency_per_week,
        status: 'DRAFT' as const,
        customer_id: job.customer_id,
        created_by: job.created_by,
      }

      const { error } = await supabase
        .from('job_templates')
        .insert(duplicate)

      if (error) throw error
      onUpdate()
    } catch (error) {
      console.error('Error duplicating job:', error)
      toast.error('Failed to duplicate job')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    router.push(`/employer/jobs/${job.id}/edit`)
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Not set'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  const getStatusBadge = () => {
    if (job.status === 'ACTIVE') {
      return <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">ACTIVE</Badge>
    }
    return <Badge className="bg-gray-500/20 text-gray-300 border border-gray-500/30">DRAFT</Badge>
  }

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:bg-white/[0.07] transition-colors">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-gray-500">{job.job_code}</span>
              {getStatusBadge()}
            </div>
            <h3 className="text-lg font-semibold text-white">{job.title}</h3>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3 space-y-2">
        {job.description && (
          <p className="text-sm text-gray-400 line-clamp-2">{job.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-sm font-medium text-gray-300">{formatDuration(job.duration_minutes)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Rate</p>
            <p className="text-sm font-medium text-gray-300">
              {job.price_per_hour ? `$${job.price_per_hour}/hr` : 'Not set'}
            </p>
          </div>
        </div>

        {(job.time_window_start || job.time_window_end) && (
          <div className="pt-2">
            <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
              <p className="text-xs text-blue-400 font-medium mb-1">Time Window</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  {job.time_window_start ? job.time_window_start.substring(0, 5) : 'Not set'}
                </span>
                <span className="text-gray-500">→</span>
                <span className="text-gray-300">
                  {job.time_window_end ? job.time_window_end.substring(0, 5) : 'Not set'}
                </span>
              </div>
            </div>
          </div>
        )}

        {job.address && (
          <div className="pt-1">
            <p className="text-xs text-gray-500">Address</p>
            <p className="text-sm text-gray-300">{job.address}</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 pb-4 pt-3 border-t border-white/10 flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            disabled={loading}
            className="flex-1 border-white/20 text-gray-300 hover:bg-white/10"
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || job.status !== 'ACTIVE'}
                className="flex-1 border-white/20 text-gray-300 hover:bg-white/10"
              >
                <UserPlus className="w-3 h-3 mr-1" />
                Assign
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
              <DialogHeader>
                <DialogTitle className="text-white">Assign Job to Employee</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Create a new session for {job.job_code} and assign it directly to an employee.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-white/20">
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id} className="text-white hover:bg-white/10">
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Date</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
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
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAssignDialogOpen(false)}
                  className="border-white/20 text-gray-300 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button onClick={handleAssign} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? 'Assigning...' : 'Assign Job'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex gap-2 w-full">
          <Button
            size="sm"
            onClick={handleActivate}
            disabled={loading}
            className={`flex-1 ${
              job.status === 'ACTIVE'
                ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {job.status === 'ACTIVE' ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
            {loading ? '...' : job.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={loading}
            className="flex-1 border-white/20 text-gray-300 hover:bg-white/10"
          >
            <Copy className="w-3 h-3 mr-1" />
            Duplicate
          </Button>
          <Button
            size="sm"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
