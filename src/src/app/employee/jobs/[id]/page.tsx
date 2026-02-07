'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type {
  JobSession,
  JobTemplate,
  JobStep,
  JobStepImage,
  JobStepChecklist,
  JobSessionProgress,
  JobSessionChecklistProgress,
  Customer
} from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { StepCard } from '@/components/employee/StepCard'
import { ProgressBar } from '@/components/employee/ProgressBar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  List,
  ClipboardList,
  Check,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  XCircle,
  Play,
  Timer,
  Package,
  StickyNote
} from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import LoadingSpinner from '@/components/LoadingSpinner'
import { toast } from 'sonner'

interface ScheduleMessage {
  id: string
  message: string
  created_at: string
}

interface JobData {
  session: JobSession & {
    job_template: JobTemplate & {
      customer: Customer | null
    }
  }
  steps: (JobStep & {
    job_step_images: JobStepImage[]
    job_step_checklist: JobStepChecklist[]
  })[]
  stepProgress: JobSessionProgress[]
  checklistProgress: JobSessionChecklistProgress[]
  refuseMessage?: ScheduleMessage | null
}

function formatElapsedTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) {
    return `${h} hour${h !== 1 ? 's' : ''} ${m} minute${m !== 1 ? 's' : ''}`
  }
  return `${m} minute${m !== 1 ? 's' : ''}`
}

