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
  customerName?: string | null
  onUpdate: () => void
}

export function JobCard({ job, customerName, onUpdate }: JobCardProps) {
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
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-block bg-gray-800/80 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg border border-white/30 font-mono">
              {job.job_code}
            </span>
            {getStatusBadge()}
          </div>
          {customerName && (
            <span className="text-sm text-gray-400 truncate">{customerName}</span>
          )}
        </div>
        <h3 className="text-xl font-bold text-white leading-tight">{job.title}</h3>
        {job.description && (
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{job.description}</p>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-3 space-y-3">
        {/* Duration & Rate Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800/60 rounded-xl p-3 text-center border border-white/20">
            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Duration</p>
            <p className="text-white font-bold text-base">{formatDuration(job.duration_minutes)}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/40 to-orange-900/40 rounded-xl p-3 text-center border border-yellow-500/40">
            <p className="text-yellow-300 text-[10px] uppercase font-bold mb-1">Rate</p>
            <p className="text-white font-bold text-base">
              {job.price_per_hour ? `$${job.price_per_hour}/hr` : 'Not set'}
            </p>
          </div>
        </div>

        {/* Time Window */}
        {(job.time_window_start || job.time_window_end) && (
          <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/30">
            <p className="text-blue-400 text-[10px] uppercase font-bold mb-1">Time Window</p>
            <div className="flex items-center justify-between">
              <span className="text-white font-bold">
                {job.time_window_start ? job.time_window_start.substring(0, 5) : 'Not set'}
              </span>
              <span className="text-gray-500">→</span>
              <span className="text-white font-bold">
                {job.time_window_end ? job.time_window_end.substring(0, 5) : 'Not set'}
              </span>
            </div>
          </div>
        )}

        {/* Address */}
        {job.address && (
          <div className="bg-gray-800/60 rounded-xl p-3 border border-white/20">
            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Address</p>
            <p className="text-white text-sm">{job.address}</p>
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
            className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
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
                className="flex-1 bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
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
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
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
        <Button
          size="sm"
          onClick={handleActivate}
          disabled={loading}
          className={`w-full ${
            job.status === 'ACTIVE'
              ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {job.status === 'ACTIVE' ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
          {loading ? '...' : job.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        </Button>
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={loading}
            className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
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
