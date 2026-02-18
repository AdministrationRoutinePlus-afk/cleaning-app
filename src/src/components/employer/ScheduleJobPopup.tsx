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
import { AlertTriangle, CheckCircle, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getNextSessionNumber } from '@/lib/jobs/sessionGenerator'
import { formatDate, formatTime } from '@/lib/utils/dateFormatters'
import { sanitizeText } from '@/lib/utils/sanitize'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useDateFormat } from '@/lib/i18n/useDateFormat'

interface JobSessionWithDetails extends JobSession {
  job_template: JobTemplate & { customer?: { full_name: string } | null }
  employee: Employee | null
}

interface ScheduleJobPopupProps {
  jobSession: JobSessionWithDetails | null
  open: boolean
  onClose: () => void
  onUpdate: () => void
}

function ReviewStatusBadge({ sessionId, status }: { sessionId: string; status: string }) {
  const { t } = useTranslation()
  const [reviewToken, setReviewToken] = useState<{ used_at: string | null } | null>(null)
  const [evaluation, setEvaluation] = useState<{ rating: number; comment: string | null } | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const load = async () => {
      const supabase = supabaseRef.current
      // Check for review token
      const { data: token } = await supabase
        .from('review_tokens')
        .select('used_at')
        .eq('job_session_id', sessionId)
        .maybeSingle()
      setReviewToken(token)

      // If EVALUATED, fetch the rating
      if (status === 'EVALUATED') {
        const { data: eval_ } = await supabase
          .from('evaluations')
          .select('rating, comment')
          .eq('job_session_id', sessionId)
          .maybeSingle()
        setEvaluation(eval_)
      }
    }
    load()
  }, [sessionId, status])

  if (status === 'EVALUATED' && evaluation) {
    const stars = '★'.repeat(evaluation.rating) + '☆'.repeat(5 - evaluation.rating)
    return (
      <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-teal-400 font-medium">{t('Customer Review')}</span>
          <span className="text-yellow-400 text-lg tracking-wide">{stars}</span>
          <span className="text-gray-400 text-xs">({evaluation.rating}/5)</span>
        </div>
        {evaluation.comment && (
          <p className="text-gray-300 text-sm mt-1 italic">&ldquo;{evaluation.comment}&rdquo;</p>
        )}
      </div>
    )
  }

  if (status === 'COMPLETED' && reviewToken) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm">
          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {t('Review Requested')}
          </Badge>
          <span className="text-gray-400 text-xs">{t('Waiting for customer response')}</span>
        </div>
      </div>
    )
  }

  return null
}

