'use client'

/**
 * ScheduleJobPopup Component
 *
 * A modal dialog that displays job session details and provides actions for
 * managing scheduled jobs from the employer's calendar view.
 *
 * FEATURES:
 * - View job details: code, date, time, duration, rate, address, description
 * - View assigned employee info (if any)
 * - Cancel Job: Sets job status to CANCELLED
 * - Move Job (Reschedule): Change scheduled date and time
 * - Modify Price/Hour: Override the job template's price for this session
 * - Push to Messages: Send a notification/message to the assigned employee
 *
 * BUSINESS LOGIC:
 * - Cancel and Reschedule are disabled for CANCELLED and COMPLETED jobs
 * - Modify Price is disabled for CANCELLED and COMPLETED jobs
 * - Push to Messages requires an assigned employee
 */

import { useState, useEffect } from 'react'
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

// Extended job session with related data from joins
interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate
  employee: Employee | null
}

// Component props
interface ScheduleJobPopupProps {
  jobSession: JobSessionWithDetails | null
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

export function ScheduleJobPopup({ jobSession, open, onClose, onUpdate }: ScheduleJobPopupProps) {
  // UI state for different action modes
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [isModifyingPrice, setIsModifyingPrice] = useState(false)
  const [isPushingMessage, setIsPushingMessage] = useState(false)
  const [isRefusing, setIsRefusing] = useState(false)

  // Form state for reschedule action
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')

  // Form state for modify price action
  const [newPrice, setNewPrice] = useState('')

  // Form state for push to messages action
  const [messageContent, setMessageContent] = useState('')
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Form state for refuse action
  const [refuseReason, setRefuseReason] = useState('')

  // Loading state for async operations
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  // Load all active employees when opening push message panel
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
      // Pre-select assigned employee if any
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

  if (!jobSession) return null

  // Check if job can be modified (not cancelled or completed)
  const canModify = jobSession.status !== 'CANCELLED' && jobSession.status !== 'COMPLETED' && jobSession.status !== 'EVALUATED'

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

  /**
   * Handle approving a CLAIMED job - sets status to APPROVED
   */
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

      alert('Job approved successfully!')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error approving job:', error)
      alert('Failed to approve job')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle refusing a CLAIMED job - sets status to REFUSED and keeps employee assigned
   * so they can see the refusal reason
   */
  const handleRefuse = async () => {
    if (!refuseReason.trim()) {
      alert('Please provide a reason for refusing')
      return
    }

    setLoading(true)
    try {
      // Update job session to REFUSED (keep assigned_to so employee can see it)
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'REFUSED',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobSession.id)

      if (error) throw error

      // Send a message to the employee with the reason
      if (jobSession.assigned_to) {
        await supabase
          .from('schedule_messages')
          .insert({
            job_session_id: jobSession.id,
            employee_id: jobSession.assigned_to,
            message: `Your claim was refused: ${refuseReason.trim()}`
          })
      }

      alert('Claim refused.')
      setIsRefusing(false)
      setRefuseReason('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error refusing job:', error)
      alert('Failed to refuse job')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle rescheduling: Updates the job session's date and time
   */
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

  /**
   * Handle price modification: Sets a price override for this specific session
   * The price_override field takes precedence over the job template's price_per_hour
   */
  const handleModifyPrice = async () => {
    const priceValue = parseFloat(newPrice)
    if (isNaN(priceValue) || priceValue <= 0) {
      alert('Please enter a valid price')
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

      alert('Price updated successfully')
      setIsModifyingPrice(false)
      setNewPrice('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error modifying price:', error)
      alert('Failed to modify price')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle push to messages: Creates schedule_message records to notify
   * selected employees about this job with a custom note from the employer
   */
  const handlePushMessage = async () => {
    if (!messageContent.trim()) {
      alert('Please enter a message')
      return
    }

    if (selectedEmployeeIds.length === 0) {
      alert('Please select at least one employee')
      return
    }

    setLoading(true)
    try {
      // Create schedule_message records for each selected employee
      const messagesToInsert = selectedEmployeeIds.map(employeeId => ({
        job_session_id: jobSession.id,
        employee_id: employeeId,
        message: messageContent.trim()
      }))

      const { error } = await supabase
        .from('schedule_messages')
        .insert(messagesToInsert)

      if (error) {
        console.error('Insert error details:', error)
        throw new Error(error.message || JSON.stringify(error))
      }

      alert(`Message sent to ${selectedEmployeeIds.length} employee(s) successfully`)
      setIsPushingMessage(false)
      setMessageContent('')
      setSelectedEmployeeIds([])
      setSelectAll(false)
      onClose()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Reset all action modes when closing the popup
   */
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
              {(jobSession.job_template.time_window_start || jobSession.job_template.time_window_end) && jobSession.scheduled_date && (
                <div className="col-span-2">
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <span className="font-medium text-blue-700 block mb-2">Time Window</span>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Start:</span>
                        <span className="text-gray-700 font-medium">
                          {formatDate(jobSession.scheduled_date)}
                          {jobSession.job_template.time_window_start && ` at ${formatTime(jobSession.job_template.time_window_start)}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">End:</span>
                        <span className="text-gray-700 font-medium">
                          {formatDate(jobSession.scheduled_end_date || jobSession.scheduled_date)}
                          {jobSession.job_template.time_window_end && ` at ${formatTime(jobSession.job_template.time_window_end)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {jobSession.job_template.duration_minutes && (
                <div>
                  <span className="font-medium">Duration:</span> {jobSession.job_template.duration_minutes} min
                </div>
              )}
              {/* Show price - prefer override if set, otherwise template price */}
              {(jobSession.price_override || jobSession.job_template.price_per_hour) && (
                <div>
                  <span className="font-medium">Rate:</span>{' '}
                  {jobSession.price_override ? (
                    <span className="text-green-600 font-medium">
                      ${jobSession.price_override}/hr (override)
                    </span>
                  ) : (
                    <span>${jobSession.job_template.price_per_hour}/hr</span>
                  )}
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

          {/* Reschedule Section - allows changing job date and time */}
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

          {/* Modify Price Section - override the template's default price for this session */}
          {isModifyingPrice && (
            <div className="border rounded-lg p-4 space-y-4 bg-green-50">
              <h3 className="font-semibold text-lg">Modify Price/Hour</h3>
              <p className="text-sm text-gray-600">
                Current rate: ${jobSession.price_override || jobSession.job_template.price_per_hour || 0}/hr
              </p>
              <div className="space-y-2">
                <Label htmlFor="new-price">New Rate ($/hr)</Label>
                <Input
                  id="new-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 25.00"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleModifyPrice} disabled={loading}>
                  {loading ? 'Saving...' : 'Update Price'}
                </Button>
                <Button variant="outline" onClick={() => setIsModifyingPrice(false)} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Refuse Claim Section - refuse with a reason message */}
          {isRefusing && (
            <div className="border rounded-lg p-4 space-y-4 bg-red-50">
              <h3 className="font-semibold text-lg">Refuse Claim</h3>
              <p className="text-sm text-gray-600">
                Please provide a reason for refusing this claim. The employee will see this message.
              </p>
              <div className="space-y-2">
                <Label htmlFor="refuse-reason">Reason</Label>
                <Textarea
                  id="refuse-reason"
                  placeholder="e.g., Schedule conflict, position already filled, etc."
                  rows={3}
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleRefuse}
                  disabled={loading || !refuseReason.trim()}
                >
                  {loading ? 'Refusing...' : 'Confirm Refuse'}
                </Button>
                <Button variant="outline" onClick={() => setIsRefusing(false)} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Push to Messages Section - send a notification to selected employees */}
          {isPushingMessage && (
            <div className="border rounded-lg p-4 space-y-4 bg-purple-50">
              <h3 className="font-semibold text-lg">Notify Employees About This Job</h3>

              {/* Employee Selection */}
              <div className="space-y-2">
                <Label>Select Employees to Notify</Label>
                <div className="border rounded-lg p-3 bg-white max-h-40 overflow-y-auto space-y-2">
                  {/* Select All */}
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      id="select-all"
                      checked={selectAll}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Select All ({allEmployees.length} employees)
                    </label>
                  </div>

                  {/* Individual Employees */}
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
                        <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex-1">
                          {emp.full_name}
                          {jobSession.assigned_to === emp.id && (
                            <Badge variant="outline" className="ml-2 text-xs">Assigned</Badge>
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

              {/* Message Input */}
              <div className="space-y-2">
                <Label htmlFor="message-content">Message</Label>
                <Textarea
                  id="message-content"
                  placeholder="e.g., This job is urgent and needs to be claimed today!"
                  rows={3}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handlePushMessage}
                  disabled={loading || selectedEmployeeIds.length === 0}
                >
                  {loading ? 'Sending...' : `Send to ${selectedEmployeeIds.length} Employee(s)`}
                </Button>
                <Button variant="outline" onClick={() => setIsPushingMessage(false)} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with action buttons - hidden when any action panel is open */}
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {!isRescheduling && !isModifyingPrice && !isPushingMessage && !isRefusing && (
            <>
              {/* Approve/Refuse buttons - only shown for CLAIMED jobs */}
              {jobSession.status === 'CLAIMED' && (
                <>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleApprove}
                    disabled={loading}
                  >
                    {loading ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setIsRefusing(true)}
                    disabled={loading}
                  >
                    Refuse
                  </Button>
                </>
              )}

              {/* Move Job (Reschedule) - disabled for completed/cancelled jobs */}
              <Button
                variant="outline"
                onClick={() => setIsRescheduling(true)}
                disabled={loading || !canModify}
              >
                Move Job
              </Button>

              {/* Modify Price - disabled for completed/cancelled jobs */}
              <Button
                variant="outline"
                onClick={() => setIsModifyingPrice(true)}
                disabled={loading || !canModify}
              >
                Modify Price
              </Button>

              {/* Push to Messages - notify employees about this job */}
              <Button
                variant="outline"
                onClick={() => setIsPushingMessage(true)}
                disabled={loading}
              >
                Push to Messages
              </Button>

              {/* Cancel Job - disabled for completed/cancelled jobs, hidden for CLAIMED */}
              {jobSession.status !== 'CLAIMED' && (
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={loading || !canModify}
                >
                  {loading ? 'Cancelling...' : 'Cancel Job'}
                </Button>
              )}

              {/* Close button */}
              <Button variant="secondary" onClick={handleClose}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
