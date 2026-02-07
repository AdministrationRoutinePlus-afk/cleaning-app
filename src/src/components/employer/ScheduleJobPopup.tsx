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
import { formatDate, formatTime } from '@/lib/utils/dateFormatters'
import { sanitizeText } from '@/lib/utils/sanitize'
import { toast } from 'sonner'

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

  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [refuseReason, setRefuseReason] = useState('')
  const [loading, setLoading] = useState(false)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    if (isPushingMessage) {
      loadEmployees()
    }
  }, [isPushingMessage])

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
    }
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

  const handleClose = () => {
    setIsRescheduling(false)
    setIsModifyingPrice(false)
    setIsPushingMessage(false)
    setIsRefusing(false)
    setNewDate('')
    setNewTime('')
    setNewPrice('')
    setMessageContent('')
    setRefuseReason('')
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
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-lg text-white">Job Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="text-gray-400">
                <span className="font-medium text-gray-300">Job Code:</span> {jobSession.job_template.job_code}
              </div>
              <div className="text-gray-400">
                <span className="font-medium text-gray-300">Client Code:</span> {jobSession.job_template.client_code}
              </div>
              {(jobSession.job_template.time_window_start || jobSession.job_template.time_window_end) && jobSession.scheduled_date && (
                <div className="col-span-2">
                  <div className="bg-blue-500/10 p-3 rounded border border-blue-500/20">
                    <span className="font-medium text-blue-400 block mb-2">Time Window</span>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Start:</span>
                        <span className="text-gray-300 font-medium">
                          {formatDate(jobSession.scheduled_date)}
                          {jobSession.job_template.time_window_start && ` at ${formatTime(jobSession.job_template.time_window_start)}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">End:</span>
                        <span className="text-gray-300 font-medium">
                          {formatDate(jobSession.scheduled_end_date || jobSession.scheduled_date)}
                          {jobSession.job_template.time_window_end && ` at ${formatTime(jobSession.job_template.time_window_end)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
              <div className="pt-2 text-gray-400">
                <span className="font-medium text-gray-300">Address:</span>
                <p>{jobSession.job_template.address}</p>
              </div>
            )}
            {jobSession.job_template.description && (
              <div className="pt-2 text-gray-400">
                <span className="font-medium text-gray-300">Description:</span>
                <p>{jobSession.job_template.description}</p>
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
                <Button variant="outline" onClick={() => setIsRescheduling(false)} disabled={loading} className="border-white/20 text-gray-300 hover:bg-white/10">
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
                <Button variant="outline" onClick={() => setIsModifyingPrice(false)} disabled={loading} className="border-white/20 text-gray-300 hover:bg-white/10">
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
                <Button variant="outline" onClick={() => setIsRefusing(false)} disabled={loading} className="border-white/20 text-gray-300 hover:bg-white/10">
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
                <Button variant="outline" onClick={() => setIsPushingMessage(false)} disabled={loading} className="border-white/20 text-gray-300 hover:bg-white/10">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with action buttons */}
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {!isRescheduling && !isModifyingPrice && !isPushingMessage && !isRefusing && (
            <>
              {jobSession.status === 'CLAIMED' && (
                <>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleApprove}
                    disabled={loading}
                  >
                    {loading ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button
                    onClick={() => setIsRefusing(true)}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Refuse
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                onClick={() => setIsRescheduling(true)}
                disabled={loading || !canModify}
                className="border-white/20 text-gray-300 hover:bg-white/10"
              >
                Move Job
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsModifyingPrice(true)}
                disabled={loading || !canModify}
                className="border-white/20 text-gray-300 hover:bg-white/10"
              >
                Modify Price
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsPushingMessage(true)}
                disabled={loading}
                className="border-white/20 text-gray-300 hover:bg-white/10"
              >
                Push to Messages
              </Button>

              {jobSession.status !== 'CLAIMED' && (
                <Button
                  onClick={handleCancel}
                  disabled={loading || !canModify}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {loading ? 'Cancelling...' : 'Cancel Job'}
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleClose}
                className="border-white/20 text-gray-300 hover:bg-white/10"
              >
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
