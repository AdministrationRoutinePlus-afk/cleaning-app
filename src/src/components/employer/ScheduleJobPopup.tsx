'use client'

/**
 * ScheduleJobPopup Component - Dark Theme
 *
 * A modal dialog that displays job session details and provides actions for
 * managing scheduled jobs from the employer's calendar view.
 */

import { useState, useEffect, useRef } from 'react'
import type { JobSession, JobTemplate, Employee, JobSessionStatus } from '@/types/database'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase/client'
import { getNextSessionNumber } from '@/lib/jobs/sessionGenerator'
import { formatDate, formatTime } from '@/lib/utils/dateFormatters'
import { sanitizeText } from '@/lib/utils/sanitize'
import { toast } from 'sonner'
import { format } from 'date-fns'

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
  const [isModifyingPrice, setIsModifyingPrice] = useState(false)
  const [isPushingMessage, setIsPushingMessage] = useState(false)
  const [isRefusing, setIsRefusing] = useState(false)
  const [isReassigning, setIsReassigning] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)

  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [refuseReason, setRefuseReason] = useState('')
  const [reassignEmployeeId, setReassignEmployeeId] = useState('')
  const [loading, setLoading] = useState(false)

  // Employee availability: employeeId -> number of jobs on the session date
  const [employeeAvailability, setEmployeeAvailability] = useState<Map<string, number>>(new Map())

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    if (isPushingMessage || isReassigning) {
      loadEmployees()
    }
  }, [isPushingMessage, isReassigning])

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'ACTIVE')
      .order('full_name')

    if (!error && data) {
      setAllEmployees(data)
      if (jobSession?.assigned_to) {
        setSelectedEmployeeIds([jobSession.assigned_to])
      }
      // Load availability for the session date
      if (jobSession?.scheduled_date) {
        loadEmployeeAvailability(data, jobSession.scheduled_date)
      }
    }
  }

  const loadEmployeeAvailability = async (employees: Employee[], date: string) => {
    const { data: sessionsOnDate } = await supabase
      .from('job_sessions')
      .select('assigned_to')
      .eq('scheduled_date', date)
      .in('status', ['OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS'])
      .not('assigned_to', 'is', null)

    const countMap = new Map<string, number>()
    for (const emp of employees) {
      countMap.set(emp.id, 0)
    }
    if (sessionsOnDate) {
      for (const session of sessionsOnDate) {
        if (session.assigned_to) {
          countMap.set(session.assigned_to, (countMap.get(session.assigned_to) || 0) + 1)
        }
      }
    }
    setEmployeeAvailability(countMap)
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedEmployeeIds(allEmployees.map(e => e.id))
    } else {
      setSelectedEmployeeIds([])
    }
  }

  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId)
      } else {
        return [...prev, employeeId]
      }
    })
  }

  if (!jobSession || !jobSession.job_template) return null

  const canModify = jobSession.status !== 'CANCELLED' && jobSession.status !== 'COMPLETED' && jobSession.status !== 'EVALUATED' && jobSession.status !== 'MISSED' && jobSession.status !== 'OVERDUE'
  const canRecover = jobSession.status === 'MISSED' || jobSession.status === 'OVERDUE'

  const getStatusBadge = (status: JobSessionStatus) => {
    const config: Record<string, { bg: string; text: string; border: string }> = {
      OFFERED: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30' },
      CLAIMED: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
      APPROVED: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
      IN_PROGRESS: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
      COMPLETED: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
      EVALUATED: { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30' },
      CANCELLED: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
      MISSED: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
      OVERDUE: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
    }
    const c = config[status] || config.OFFERED
    return <Badge className={`${c.bg} ${c.text} border ${c.border}`}>{status}</Badge>
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
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error cancelling job session:', error)
      toast.error('Failed to cancel job session')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'APPROVED',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobSession.id)

      if (error) throw error
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error approving job:', error)
      toast.error('Failed to approve job')
    } finally {
      setLoading(false)
    }
  }

  const handleRefuse = async () => {
    if (!refuseReason.trim()) {
      toast.error('Please provide a reason for refusing')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'REFUSED',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobSession.id)

      if (error) throw error

      if (jobSession.assigned_to) {
        const sanitizedReason = sanitizeText(refuseReason.trim())
        await supabase
          .from('schedule_messages')
          .insert({
            job_session_id: jobSession.id,
            employee_id: jobSession.assigned_to,
            message: `Your claim was refused: ${sanitizedReason}`
          })
      }

      // Create a replacement OFFERED session so the job goes back to marketplace
      const nextNum = await getNextSessionNumber(supabase, jobSession.job_template_id)
      const sessionCode = `A${String(nextNum).padStart(3, '0')}`
      const fullJobCode = `${jobSession.job_template.job_code}-${sessionCode}`

      await supabase
        .from('job_sessions')
        .insert({
          job_template_id: jobSession.job_template_id,
          session_code: sessionCode,
          full_job_code: fullJobCode,
          scheduled_date: jobSession.scheduled_date,
          scheduled_end_date: jobSession.scheduled_end_date,
          scheduled_time: jobSession.scheduled_time,
          status: 'OFFERED',
          assigned_to: null,
        })

      setIsRefusing(false)
      setRefuseReason('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error refusing job:', error)
      toast.error('Failed to refuse job')
    } finally {
      setLoading(false)
    }
  }

  const handleReschedule = async () => {
    if (!newDate || !newTime) {
      toast.error('Please provide both date and time')
      return
    }

    // Validate date is not in the past
    const selectedDate = new Date(newDate + 'T' + newTime)
    if (selectedDate < new Date()) {
      toast.error('Cannot schedule a job in the past')
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

      setIsRescheduling(false)
      setNewDate('')
      setNewTime('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error rescheduling job session:', error)
      toast.error('Failed to reschedule job session')
    } finally {
      setLoading(false)
    }
  }

  const handleModifyPrice = async () => {
    const priceValue = parseFloat(newPrice)
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error('Please enter a valid price')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          price_override: priceValue
        })
        .eq('id', jobSession.id)

      if (error) throw error

      setIsModifyingPrice(false)
      setNewPrice('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error modifying price:', error)
      toast.error('Failed to modify price')
    } finally {
      setLoading(false)
    }
  }

  const handlePushMessage = async () => {
    if (!messageContent.trim()) {
      toast.error('Please enter a message')
      return
    }

    if (selectedEmployeeIds.length === 0) {
      toast.error('Please select at least one employee')
      return
    }

    setLoading(true)
    try {
      const sanitizedMessage = sanitizeText(messageContent.trim())
      const messagesToInsert = selectedEmployeeIds.map(employeeId => ({
        job_session_id: jobSession.id,
        employee_id: employeeId,
        message: sanitizedMessage
      }))

      const { error } = await supabase
        .from('schedule_messages')
        .insert(messagesToInsert)

      if (error) {
        console.error('Insert error details:', error)
        throw new Error(error.message || JSON.stringify(error))
      }

      toast.success(`Message sent to ${selectedEmployeeIds.length} employee(s)`)
      setIsPushingMessage(false)
      setMessageContent('')
      setSelectedEmployeeIds([])
      setSelectAll(false)
      onClose()
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const handleReassign = async () => {
    if (!reassignEmployeeId) {
      toast.error('Please select an employee')
      return
    }

    setLoading(true)
    try {
      const updateData: { assigned_to: string; status?: string } = {
        assigned_to: reassignEmployeeId,
      }
      // If currently OFFERED, move to APPROVED
      if (jobSession.status === 'OFFERED') {
        updateData.status = 'APPROVED'
      }

      const { error } = await supabase
        .from('job_sessions')
        .update(updateData)
        .eq('id', jobSession.id)

      if (error) throw error

      toast.success('Job reassigned successfully')
      setIsReassigning(false)
      setReassignEmployeeId('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error reassigning job:', error)
      toast.error('Failed to reassign job')
    } finally {
      setLoading(false)
    }
  }

  const handleRecoverReschedule = async () => {
    if (!newDate) {
      toast.error('Please select a new date')
      return
    }

    const selectedDate = new Date(newDate + 'T' + (newTime || '00:00'))
    if (selectedDate < new Date()) {
      toast.error('Cannot schedule a job in the past')
      return
    }

    setLoading(true)
    try {
      // Cancel the current MISSED/OVERDUE session
      const { error: cancelError } = await supabase
        .from('job_sessions')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', jobSession.id)

      if (cancelError) throw cancelError

      // Create a new OFFERED session with the next session code
      const nextNum = await getNextSessionNumber(supabase, jobSession.job_template_id)
      const sessionCode = `A${String(nextNum).padStart(3, '0')}`
      const fullJobCode = `${jobSession.job_template.job_code}-${sessionCode}`

      const { error: insertError } = await supabase
        .from('job_sessions')
        .insert({
          job_template_id: jobSession.job_template_id,
          session_code: sessionCode,
          full_job_code: fullJobCode,
          scheduled_date: newDate,
          scheduled_end_date: jobSession.scheduled_end_date,
          scheduled_time: newTime || jobSession.scheduled_time,
          status: 'OFFERED',
          assigned_to: null,
        })

      if (insertError) throw insertError

      toast.success('Session rescheduled as a new offering')
      setIsRecovering(false)
      setNewDate('')
      setNewTime('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error recovering session:', error)
      toast.error('Failed to reschedule session')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this session? This cannot be undone.')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .delete()
        .eq('id', jobSession.id)

      if (error) throw error

      toast.success('Session deleted')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error('Failed to delete session')
    } finally {
      setLoading(false)
    }
  }

  const handleRecoverCancel = async () => {
    if (!confirm('Are you sure you want to cancel this session? It will not be rescheduled.')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', jobSession.id)

      if (error) throw error

      toast.success('Session cancelled')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error cancelling session:', error)
      toast.error('Failed to cancel session')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setIsRescheduling(false)
    setIsModifyingPrice(false)
    setIsPushingMessage(false)
    setIsRefusing(false)
    setIsReassigning(false)
    setIsRecovering(false)
    setNewDate('')
    setNewTime('')
    setNewPrice('')
    setMessageContent('')
    setRefuseReason('')
    setReassignEmployeeId('')
    setSelectedEmployeeIds([])
    setSelectAll(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            {jobSession.job_template.title}
            {getStatusBadge(jobSession.status)}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {jobSession.full_job_code || jobSession.session_code}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job Details */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-lg text-white">Job Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-400">
                <span className="font-medium text-gray-300">Job Code:</span> {jobSession.job_template.job_code}
              </div>
              <div className="text-gray-400">
                <span className="font-medium text-gray-300">Client Code:</span> {jobSession.job_template.client_code}
              </div>
              {(jobSession.job_template as any).customer?.full_name && (
                <div className="col-span-2 text-gray-400">
                  <span className="font-medium text-gray-300">Customer:</span> {(jobSession.job_template as any).customer.full_name}
                </div>
              )}
            </div>

            {/* Scheduled Date & Time - always show from session data */}
            <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-400 font-medium">Scheduled Date</span>
                <span className="text-white font-medium">
                  {jobSession.scheduled_date
                    ? format(new Date(jobSession.scheduled_date + 'T12:00:00'), 'EEE, MMM d, yyyy')
                    : 'Not set'}
                </span>
              </div>
              {jobSession.scheduled_end_date && jobSession.scheduled_end_date !== jobSession.scheduled_date && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-400 font-medium">End Date</span>
                  <span className="text-white font-medium">
                    {format(new Date(jobSession.scheduled_end_date + 'T12:00:00'), 'EEE, MMM d, yyyy')}
                  </span>
                </div>
              )}
              {jobSession.scheduled_time && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-400 font-medium">Time</span>
                  <span className="text-white font-medium">{formatTime(jobSession.scheduled_time)}</span>
                </div>
              )}
              {(jobSession.job_template.time_window_start || jobSession.job_template.time_window_end) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-400 font-medium">Time Window</span>
                  <span className="text-white font-medium">
                    {jobSession.job_template.time_window_start && formatTime(jobSession.job_template.time_window_start)}
                    {jobSession.job_template.time_window_start && jobSession.job_template.time_window_end && ' — '}
                    {jobSession.job_template.time_window_end && formatTime(jobSession.job_template.time_window_end)}
                  </span>
                </div>
              )}
              {(jobSession.job_template.window_start_day || jobSession.job_template.window_end_day) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-400 font-medium">Day Window</span>
                  <span className="text-white font-medium">
                    {jobSession.job_template.window_start_day && (({'SUN':'Sun','MON':'Mon','TUE':'Tue','WED':'Wed','THU':'Thu','FRI':'Fri','SAT':'Sat'} as Record<string,string>)[jobSession.job_template.window_start_day] || jobSession.job_template.window_start_day)}
                    {jobSession.job_template.window_start_day && jobSession.job_template.window_end_day && ' — '}
                    {jobSession.job_template.window_end_day && (({'SUN':'Sun','MON':'Mon','TUE':'Tue','WED':'Wed','THU':'Thu','FRI':'Fri','SAT':'Sat'} as Record<string,string>)[jobSession.job_template.window_end_day] || jobSession.job_template.window_end_day)}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              {jobSession.job_template.duration_minutes && (
                <div className="text-gray-400">
                  <span className="font-medium text-gray-300">Duration:</span> {jobSession.job_template.duration_minutes} min
                </div>
              )}
              {(jobSession.price_override || jobSession.job_template.price_per_hour) && (
                <div className="text-gray-400">
                  <span className="font-medium text-gray-300">Rate:</span>{' '}
                  {jobSession.price_override ? (
                    <span className="text-green-400 font-medium">
                      ${jobSession.price_override}/hr (override)
                    </span>
                  ) : (
                    <span>${jobSession.job_template.price_per_hour}/hr</span>
                  )}
                </div>
              )}
            </div>
            {jobSession.job_template.address && (
              <div className="text-sm text-gray-400">
                <span className="font-medium text-gray-300">Address:</span> {jobSession.job_template.address}
              </div>
            )}
            {jobSession.job_template.description && (
              <div className="text-sm text-gray-400">
                <span className="font-medium text-gray-300">Description:</span> {jobSession.job_template.description}
              </div>
            )}
          </div>

          {/* Employee Details */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-lg text-white">Assigned Employee</h3>
            {jobSession.employee ? (
              <div className="text-sm space-y-1 text-gray-400">
                <div>
                  <span className="font-medium text-gray-300">Name:</span> {jobSession.employee.full_name}
                </div>
                <div>
                  <span className="font-medium text-gray-300">Email:</span> {jobSession.employee.email}
                </div>
                {jobSession.employee.phone && (
                  <div>
                    <span className="font-medium text-gray-300">Phone:</span> {jobSession.employee.phone}
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-300">Status:</span>{' '}
                  <Badge className="bg-white/10 text-gray-300 border border-white/20">{jobSession.employee.status}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No employee assigned yet</p>
            )}
          </div>

          {/* Session Timeline - compact horizontal */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-1 flex-wrap">
              {(() => {
                const statusOrder = ['OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'EVALUATED']
                const terminalStatuses = ['CANCELLED', 'REFUSED', 'MISSED', 'OVERDUE']
                const currentIdx = statusOrder.indexOf(jobSession.status)
                const isTerminal = terminalStatuses.includes(jobSession.status)

                const chips: { label: string; active: boolean; color: string; current?: boolean }[] = [
                  { label: 'Created', active: true, color: 'bg-gray-500/30 text-gray-300 border-gray-500/30' },
                ]

                if (jobSession.assigned_to && (currentIdx >= 1 || isTerminal)) {
                  chips.push({ label: 'Claimed', active: true, color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' })
                }
                if (currentIdx >= 2) {
                  chips.push({ label: 'Approved', active: true, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' })
                }
                if (currentIdx >= 3) {
                  chips.push({ label: 'Started', active: true, color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' })
                }
                if (currentIdx >= 4) {
                  chips.push({ label: 'Completed', active: true, color: 'bg-green-500/20 text-green-300 border-green-500/30' })
                }
                if (currentIdx >= 5) {
                  chips.push({ label: 'Evaluated', active: true, color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' })
                }
                if (isTerminal) {
                  chips.push({ label: jobSession.status, active: true, color: 'bg-red-500/20 text-red-300 border-red-500/30', current: true })
                }
                if (!isTerminal && currentIdx < 5) {
                  const currentLabels: Record<string, string> = {
                    OFFERED: 'Awaiting claim', CLAIMED: 'Pending approval', APPROVED: 'Ready',
                    IN_PROGRESS: 'In progress', COMPLETED: 'Awaiting eval',
                  }
                  chips.push({ label: currentLabels[jobSession.status] || jobSession.status, active: true, color: 'bg-white/10 text-white border-white/30', current: true })
                }

                return chips.map((chip, i) => (
                  <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${chip.color}`}>
                    {chip.current && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                    {chip.label}
                    {i < chips.length - 1 && <span className="text-gray-600 ml-1">&rarr;</span>}
                  </span>
                ))
              })()}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Created {format(new Date(jobSession.created_at), 'MMM d, yyyy')}
              {jobSession.started_at && ` · Started ${format(new Date(jobSession.started_at), 'MMM d h:mm a')}`}
              {jobSession.completed_at && ` · Completed ${format(new Date(jobSession.completed_at), 'MMM d h:mm a')}`}
            </p>
          </div>

          {/* Reschedule Section */}
          {isRescheduling && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-blue-300">Reschedule Job</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-date" className="text-gray-300">New Date</Label>
                  <Input
                    id="new-date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-time" className="text-gray-300">New Time</Label>
                  <Input
                    id="new-time"
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleReschedule} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? 'Saving...' : 'Confirm Reschedule'}
                </Button>
                <Button variant="outline" onClick={() => setIsRescheduling(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Modify Price Section */}
          {isModifyingPrice && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-green-300">Modify Price/Hour</h3>
              <p className="text-sm text-gray-400">
                Current rate: ${jobSession.price_override || jobSession.job_template.price_per_hour || 0}/hr
              </p>
              <div className="space-y-2">
                <Label htmlFor="new-price" className="text-gray-300">New Rate ($/hr)</Label>
                <Input
                  id="new-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 25.00"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleModifyPrice} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                  {loading ? 'Saving...' : 'Update Price'}
                </Button>
                <Button variant="outline" onClick={() => setIsModifyingPrice(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Refuse Claim Section */}
          {isRefusing && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-red-300">Refuse Claim</h3>
              <p className="text-sm text-gray-400">
                Please provide a reason for refusing this claim. The employee will see this message.
              </p>
              <div className="space-y-2">
                <Label htmlFor="refuse-reason" className="text-gray-300">Reason</Label>
                <Textarea
                  id="refuse-reason"
                  placeholder="e.g., Schedule conflict, position already filled, etc."
                  rows={3}
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                  className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleRefuse}
                  disabled={loading || !refuseReason.trim()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {loading ? 'Refusing...' : 'Confirm Refuse'}
                </Button>
                <Button variant="outline" onClick={() => setIsRefusing(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Reassign Section */}
          {isReassigning && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-blue-300">Reassign Job</h3>
              <p className="text-sm text-gray-400">
                Select a new employee for this session.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reassign-employee" className="text-gray-300">Employee</Label>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
                  {allEmployees.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">No active employees found</p>
                  ) : (
                    allEmployees.map(emp => {
                      const jobCount = employeeAvailability.get(emp.id) || 0
                      const isSelected = reassignEmployeeId === emp.id
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => setReassignEmployeeId(emp.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-600/30 border border-blue-500/50 text-white'
                              : 'hover:bg-white/10 text-gray-300'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              jobCount === 0 ? 'bg-green-400' : 'bg-orange-400'
                            }`}
                          />
                          <span className="flex-1">{emp.full_name}</span>
                          {jobCount > 0 && (
                            <span className="text-xs text-orange-300 bg-orange-500/20 px-1.5 py-0.5 rounded">
                              {jobCount} job{jobCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleReassign}
                  disabled={loading || !reassignEmployeeId}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? 'Reassigning...' : 'Confirm Reassign'}
                </Button>
                <Button variant="outline" onClick={() => setIsReassigning(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Recovery Reschedule Section (for MISSED/OVERDUE) */}
          {isRecovering && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-orange-300">Reschedule {jobSession.status} Session</h3>
              <p className="text-sm text-gray-400">
                This will cancel the current session and create a new OFFERED session with the selected date.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recover-date" className="text-gray-300">New Date</Label>
                  <Input
                    id="recover-date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recover-time" className="text-gray-300">New Time (optional)</Label>
                  <Input
                    id="recover-time"
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRecoverReschedule} disabled={loading || !newDate} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? 'Saving...' : 'Confirm Reschedule'}
                </Button>
                <Button variant="outline" onClick={() => { setIsRecovering(false); setNewDate(''); setNewTime('') }} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Push to Messages Section */}
          {isPushingMessage && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-purple-300">Notify Employees About This Job</h3>

              <div className="space-y-2">
                <Label className="text-gray-300">Select Employees to Notify</Label>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
                    <Checkbox
                      id="select-all"
                      checked={selectAll}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer text-gray-300">
                      Select All ({allEmployees.length} employees)
                    </label>
                  </div>

                  {allEmployees.length === 0 ? (
                    <p className="text-sm text-gray-500">No active employees found</p>
                  ) : (
                    allEmployees.map(emp => (
                      <div key={emp.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`emp-${emp.id}`}
                          checked={selectedEmployeeIds.includes(emp.id)}
                          onCheckedChange={() => handleToggleEmployee(emp.id)}
                        />
                        <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex-1 text-gray-300">
                          {emp.full_name}
                          {jobSession.assigned_to === emp.id && (
                            <Badge className="ml-2 text-xs bg-white/10 text-gray-400 border border-white/20">Assigned</Badge>
                          )}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {selectedEmployeeIds.length} employee(s) selected
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message-content" className="text-gray-300">Message</Label>
                <Textarea
                  id="message-content"
                  placeholder="e.g., This job is urgent and needs to be claimed today!"
                  rows={3}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handlePushMessage}
                  disabled={loading || selectedEmployeeIds.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {loading ? 'Sending...' : `Send to ${selectedEmployeeIds.length} Employee(s)`}
                </Button>
                <Button variant="outline" onClick={() => setIsPushingMessage(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with action buttons */}
        <DialogFooter className="!flex-col gap-2">
          {!isRescheduling && !isModifyingPrice && !isPushingMessage && !isRefusing && !isReassigning && !isRecovering && (
            <>
              {/* Primary actions */}
              {jobSession.status === 'CLAIMED' && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleApprove}
                    disabled={loading}
                  >
                    {loading ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button
                    onClick={() => setIsRefusing(true)}
                    disabled={loading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Refuse
                  </Button>
                </div>
              )}

              {canRecover && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsRecovering(true)}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Reschedule
                  </Button>
                  <Button
                    onClick={handleRecoverCancel}
                    disabled={loading}
                    className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                  >
                    Cancel Session
                  </Button>
                </div>
              )}

              {/* Management actions - 2x2 grid */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsRescheduling(true)}
                  disabled={loading || !canModify}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  Move Job
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsModifyingPrice(true)}
                  disabled={loading || !canModify}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  Modify Price
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsReassigning(true)}
                  disabled={loading || !canModify}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  Reassign
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsPushingMessage(true)}
                  disabled={loading}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  Notify
                </Button>
              </div>

              {/* Destructive actions */}
              <div className="flex gap-2 pt-1 border-t border-white/10">
                {canModify && jobSession.status !== 'CLAIMED' && (
                  <Button
                    size="sm"
                    onClick={handleCancel}
                    disabled={loading}
                    className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </Button>
                <Button
                  size="sm"
                  onClick={handleClose}
                  className="flex-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