export function ScheduleJobPopup({ jobSession, open, onClose, onUpdate }: ScheduleJobPopupProps) {
  const { t } = useTranslation()
  const { formatDate: formatDateLocale } = useDateFormat()
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [isModifyingPrice, setIsModifyingPrice] = useState(false)
  const [isPushingMessage, setIsPushingMessage] = useState(false)
  const [isRefusing, setIsRefusing] = useState(false)
  const [isReassigning, setIsReassigning] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)

  const [newDate, setNewDate] = useState('')
  const [newDateEnd, setNewDateEnd] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newTimeEnd, setNewTimeEnd] = useState('')
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

  const [splitPartnerName, setSplitPartnerName] = useState<string | null>(null)
  const [splitPartnerMinutes, setSplitPartnerMinutes] = useState<number | null>(null)
  const [trainingStatus, setTrainingStatus] = useState<{ is_trained: boolean; can_coach: boolean } | null>(null)
  const [isAssigningCoach, setIsAssigningCoach] = useState(false)
  const [coachCandidates, setCoachCandidates] = useState<(Employee & { can_coach: boolean })[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState('')

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Load split partner details when session has split_with
  useEffect(() => {
    if (!jobSession?.split_with) {
      setSplitPartnerName(null)
      setSplitPartnerMinutes(null)
      return
    }

    const loadSplitDetails = async () => {
      // Get partner name
      const { data: partner } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', jobSession.split_with!)
        .single()

      if (partner) setSplitPartnerName(partner.full_name)

      // Get partner_minutes from the split record
      const { data: splitData } = await supabase
        .from('job_splits')
        .select('partner_minutes')
        .eq('job_session_id', jobSession.id)
        .eq('status', 'APPROVED')
        .maybeSingle()

      if (splitData) setSplitPartnerMinutes(splitData.partner_minutes)
    }

    loadSplitDetails()
  }, [jobSession?.id, jobSession?.split_with])

  // Load training status for the assigned employee + job template
  useEffect(() => {
    if (!jobSession?.assigned_to || !jobSession?.job_template_id) {
      setTrainingStatus(null)
      return
    }

    const loadTraining = async () => {
      const { data } = await supabase
        .from('employee_job_training')
        .select('is_trained, can_coach')
        .eq('employee_id', jobSession.assigned_to!)
        .eq('job_template_id', jobSession.job_template_id)
        .maybeSingle()

      setTrainingStatus(data ? { is_trained: data.is_trained, can_coach: data.can_coach } : { is_trained: false, can_coach: false })
    }

    loadTraining()
  }, [jobSession?.id, jobSession?.assigned_to, jobSession?.job_template_id])

  useEffect(() => {
    if (isPushingMessage || isReassigning) {
      loadEmployees()
    }
  }, [isPushingMessage, isReassigning])

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, email, phone, status')
      .eq('status', 'ACTIVE')
      .order('full_name')

    if (!error && data) {
      const employees = data as Employee[]
      setAllEmployees(employees)
      if (jobSession?.assigned_to) {
        setSelectedEmployeeIds([jobSession.assigned_to])
      }
      // Load availability for the session date
      if (jobSession?.scheduled_date) {
        loadEmployeeAvailability(employees, jobSession.scheduled_date)
      }
    }
  }

  const loadEmployeeAvailability = async (employees: { id: string }[], date: string) => {
    const { data: sessionsOnDate } = await supabase
      .from('job_sessions')
      .select('assigned_to')
      .or(`scheduled_date.eq.${date},and(scheduled_date.lte.${date},scheduled_end_date.gte.${date})`)
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
    if (!confirm(t('Are you sure you want to cancel this job session?'))) return

    setLoading(true)
    try {
      // Auto-cancel any pending splits
      await supabase
        .from('job_splits')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('job_session_id', jobSession.id)
        .in('status', ['PENDING_PARTNER', 'PENDING_EMPLOYER'])

      const { error } = await supabase
        .from('job_sessions')
        .update({ status: 'CANCELLED' })
        .eq('id', jobSession.id)

      if (error) throw error
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error cancelling job session:', error)
      toast.error(t('Failed to cancel job session'))
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
      toast.error(t('Failed to approve job'))
    } finally {
      setLoading(false)
    }
  }

  const handleRefuse = async () => {
    if (!refuseReason.trim()) {
      toast.error(t('Please provide a reason for refusing'))
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

      // Auto-cancel any pending splits for this session
      await supabase
        .from('job_splits')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('job_session_id', jobSession.id)
        .in('status', ['PENDING_PARTNER', 'PENDING_EMPLOYER'])

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
      toast.error(t('Failed to refuse job'))
    } finally {
      setLoading(false)
    }
  }

  const handleReschedule = async () => {
    if (!newDate || !newDateEnd) {
      toast.error(t('Please select start and end dates'))
      return
    }
    if (!newTime || !newTimeEnd) {
      toast.error(t('Please set the time window'))
      return
    }
    if (newDateEnd < newDate) {
      toast.error(t('End date cannot be before start date'))
      return
    }

    // Validate date is not in the past
    const selectedDate = new Date(newDate + 'T' + newTime)
    if (selectedDate < new Date()) {
      toast.error(t('Cannot schedule a job in the past'))
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          scheduled_date: newDate,
          scheduled_end_date: newDateEnd !== newDate ? newDateEnd : null,
          scheduled_time: newTime
        })
        .eq('id', jobSession.id)

      if (error) throw error

      setIsRescheduling(false)
      setNewDate('')
      setNewDateEnd('')
      setNewTime('')
      setNewTimeEnd('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error rescheduling job session:', error)
      toast.error(t('Failed to reschedule job session'))
    } finally {
      setLoading(false)
    }
  }

  const handleModifyPrice = async () => {
    const priceValue = parseFloat(newPrice)
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error(t('Please enter a valid price'))
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
      toast.error(t('Failed to modify price'))
    } finally {
      setLoading(false)
    }
  }

  const handlePushMessage = async () => {
    if (!messageContent.trim()) {
      toast.error(t('Please enter a message'))
      return
    }

    if (selectedEmployeeIds.length === 0) {
      toast.error(t('Please select at least one employee'))
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

      toast.success(`${t('Message sent to')} ${selectedEmployeeIds.length} ${t('employee(s)')}`)
      setIsPushingMessage(false)
      setMessageContent('')
      setSelectedEmployeeIds([])
      setSelectAll(false)
      onClose()
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error(t('Failed to send message'))
    } finally {
      setLoading(false)
    }
  }

  const handleReassign = async () => {
    if (!reassignEmployeeId) {
      toast.error(t('Please select an employee'))
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

      toast.success(t('Job reassigned successfully'))
      setIsReassigning(false)
      setReassignEmployeeId('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error reassigning job:', error)
      toast.error(t('Failed to reassign job'))
    } finally {
      setLoading(false)
    }
  }

  const handleRecoverReschedule = async () => {
    if (!newDate || !newDateEnd) {
      toast.error(t('Please select start and end dates'))
      return
    }
    if (!newTime || !newTimeEnd) {
      toast.error(t('Please set the time window'))
      return
    }
    if (newDateEnd < newDate) {
      toast.error(t('End date cannot be before start date'))
      return
    }

    const selectedDate = new Date(newDate + 'T' + newTime)
    if (selectedDate < new Date()) {
      toast.error(t('Cannot schedule a job in the past'))
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
          scheduled_end_date: newDateEnd !== newDate ? newDateEnd : null,
          scheduled_time: newTime,
          status: 'OFFERED',
          assigned_to: null,
        })

      if (insertError) throw insertError

      toast.success(t('Session rescheduled as a new offering'))
      setIsRecovering(false)
      setNewDate('')
      setNewDateEnd('')
      setNewTime('')
      setNewTimeEnd('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error recovering session:', error)
      toast.error(t('Failed to reschedule session'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t('Are you sure you want to permanently delete this session? This cannot be undone.'))) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .delete()
        .eq('id', jobSession.id)

      if (error) throw error

      toast.success(t('Session deleted'))
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error deleting session:', error)
      toast.error(t('Failed to delete session'))
    } finally {
      setLoading(false)
    }
  }

  const handleRecoverCancel = async () => {
    if (!confirm(t('Are you sure you want to cancel this session? It will not be rescheduled.'))) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', jobSession.id)

      if (error) throw error

      toast.success(t('Session cancelled'))
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error cancelling session:', error)
      toast.error(t('Failed to cancel session'))
    } finally {
      setLoading(false)
    }
  }

  const loadCoachCandidates = async () => {
    if (!jobSession?.job_template_id) return

    // Find employees who can coach this job template
    const { data: trainings } = await supabase
      .from('employee_job_training')
      .select('employee_id')
      .eq('job_template_id', jobSession.job_template_id)
      .eq('can_coach', true)

    if (!trainings || trainings.length === 0) {
      setCoachCandidates([])
      return
    }

    const coachIds = trainings.map(t => t.employee_id)

    // Get employee details for coaches (only ACTIVE, exclude the assigned employee)
    const { data: employees } = await supabase
      .from('employees')
      .select('id, full_name, email, phone, status')
      .in('id', coachIds)
      .eq('status', 'ACTIVE')
      .order('full_name')

    if (employees) {
      const filtered = employees.filter(e => e.id !== jobSession.assigned_to) as (Employee & { can_coach: boolean })[]
      setCoachCandidates(filtered)
    }
  }

  const handleAssignCoach = async () => {
    if (!selectedCoachId) {
      toast.error(t('Please select a coach'))
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          split_with: selectedCoachId,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobSession.id)

      if (error) throw error

      toast.success(t('Coach assigned successfully'))
      setIsAssigningCoach(false)
      setSelectedCoachId('')
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error assigning coach:', error)
      toast.error(t('Failed to assign coach'))
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
    setIsAssigningCoach(false)
    setNewDate('')
    setNewTime('')
    setNewPrice('')
    setMessageContent('')
    setRefuseReason('')
    setReassignEmployeeId('')
    setSelectedCoachId('')
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
            <h3 className="font-semibold text-lg text-white">{t('Job Details')}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-400">
                <span className="font-medium text-gray-300">{t('Job Code:')}</span> {jobSession.job_template.job_code}
              </div>
              <div className="text-gray-400">
                <span className="font-medium text-gray-300">{t('Client Code:')}</span> {jobSession.job_template.client_code}
              </div>
              {jobSession.job_template.customer?.full_name && (
                <div className="col-span-2 text-gray-400">
                  <span className="font-medium text-gray-300">{t('Customer:')}</span> {jobSession.job_template.customer.full_name}
                </div>
              )}
            </div>

            {/* Scheduled Date & Time - always show from session data */}
            <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-400 font-medium">{t('Scheduled Date')}</span>
                <span className="text-white font-medium">
                  {jobSession.scheduled_date
                    ? formatDateLocale(new Date(jobSession.scheduled_date + 'T12:00:00'), 'EEE, MMM d, yyyy')
                    : t('Not set')}
                </span>
              </div>
              {jobSession.scheduled_end_date && jobSession.scheduled_end_date !== jobSession.scheduled_date && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-400 font-medium">{t('End Date')}</span>
                  <span className="text-white font-medium">
                    {formatDateLocale(new Date(jobSession.scheduled_end_date + 'T12:00:00'), 'EEE, MMM d, yyyy')}
                  </span>
                </div>
              )}
              {(jobSession.job_template.time_window_start || jobSession.job_template.time_window_end) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-400 font-medium">{t('Time Window')}</span>
                  <span className="text-white font-medium">
                    {(() => {
                      const dayMap: Record<string,string> = {'SUN':'Sunday','MON':'Monday','TUE':'Tuesday','WED':'Wednesday','THU':'Thursday','FRI':'Friday','SAT':'Saturday'}
                      const startDay = jobSession.job_template.window_start_day ? t(dayMap[jobSession.job_template.window_start_day] || '') : ''
                      const endDay = jobSession.job_template.window_end_day ? t(dayMap[jobSession.job_template.window_end_day] || '') : ''
                      const startTime = jobSession.job_template.time_window_start ? formatTime(jobSession.job_template.time_window_start) : ''
                      const endTime = jobSession.job_template.time_window_end ? formatTime(jobSession.job_template.time_window_end) : ''
                      return `${startDay} ${startTime} — ${endDay} ${endTime}`.trim()
                    })()}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              {jobSession.job_template.duration_minutes && (
                <div className="text-gray-400">
                  <span className="font-medium text-gray-300">{t('Duration:')}</span> {jobSession.job_template.duration_minutes} {t('min')}
                </div>
              )}
              {(jobSession.price_override || jobSession.job_template.price_per_hour) && (
                <div className="text-gray-400">
                  <span className="font-medium text-gray-300">{t('Rate:')}</span>{' '}
                  {jobSession.price_override ? (
                    <span className="text-green-400 font-medium">
                      ${jobSession.price_override}/{t('hr')} ({t('override')})
                    </span>
                  ) : (
                    <span>${jobSession.job_template.price_per_hour}/{t('hr')}</span>
                  )}
                </div>
              )}
            </div>
            {jobSession.job_template.address && (
              <div className="text-sm text-gray-400">
                <span className="font-medium text-gray-300">{t('Address:')}</span> {jobSession.job_template.address}
              </div>
            )}
            {jobSession.job_template.description && (
              <div className="text-sm text-gray-400">
                <span className="font-medium text-gray-300">{t('Description:')}</span> {jobSession.job_template.description}
              </div>
            )}
          </div>

          {/* Employee Details */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-lg text-white">{t('Assigned Employee')}</h3>
            {jobSession.employee ? (
              <div className="text-sm space-y-1 text-gray-400">
                <div>
                  <span className="font-medium text-gray-300">{t('Name:')}</span> {jobSession.employee.full_name}
                </div>
                <div>
                  <span className="font-medium text-gray-300">{t('Email:')}</span> {jobSession.employee.email}
                </div>
                {jobSession.employee.phone && (
                  <div>
                    <span className="font-medium text-gray-300">{t('Phone:')}</span> {jobSession.employee.phone}
                  </div>
                )}
                <div>
                  <span className="font-medium text-gray-300">{t('Status:')}</span>{' '}
                  <Badge className="bg-white/10 text-gray-300 border border-white/20">{jobSession.employee.status}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">{t('No employee assigned yet')}</p>
            )}
            {/* Training status warning + assign coach */}
            {jobSession.employee && trainingStatus && !trainingStatus.is_trained && (
              <div className="space-y-2">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <span className="text-sm text-amber-300 font-medium">{t('This employee is not trained for this job')}</span>
                </div>
                {!jobSession.split_with && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsAssigningCoach(true)
                      loadCoachCandidates()
                    }}
                    className="w-full bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30"
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    {t('Assign a Coach')}
                  </Button>
                )}
              </div>
            )}
            {jobSession.employee && trainingStatus && trainingStatus.is_trained && (
              <div className="flex items-center gap-2">
                {trainingStatus.can_coach ? (
                  <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    {t('Coach')}
                  </Badge>
                ) : (
                  <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {t('Trained')}
                  </Badge>
                )}
              </div>
            )}
            {/* Split partner info */}
            {jobSession.split_with && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-2 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">{t('Split Job')}</Badge>
                    <span className="text-purple-200 font-medium">
                      {splitPartnerName
                        ? `${t('Split with')}: ${splitPartnerName}`
                        : t('Split partner assigned')}
                    </span>
                  </div>
                  {splitPartnerMinutes && (
                    <p className="text-xs text-gray-400 ml-1">
                      {t('Partner time')}: {Math.floor(splitPartnerMinutes / 60)}h{splitPartnerMinutes % 60 > 0 ? `${splitPartnerMinutes % 60}m` : ''}
                      {jobSession.job_template.duration_minutes && (
                        <span className="text-gray-500"> / {Math.floor(jobSession.job_template.duration_minutes / 60)}h{jobSession.job_template.duration_minutes % 60 > 0 ? `${jobSession.job_template.duration_minutes % 60}m` : ''} {t('total')}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
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
                  { label: t('Created'), active: true, color: 'bg-gray-500/30 text-gray-300 border-gray-500/30' },
                ]

                if (jobSession.assigned_to && (currentIdx >= 1 || isTerminal)) {
                  chips.push({ label: t('Claimed'), active: true, color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' })
                }
                if (currentIdx >= 2) {
                  chips.push({ label: t('Approved'), active: true, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' })
                }
                if (currentIdx >= 3) {
                  chips.push({ label: t('Started'), active: true, color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' })
                }
                if (currentIdx >= 4) {
                  chips.push({ label: t('Completed'), active: true, color: 'bg-green-500/20 text-green-300 border-green-500/30' })
                }
                if (currentIdx >= 5) {
                  chips.push({ label: t('Evaluated'), active: true, color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' })
                }
                if (isTerminal) {
                  chips.push({ label: jobSession.status, active: true, color: 'bg-red-500/20 text-red-300 border-red-500/30', current: true })
                }
                if (!isTerminal && currentIdx < 5) {
                  const currentLabels: Record<string, string> = {
                    OFFERED: t('Awaiting claim'), CLAIMED: t('Pending approval'), APPROVED: t('Ready'),
                    IN_PROGRESS: t('In progress'), COMPLETED: t('Awaiting eval'),
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
              {t('Created')} {formatDateLocale(new Date(jobSession.created_at), 'MMM d, yyyy')}
              {jobSession.started_at && ` · ${t('Started')} ${formatDateLocale(new Date(jobSession.started_at), 'MMM d h:mm a')}`}
              {jobSession.completed_at && ` · ${t('Completed')} ${formatDateLocale(new Date(jobSession.completed_at), 'MMM d h:mm a')}`}
            </p>
          </div>

          {/* Review Status for COMPLETED/EVALUATED */}
          {(jobSession.status === 'COMPLETED' || jobSession.status === 'EVALUATED') && (
            <ReviewStatusBadge sessionId={jobSession.id} status={jobSession.status} />
          )}

          {/* Reschedule Section */}
          {isRescheduling && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-blue-300">{t('Reschedule Job')}</h3>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('Start')} *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => {
                      setNewDate(e.target.value)
                      if (!newDateEnd || e.target.value > newDateEnd) {
                        setNewDateEnd(e.target.value)
                      }
                    }}
                    className="bg-white/5 border-white/20 text-white flex-1"
                  />
                  <Input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-white/5 border-white/20 text-white w-32"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('End')} *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={newDateEnd}
                    onChange={(e) => setNewDateEnd(e.target.value)}
                    min={newDate}
                    className="bg-white/5 border-white/20 text-white flex-1"
                  />
                  <Input
                    type="time"
                    value={newTimeEnd}
                    onChange={(e) => setNewTimeEnd(e.target.value)}
                    className="bg-white/5 border-white/20 text-white w-32"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleReschedule} disabled={loading || !newDate || !newDateEnd || !newTime || !newTimeEnd} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? t('Saving...') : t('Confirm Reschedule')}
                </Button>
                <Button variant="outline" onClick={() => setIsRescheduling(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* Modify Price Section */}
          {isModifyingPrice && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-green-300">{t('Modify Price/Hour')}</h3>
              <p className="text-sm text-gray-400">
                {t('Current rate:')} ${jobSession.price_override || jobSession.job_template.price_per_hour || 0}/{t('hr')}
              </p>
              <div className="space-y-2">
                <Label htmlFor="new-price" className="text-gray-300">{t('New Rate ($/hr)')}</Label>
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
                  {loading ? t('Saving...') : t('Update Price')}
                </Button>
                <Button variant="outline" onClick={() => setIsModifyingPrice(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* Refuse Claim Section */}
          {isRefusing && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-red-300">{t('Refuse Claim')}</h3>
              <p className="text-sm text-gray-400">
                {t('Please provide a reason for refusing this claim. The employee will see this message.')}
              </p>
              <div className="space-y-2">
                <Label htmlFor="refuse-reason" className="text-gray-300">{t('Reason')}</Label>
                <Textarea
                  id="refuse-reason"
                  placeholder={t('e.g., Schedule conflict, position already filled, etc.')}
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
                  {loading ? t('Refusing...') : t('Confirm Refuse')}
                </Button>
                <Button variant="outline" onClick={() => setIsRefusing(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* Reassign Section */}
          {isReassigning && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-blue-300">{t('Reassign Job')}</h3>
              <p className="text-sm text-gray-400">
                {t('Select a new employee for this session.')}
              </p>
              <div className="space-y-2">
                <Label htmlFor="reassign-employee" className="text-gray-300">{t('Employee')}</Label>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
                  {allEmployees.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">{t('No active employees found')}</p>
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
                  {loading ? t('Reassigning...') : t('Confirm Reassign')}
                </Button>
                <Button variant="outline" onClick={() => setIsReassigning(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* Recovery Reschedule Section (for MISSED/OVERDUE) */}
          {isRecovering && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-orange-300">{t('Reschedule')} {jobSession.status} {t('Session')}</h3>
              <p className="text-sm text-gray-400">
                {t('This will cancel the current session and create a new OFFERED session with the selected date.')}
              </p>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('Start')} *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => {
                      setNewDate(e.target.value)
                      if (!newDateEnd || e.target.value > newDateEnd) {
                        setNewDateEnd(e.target.value)
                      }
                    }}
                    className="bg-white/5 border-white/20 text-white flex-1"
                  />
                  <Input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-white/5 border-white/20 text-white w-32"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('End')} *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={newDateEnd}
                    onChange={(e) => setNewDateEnd(e.target.value)}
                    min={newDate}
                    className="bg-white/5 border-white/20 text-white flex-1"
                  />
                  <Input
                    type="time"
                    value={newTimeEnd}
                    onChange={(e) => setNewTimeEnd(e.target.value)}
                    className="bg-white/5 border-white/20 text-white w-32"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRecoverReschedule} disabled={loading || !newDate || !newDateEnd || !newTime || !newTimeEnd} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? t('Saving...') : t('Confirm Reschedule')}
                </Button>
                <Button variant="outline" onClick={() => { setIsRecovering(false); setNewDate(''); setNewDateEnd(''); setNewTime(''); setNewTimeEnd('') }} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* Assign Coach Section */}
          {isAssigningCoach && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-purple-300">{t('Assign a Coach')}</h3>
              <p className="text-sm text-gray-400">
                {t('Select a coach (formateur) to accompany this employee on the job.')}
              </p>
              <div className="space-y-2">
                <Label className="text-gray-300">{t('Available Coaches')}</Label>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
                  {coachCandidates.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">{t('No coaches available for this job')}</p>
                  ) : (
                    coachCandidates.map(coach => {
                      const isSelected = selectedCoachId === coach.id
                      return (
                        <button
                          key={coach.id}
                          type="button"
                          onClick={() => setSelectedCoachId(coach.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                            isSelected
                              ? 'bg-purple-600/30 border border-purple-500/50 text-white'
                              : 'hover:bg-white/10 text-gray-300'
                          }`}
                        >
                          <GraduationCap className={`w-4 h-4 shrink-0 ${isSelected ? 'text-purple-300' : 'text-purple-500'}`} />
                          <span className="flex-1">{coach.full_name}</span>
                          <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
                            {t('Coach')}
                          </Badge>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAssignCoach}
                  disabled={loading || !selectedCoachId}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {loading ? t('Assigning...') : t('Confirm Coach')}
                </Button>
                <Button variant="outline" onClick={() => { setIsAssigningCoach(false); setSelectedCoachId('') }} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* Push to Messages Section */}
          {isPushingMessage && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-lg text-purple-300">{t('Notify Employees About This Job')}</h3>

              <div className="space-y-2">
                <Label className="text-gray-300">{t('Select Employees to Notify')}</Label>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
                    <Checkbox
                      id="select-all"
                      checked={selectAll}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer text-gray-300">
                      {t('Select All')} ({allEmployees.length} {t('employees')})
                    </label>
                  </div>

                  {allEmployees.length === 0 ? (
                    <p className="text-sm text-gray-500">{t('No active employees found')}</p>
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
                            <Badge className="ml-2 text-xs bg-white/10 text-gray-400 border border-white/20">{t('Assigned')}</Badge>
                          )}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {selectedEmployeeIds.length} {t('employee(s) selected')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message-content" className="text-gray-300">{t('Message')}</Label>
                <Textarea
                  id="message-content"
                  placeholder={t('e.g., This job is urgent and needs to be claimed today!')}
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
                  {loading ? t('Sending...') : `${t('Send to')} ${selectedEmployeeIds.length} ${t('Employee(s)')}`}
                </Button>
                <Button variant="outline" onClick={() => setIsPushingMessage(false)} disabled={loading} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  {t('Cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with action buttons */}
        <DialogFooter className="!flex-col gap-2">
          {!isRescheduling && !isModifyingPrice && !isPushingMessage && !isRefusing && !isReassigning && !isRecovering && !isAssigningCoach && (
            <>
              {/* Primary actions */}
              {jobSession.status === 'CLAIMED' && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleApprove}
                    disabled={loading}
                  >
                    {loading ? t('Approving...') : t('Approve')}
                  </Button>
                  <Button
                    onClick={() => setIsRefusing(true)}
                    disabled={loading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {t('Refuse')}
                  </Button>
                </div>
              )}

              {canRecover && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setNewDate('')
                      setNewDateEnd('')
                      setNewTime(jobSession.job_template.time_window_start || '')
                      setNewTimeEnd(jobSession.job_template.time_window_end || '')
                      setIsRecovering(true)
                    }}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {t('Reschedule')}
                  </Button>
                  <Button
                    onClick={handleRecoverCancel}
                    disabled={loading}
                    className="flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                  >
                    {t('Cancel Session')}
                  </Button>
                </div>
              )}

              {/* Management actions - 2x2 grid */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setNewDate(jobSession.scheduled_date || '')
                    setNewDateEnd(jobSession.scheduled_end_date || jobSession.scheduled_date || '')
                    setNewTime(jobSession.job_template.time_window_start || '')
                    setNewTimeEnd(jobSession.job_template.time_window_end || '')
                    setIsRescheduling(true)
                  }}
                  disabled={loading || !canModify}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  {t('Move Job')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsModifyingPrice(true)}
                  disabled={loading || !canModify}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  {t('Modify Price')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsReassigning(true)}
                  disabled={loading || !canModify}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  {t('Reassign')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsPushingMessage(true)}
                  disabled={loading}
                  className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  {t('Notify')}
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
                    {t('Cancel')}
                  </Button>
                )}
                {jobSession.status !== 'COMPLETED' && jobSession.status !== 'EVALUATED' && (
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {t('Delete')}
                </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleClose}
                  className="flex-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
                >
                  {t('Close')}
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
