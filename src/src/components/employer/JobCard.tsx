'use client'

import { useState, useEffect } from 'react'
import type { JobTemplate, Employee } from '@/types/database'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useRouter } from 'next/navigation'

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

  // Fetch employees when dialog opens
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
      alert('Please select an employee and date')
      return
    }

    setLoading(true)
    try {
      // Get next session code for this job template
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

      // Create job session
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
      alert('Failed to assign job')
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
      alert('Failed to update job status')
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
      alert('Failed to delete job. Make sure there are no active sessions.')
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async () => {
    setLoading(true)
    try {
      // Get next template number for this client code
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

      // Create duplicate (without id, created_at, job_code - database generates those)
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
      alert('Failed to duplicate job')
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

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-gray-500">{job.job_code}</span>
              <Badge variant={job.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {job.status}
              </Badge>
            </div>
            <CardTitle className="text-lg">{job.title}</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-2">
        {job.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{job.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-sm font-medium">{formatDuration(job.duration_minutes)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Rate</p>
            <p className="text-sm font-medium">
              {job.price_per_hour ? `$${job.price_per_hour}/hr` : 'Not set'}
            </p>
          </div>
        </div>

        {job.address && (
          <div className="pt-1">
            <p className="text-xs text-gray-500">Address</p>
            <p className="text-sm">{job.address}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-3 border-t">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            disabled={loading}
            className="flex-1"
          >
            Edit
          </Button>
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || job.status !== 'ACTIVE'}
                className="flex-1"
              >
                Assign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Job to Employee</DialogTitle>
                <DialogDescription>
                  Create a new session for {job.job_code} and assign it directly to an employee.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time (optional)</Label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssign} disabled={loading}>
                  {loading ? 'Assigning...' : 'Assign Job'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex gap-2 w-full">
          <Button
            variant={job.status === 'ACTIVE' ? 'secondary' : 'default'}
            size="sm"
            onClick={handleActivate}
            disabled={loading}
            className="flex-1"
          >
            {loading ? '...' : job.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={loading}
            className="flex-1"
          >
            Duplicate
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1"
          >
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
