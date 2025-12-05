'use client'

import { useState } from 'react'
import type { JobSession, JobTemplate, Employee, JobSessionStatus } from '@/types/database'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime } from '@/lib/utils/dateFormatters'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate
  employee: Employee | null
}

interface ScheduleJobPopupProps {
  jobSession: JobSessionWithDetails | null
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

export function ScheduleJobPopup({ jobSession, open, onClose, onUpdate }: ScheduleJobPopupProps) {
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [loading, setLoading] = useState(false)

  if (!jobSession) return null

  const supabase = createClient()

  const getStatusColor = (status: JobSessionStatus): string => {
    switch (status) {
      case 'OFFERED':
        return 'bg-gray-500'
      case 'CLAIMED':
        return 'bg-yellow-500'
      case 'APPROVED':
        return 'bg-blue-500'
      case 'IN_PROGRESS':
        return 'bg-purple-500'
      case 'COMPLETED':
        return 'bg-green-500'
      case 'CANCELLED':
        return 'bg-red-500'
      case 'EVALUATED':
        return 'bg-teal-500'
      default:
        return 'bg-gray-500'
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this job session?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({ status: 'CANCELLED' })
        .eq('id', jobSession.id)

      if (error) throw error

      alert('Job session cancelled successfully')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error cancelling job session:', error)
      alert('Failed to cancel job session')
    } finally {
      setLoading(false)
    }
  }

  const handleReschedule = async () => {
    if (!newDate || !newTime) {
      alert('Please provide both date and time')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          scheduled_date: newDate,
          scheduled_time: newTime
        })
        .eq('id', jobSession.id)

      if (error) throw error

      alert('Job session rescheduled successfully')
      setIsRescheduling(false)
      setNewDate('')
      setNewTime('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error rescheduling job session:', error)
      alert('Failed to reschedule job session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {jobSession.job_template.title}
            <Badge className={getStatusColor(jobSession.status)}>
              {jobSession.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {jobSession.full_job_code || jobSession.session_code}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job Details */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-lg">Job Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">Job Code:</span> {jobSession.job_template.job_code}
              </div>
              <div>
                <span className="font-medium">Client Code:</span> {jobSession.job_template.client_code}
              </div>
              <div>
                <span className="font-medium">Date:</span>{' '}
                {jobSession.scheduled_date ? formatDate(jobSession.scheduled_date) : 'Not scheduled'}
              </div>
              <div>
                <span className="font-medium">Time:</span>{' '}
                {jobSession.scheduled_time ? formatTime(jobSession.scheduled_time) : 'Not scheduled'}
              </div>
              {jobSession.job_template.duration_minutes && (
                <div>
                  <span className="font-medium">Duration:</span> {jobSession.job_template.duration_minutes} min
                </div>
              )}
              {jobSession.job_template.price_per_hour && (
                <div>
                  <span className="font-medium">Rate:</span> ${jobSession.job_template.price_per_hour}/hr
                </div>
              )}
            </div>
            {jobSession.job_template.address && (
              <div className="pt-2">
                <span className="font-medium">Address:</span>
                <p className="text-gray-600">{jobSession.job_template.address}</p>
              </div>
            )}
            {jobSession.job_template.description && (
              <div className="pt-2">
                <span className="font-medium">Description:</span>
                <p className="text-gray-600">{jobSession.job_template.description}</p>
              </div>
            )}
          </div>

          {/* Employee Details */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-lg">Assigned Employee</h3>
            {jobSession.employee ? (
              <div className="text-sm space-y-1">
                <div>
                  <span className="font-medium">Name:</span> {jobSession.employee.full_name}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {jobSession.employee.email}
                </div>
                {jobSession.employee.phone && (
                  <div>
                    <span className="font-medium">Phone:</span> {jobSession.employee.phone}
                  </div>
                )}
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  <Badge variant="outline">{jobSession.employee.status}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No employee assigned yet</p>
            )}
          </div>

          {/* Reschedule Section */}
          {isRescheduling && (
            <div className="border rounded-lg p-4 space-y-4 bg-blue-50">
              <h3 className="font-semibold text-lg">Reschedule Job</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-date">New Date</Label>
                  <Input
                    id="new-date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-time">New Time</Label>
                  <Input
                    id="new-time"
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleReschedule} disabled={loading}>
                  {loading ? 'Saving...' : 'Confirm Reschedule'}
                </Button>
                <Button variant="outline" onClick={() => setIsRescheduling(false)} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {!isRescheduling && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsRescheduling(true)}
                disabled={loading || jobSession.status === 'CANCELLED' || jobSession.status === 'COMPLETED'}
              >
                Reschedule
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={loading || jobSession.status === 'CANCELLED' || jobSession.status === 'COMPLETED'}
              >
                {loading ? 'Cancelling...' : 'Cancel Job'}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