export default function JobExecutionPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [jobData, setJobData] = useState<JobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'checklist' | 'detailed'>('checklist')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [starting, setStarting] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [employeeNotes, setEmployeeNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [completionDuration, setCompletionDuration] = useState<number | null>(null)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const isMountedRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start the elapsed timer when job is IN_PROGRESS
  useEffect(() => {
    if (jobData?.session.status === 'IN_PROGRESS' && jobData.session.started_at) {
      const startTime = new Date(jobData.session.started_at).getTime()

      const updateElapsed = () => {
        const now = Date.now()
        setElapsedSeconds(Math.floor((now - startTime) / 1000))
      }

      updateElapsed()
      timerRef.current = setInterval(updateElapsed, 1000)

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
    }
  }, [jobData?.session.status, jobData?.session.started_at])

  // Clean up timer on unmount
  useEffect(() => {
    isMountedRef.current = true
    loadJobData()
    return () => {
      isMountedRef.current = false
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [sessionId])

  const loadJobData = async () => {
    setLoading(true)
    try {
      // Fetch job session with template and customer
      const { data: session, error: sessionError } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(
            *,
            customer:customers(*)
          )
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) throw sessionError
      if (!isMountedRef.current) return

      // Fetch steps with images and checklist
      const { data: steps, error: stepsError } = await supabase
        .from('job_steps')
        .select(`
          *,
          job_step_images(*),
          job_step_checklist(*)
        `)
        .eq('job_template_id', session.job_template.id)
        .order('step_order', { ascending: true })

      if (stepsError) throw stepsError
      if (!isMountedRef.current) return

      // Fetch step progress
      const { data: stepProgress, error: progressError } = await supabase
        .from('job_session_progress')
        .select('*')
        .eq('job_session_id', sessionId)

      if (progressError) throw progressError

      // Fetch checklist progress
      const { data: checklistProgress, error: checklistError } = await supabase
        .from('job_session_checklist_progress')
        .select('*')
        .eq('job_session_id', sessionId)

      if (checklistError) throw checklistError
      if (!isMountedRef.current) return

      // Fetch refuse message if job is REFUSED
      let refuseMessage: ScheduleMessage | null = null
      if (session.status === 'REFUSED') {
        const { data: messages } = await supabase
          .from('schedule_messages')
          .select('id, message, created_at')
          .eq('job_session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (messages && messages.length > 0) {
          refuseMessage = messages[0]
        }
      }

      if (!isMountedRef.current) return

      setJobData({
        session: session as JobData['session'],
        steps: (steps || []) as JobData['steps'],
        stepProgress: stepProgress || [],
        checklistProgress: checklistProgress || [],
        refuseMessage
      })

      // Load employee notes from session
      if (session.employee_notes) {
        setEmployeeNotes(session.employee_notes)
      }

      // If completed, compute the duration from started_at to completed_at
      if ((session.status === 'COMPLETED' || session.status === 'EVALUATED') && session.started_at && session.completed_at) {
        const start = new Date(session.started_at).getTime()
        const end = new Date(session.completed_at).getTime()
        setCompletionDuration(Math.floor((end - start) / 1000))
      }
    } catch (error) {
      console.error('Error loading job data:', error)
      toast.error('Failed to load job details')
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  const handleStartJob = async () => {
    setStarting(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('status', 'APPROVED')

      if (error) throw error

      toast.success('Job started!')
      await loadJobData()
    } catch (error) {
      console.error('Error starting job:', error)
      toast.error('Failed to start job')
    } finally {
      setStarting(false)
      setShowStartDialog(false)
    }
  }

  const handleToggleStep = async (stepId: string, currentState: boolean) => {
    if (!jobData) return

    try {
      const existingProgress = jobData.stepProgress.find(p => p.job_step_id === stepId)

      if (existingProgress) {
        // Update existing progress
        const { error } = await supabase
          .from('job_session_progress')
          .update({
            is_completed: !currentState,
            completed_at: !currentState ? new Date().toISOString() : null
          })
          .eq('id', existingProgress.id)

        if (error) throw error
      } else {
        // Create new progress record
        const { error } = await supabase
          .from('job_session_progress')
          .insert({
            job_session_id: sessionId,
            job_step_id: stepId,
            is_completed: true,
            completed_at: new Date().toISOString()
          })

        if (error) throw error
      }

      // Reload data
      await loadJobData()
    } catch (error) {
      console.error('Error toggling step:', error)
      toast.error('Failed to update step')
    }
  }

  const handleToggleChecklistItem = async (itemId: string, currentState: boolean) => {
    if (!jobData) return

    try {
      const existingProgress = jobData.checklistProgress.find(p => p.checklist_item_id === itemId)

      if (existingProgress) {
        // Update existing progress
        const { error } = await supabase
          .from('job_session_checklist_progress')
          .update({
            is_checked: !currentState,
            checked_at: !currentState ? new Date().toISOString() : null
          })
          .eq('id', existingProgress.id)

        if (error) throw error
      } else {
        // Create new progress record
        const { error } = await supabase
          .from('job_session_checklist_progress')
          .insert({
            job_session_id: sessionId,
            checklist_item_id: itemId,
            is_checked: true,
            checked_at: new Date().toISOString()
          })

        if (error) throw error
      }

      // Reload data
      await loadJobData()
    } catch (error) {
      console.error('Error toggling checklist item:', error)
      toast.error('Failed to update checklist')
    }
  }

  const handleCompleteJob = async () => {
    setCompleting(true)
    try {
      const completedAt = new Date().toISOString()
      // Calculate actual duration in minutes
      let actualDuration: number | null = null
      if (jobData?.session.started_at) {
        const start = new Date(jobData.session.started_at).getTime()
        const end = new Date(completedAt).getTime()
        actualDuration = Math.round((end - start) / 60000)
        setCompletionDuration(Math.floor((end - start) / 1000))
      }

      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'COMPLETED',
          completed_at: completedAt,
          actual_duration: actualDuration
        })
        .eq('id', sessionId)

      if (error) throw error

      // Navigate back to jobs page
      router.push('/employee/jobs')
    } catch (error) {
      console.error('Error completing job:', error)
      toast.error('Failed to complete job')
    } finally {
      setCompleting(false)
      setShowCompleteDialog(false)
    }
  }

  const handleSaveNotes = useCallback(async () => {
    if (!jobData) return
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({ employee_notes: employeeNotes })
        .eq('id', sessionId)

      if (error) throw error
      toast.success('Notes saved')
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }, [jobData, employeeNotes, sessionId])

  const completedStepsCount = useMemo(() => {
    if (!jobData) return 0
    return jobData.stepProgress.filter(p => p.is_completed).length
  }, [jobData])

  const totalSteps = jobData?.steps.length || 0
  const allStepsComplete = completedStepsCount === totalSteps && totalSteps > 0

  // Aggregate all supplies needed from all steps (#14)
  const suppliesNeeded = useMemo(() => {
    if (!jobData) return []
    const supplies: string[] = []
    jobData.steps.forEach(step => {
      if (step.products_needed) {
        // Split by comma or newline and trim
        step.products_needed.split(/[,\n]/).forEach(item => {
          const trimmed = item.trim()
          if (trimmed && !supplies.includes(trimmed)) {
            supplies.push(trimmed)
          }
        })
      }
    })
    return supplies
  }, [jobData])

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    }
  }

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!jobData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 flex items-center justify-center">
        <div className="p-8 text-center bg-white/10 rounded-xl border border-white/20">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Job not found</h2>
          <p className="text-gray-300 mb-4">This job does not exist or you don&apos;t have access to it.</p>
          <Button
            onClick={() => router.push('/employee/jobs')}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
          >
            Back to Jobs
          </Button>
        </div>
      </div>
    )
  }

  const currentStep = jobData.steps[currentStepIndex]
  const isApproved = jobData.session.status === 'APPROVED'
  const isInProgress = jobData.session.status === 'IN_PROGRESS'
  const isCompleted = jobData.session.status === 'COMPLETED' || jobData.session.status === 'EVALUATED'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pb-20">
      {/* Header */}
      <div className="bg-white/5  border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/employee/jobs')}
              className="text-white hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {/* Elapsed Timer - shown when IN_PROGRESS (#9) */}
              {isInProgress && (
                <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-sm font-mono">
                  <Timer className="w-3.5 h-3.5" />
                  {formatElapsedTime(elapsedSeconds)}
                </div>
              )}

              <Badge className={
                isInProgress ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                jobData.session.status === 'REFUSED' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                isApproved ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                isCompleted ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }>
                {isInProgress ? 'In Progress' :
                 isApproved ? 'Approved' :
                 isCompleted ? 'Completed' :
                 jobData.session.status}
              </Badge>
            </div>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">
            {jobData.session.job_template.title}
          </h1>

          <div className="flex flex-wrap gap-3 text-sm text-gray-300 mb-4">
            {jobData.session.job_template.customer && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Customer:</span>
                <span>{jobData.session.job_template.customer.full_name}</span>
              </div>
            )}
            {jobData.session.job_template.address && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{jobData.session.job_template.address}</span>
              </div>
            )}
            {jobData.session.job_template.duration_minutes && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{jobData.session.job_template.duration_minutes} min</span>
              </div>
            )}
          </div>

          {/* Completion duration summary */}
          {isCompleted && completionDuration !== null && (
            <div className="flex items-center gap-2 text-sm text-blue-300 mb-4">
              <Timer className="w-4 h-4" />
              <span>Duration: {formatDuration(completionDuration)}</span>
            </div>
          )}

          {!isApproved && jobData.session.status !== 'REFUSED' && (
            <ProgressBar
              current={completedStepsCount}
              total={totalSteps}
              label="Overall Progress"
            />
          )}
        </div>
      </div>

      {/* Refusal Reason Banner - shown when job is REFUSED */}
      {jobData.session.status === 'REFUSED' && (
        <div className="max-w-6xl mx-auto p-4">
          <div className="p-6 bg-red-500/10 rounded-xl border border-red-500/30">
            <div className="flex items-start gap-3">
              <XCircle className="w-8 h-8 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-300 text-lg mb-2">Claim Refused</h3>
                {jobData.refuseMessage ? (
                  <div>
                    <p className="text-red-300 font-medium mb-1">Reason from employer:</p>
                    <p className="text-red-200 bg-red-500/20 p-3 rounded-lg border border-red-500/30">
                      {jobData.refuseMessage.message.replace('Your claim was refused: ', '')}
                    </p>
                  </div>
                ) : (
                  <p className="text-red-300">Your claim for this job was refused by the employer.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPROVED state: Show Start Job button and Supplies (#7 + #14) */}
      {isApproved && (
        <div className="max-w-6xl mx-auto p-4 space-y-4">
          {/* Supplies Needed Section (#14) */}
          {suppliesNeeded.length > 0 && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Supplies Needed</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                Make sure you have the following before heading to the job site:
              </p>
              <ul className="space-y-2">
                {suppliesNeeded.map((supply, index) => (
                  <li key={index} className="flex items-center gap-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    {supply}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Start Job Button (#7) */}
          <div className="p-6 bg-green-500/10 rounded-xl border border-green-500/30">
            <div className="flex items-center gap-3 mb-4">
              <Play className="w-8 h-8 text-green-400" />
              <div>
                <h3 className="font-semibold text-green-300">Ready to start?</h3>
                <p className="text-sm text-green-400">
                  This job is approved and ready to begin.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowStartDialog(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Job
            </Button>
          </div>

          {/* Job Steps Preview (read-only when APPROVED) */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-5">
            <h3 className="text-lg font-semibold text-white mb-3">Job Steps Preview</h3>
            <div className="space-y-2">
              {jobData.steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                    {index + 1}
                  </div>
                  <span className="text-sm text-gray-300">{step.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Mode Selector - hidden for REFUSED and APPROVED jobs */}
      {isInProgress && (
      <div className="max-w-6xl mx-auto p-4">
        {/* View Mode Toggle Buttons */}
        <div className="flex gap-2 max-w-md mx-auto mb-6">
          <button
            onClick={() => setViewMode('checklist')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'checklist'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Checklist
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === 'detailed'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
            }`}
          >
            <List className="w-4 h-4" />
            Detailed
          </button>
        </div>

        {/* Checklist Mode */}
        {viewMode === 'checklist' && (
          <div className="space-y-2">
            {jobData.steps.map((step, index) => {
              const stepProgress = jobData.stepProgress.find(p => p.job_step_id === step.id)
              const isStepCompleted = stepProgress?.is_completed ?? false
              const checklistItems = step.job_step_checklist

              return (
                <div
                  key={step.id}
                  className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
                >
                  {/* Step header row */}
                  <div className="p-3 flex items-center gap-3">
                    {/* Completion toggle button */}
                    <button
                      onClick={() => handleToggleStep(step.id, isStepCompleted)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isStepCompleted
                          ? 'bg-green-500 border-green-500'
                          : 'border-white/30 hover:border-white/50'
                      }`}
                    >
                      {isStepCompleted && <Check className="w-4 h-4 text-white" />}
                    </button>

                    {/* Step number + title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Step {index + 1}</span>
                        <span className={`text-sm font-medium ${
                          isStepCompleted ? 'text-gray-500 line-through' : 'text-white'
                        }`}>
                          {step.title}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Inline checklist items (if any) */}
                  {checklistItems.length > 0 && (
                    <div className="px-3 pb-3 pl-14 space-y-1">
                      {checklistItems.map((item) => {
                        const itemProgress = jobData.checklistProgress.find(
                          cp => cp.checklist_item_id === item.id
                        )
                        const isChecked = itemProgress?.is_checked ?? false

                        return (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleChecklistItem(item.id, isChecked)}
                              className="h-4 w-4 rounded border-white/30 bg-white/5 accent-green-500"
                            />
                            <span className={
                              isChecked ? 'text-gray-500 line-through' : 'text-gray-300'
                            }>
                              {item.item_text}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Detailed Mode */}
        {viewMode === 'detailed' && currentStep && (
          <div>
            <div className="mb-4">
              <StepCard
                step={currentStep}
                stepNumber={currentStepIndex + 1}
                totalSteps={totalSteps}
                images={currentStep.job_step_images}
                checklistItems={currentStep.job_step_checklist}
                sessionId={sessionId}
                stepProgress={jobData.stepProgress.find(p => p.job_step_id === currentStep.id)}
                checklistProgress={jobData.checklistProgress.filter(
                  cp => currentStep.job_step_checklist.some(item => item.id === cp.checklist_item_id)
                )}
                onToggleStep={handleToggleStep}
                onToggleChecklistItem={handleToggleChecklistItem}
                isListMode={false}
              />
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center gap-4">
              <Button
                onClick={handlePreviousStep}
                disabled={currentStepIndex === 0}
                className="flex-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-300 whitespace-nowrap">
                {currentStepIndex + 1} of {totalSteps}
              </span>
              <Button
                onClick={handleNextStep}
                disabled={currentStepIndex === totalSteps - 1}
                className="flex-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Complete Job Button */}
        {allStepsComplete && (
          <div className="p-6 mt-6 bg-green-500/10 rounded-xl border border-green-500/30">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
              <div>
                <h3 className="font-semibold text-green-300">All steps completed!</h3>
                <p className="text-sm text-green-400">Ready to mark this job as complete.</p>
              </div>
            </div>
            <Button
              onClick={() => setShowCompleteDialog(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              Complete Job
            </Button>
          </div>
        )}

        {!allStepsComplete && totalSteps > 0 && (
          <div className="p-4 mt-6 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <p className="text-sm text-blue-300 text-center">
              Complete all steps to finish this job ({completedStepsCount}/{totalSteps} done)
            </p>
          </div>
        )}

        {/* Employee Notes Section (#11) */}
        <div className="mt-6 bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Notes</h3>
          </div>
          <textarea
            value={employeeNotes}
            onChange={(e) => setEmployeeNotes(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder="Add any notes about this job..."
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">Notes auto-save when you tap away</p>
            <Button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              variant="ghost"
              size="sm"
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* Notes section for completed jobs */}
      {isCompleted && (
        <div className="max-w-6xl mx-auto p-4">
          {/* Completion Duration */}
          {completionDuration !== null && (
            <div className="mb-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
              <div className="flex items-center gap-2 text-blue-300">
                <Timer className="w-5 h-5" />
                <span className="font-medium">Duration: {formatDuration(completionDuration)}</span>
              </div>
            </div>
          )}

          {/* Employee Notes (read-only for completed) */}
          {employeeNotes && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Notes</h3>
              </div>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{employeeNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Start Job Confirmation Dialog (#7) */}
      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Start Job?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you ready to start this job? The timer will begin tracking your work duration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={starting} className="bg-white/10 text-white border border-white/20 hover:bg-white/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartJob}
              disabled={starting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {starting ? 'Starting...' : 'Start Job'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Job Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Complete Job?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to mark this job as complete? This action will notify the customer
              and allow them to submit a review.
              {elapsedSeconds > 0 && (
                <span className="block mt-2 text-blue-300">
                  Total duration: {formatDuration(elapsedSeconds)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completing} className="bg-white/10 text-white border border-white/20 hover:bg-white/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteJob}
              disabled={completing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {completing ? 'Completing...' : 'Complete Job'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
