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
  Customer,
  Evaluation,
  Employee,
  JobSplitConfirmation
} from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { StepCard } from '@/components/employee/StepCard'
import { StepChecklist } from '@/components/employee/StepChecklist'
import { ProgressBar } from '@/components/employee/ProgressBar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  XCircle,
  Play,
  Timer,
  Package,
  StickyNote,
  Star,
  MessageSquare,
  User,
  Users,
  FileSpreadsheet,
  ExternalLink,
  Download,
  Camera,
  X
} from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import LoadingSpinner from '@/components/LoadingSpinner'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

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
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [jobData, setJobData] = useState<JobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [starting, setStarting] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [employeeNotes, setEmployeeNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [completionDuration, setCompletionDuration] = useState<number | null>(null)
  const [evaluation, setEvaluation] = useState<(Evaluation & { customer?: { full_name: string } }) | null>(null)
  const [splitPartner, setSplitPartner] = useState<Employee | null>(null)
  const [splitConfirmations, setSplitConfirmations] = useState<JobSplitConfirmation[]>([])
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
  const [confirmingSplit, setConfirmingSplit] = useState(false)
  const [pendingSplitId, setPendingSplitId] = useState<string | null>(null)
  const [pendingSplitStatus, setPendingSplitStatus] = useState<string | null>(null)
  const [pendingSplitRequestedBy, setPendingSplitRequestedBy] = useState<string | null>(null)
  const [cancelingSplit, setCancelingSplit] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)
  // #11 - Step-by-step wizard mode
  const [wizardMode, setWizardMode] = useState<'all' | 'wizard'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('job-view-mode') as 'all' | 'wizard') || 'all'
    }
    return 'all'
  })
  const [wizardStepIndex, setWizardStepIndex] = useState(0)
  const [showWizardSummary, setShowWizardSummary] = useState(false)
  // #13 - Offline checklist caching
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  // #14 - Before/after photo capture per step
  const [stepPhotos, setStepPhotos] = useState<Record<number, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`job-photos-${sessionId}`)
        return cached ? JSON.parse(cached) : {}
      } catch { return {} }
    }
    return {}
  })
  const [uploadingPhoto, setUploadingPhoto] = useState<number | null>(null)
  const photoInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

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

  // Real-time subscription for split confirmations
  useEffect(() => {
    if (!jobData?.session.split_with) return

    const channel = supabase
      .channel(`split-confirmations-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_split_confirmations',
          filter: `job_session_id=eq.${sessionId}`,
        },
        () => {
          // Reload confirmations when partner confirms
          supabase
            .from('job_split_confirmations')
            .select('*')
            .eq('job_session_id', sessionId)
            .then(({ data }) => {
              if (isMountedRef.current && data) {
                setSplitConfirmations(data)
              }
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, jobData?.session.split_with])

  // #11 - Persist wizard mode to localStorage
  useEffect(() => {
    localStorage.setItem('job-view-mode', wizardMode)
  }, [wizardMode])

  // #13 - Apply cached checklist state on load and clear on COMPLETED
  useEffect(() => {
    if (!jobData) return
    if (jobData.session.status === 'COMPLETED' || jobData.session.status === 'EVALUATED') {
      localStorage.removeItem(`job-checklist-${sessionId}`)
      localStorage.removeItem(`job-photos-${sessionId}`)
    }
  }, [jobData?.session.status, sessionId])

  // #14 - Persist step photos to localStorage
  useEffect(() => {
    localStorage.setItem(`job-photos-${sessionId}`, JSON.stringify(stepPhotos))
  }, [stepPhotos, sessionId])

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

      // If evaluated, fetch the evaluation
      if (session.status === 'EVALUATED') {
        const { data: evalData } = await supabase
          .from('evaluations')
          .select('*, customer:customers(full_name)')
          .eq('job_session_id', sessionId)
          .maybeSingle()

        if (isMountedRef.current && evalData) {
          setEvaluation(evalData as any)
        }
      }

      // Load split partner info if this is a split job
      if (session.split_with) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: emp } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', user.id)
            .single()
          if (isMountedRef.current && emp) {
            setCurrentEmployeeId(emp.id)
          }
        }

        // Load partner employee details
        const { data: partner } = await supabase
          .from('employees')
          .select('*')
          .eq('id', session.split_with)
          .single()

        if (isMountedRef.current && partner) {
          setSplitPartner(partner as Employee)
        }

        // Load split confirmations
        const { data: confirmations } = await supabase
          .from('job_split_confirmations')
          .select('*')
          .eq('job_session_id', sessionId)

        if (isMountedRef.current) {
          setSplitConfirmations(confirmations || [])
        }
      }

      // Check for pending split requests on this session (for cancel action)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        const { data: empData } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', currentUser.id)
          .single()

        if (empData && isMountedRef.current) {
          setCurrentEmployeeId(empData.id)

          const { data: pendingSplit } = await supabase
            .from('job_splits')
            .select('id, status, requested_by')
            .eq('job_session_id', sessionId)
            .in('status', ['PENDING_PARTNER', 'PENDING_EMPLOYER'])
            .maybeSingle()

          if (pendingSplit && isMountedRef.current) {
            setPendingSplitId(pendingSplit.id)
            setPendingSplitStatus(pendingSplit.status)
            setPendingSplitRequestedBy(pendingSplit.requested_by)
          }
        }
      }
    } catch (error) {
      console.error('Error loading job data:', error)
      toast.error(t('Failed to load job details'))
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

      toast.success(t('Job started!'))
      await loadJobData()
    } catch (error) {
      console.error('Error starting job:', error)
      toast.error(t('Failed to start job'))
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
      toast.error(t('Failed to update step'))
    }
  }

  const handleToggleChecklistItem = async (itemId: string, currentState: boolean) => {
    if (!jobData) return

    // #13 - Save to localStorage immediately
    const cacheKey = `job-checklist-${sessionId}`
    const newState = !currentState
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '{}')
      cached[itemId] = newState
      localStorage.setItem(cacheKey, JSON.stringify(cached))
    } catch { /* ignore localStorage errors */ }

    try {
      const existingProgress = jobData.checklistProgress.find(p => p.checklist_item_id === itemId)

      if (existingProgress) {
        const { error } = await supabase
          .from('job_session_checklist_progress')
          .update({
            is_checked: newState,
            checked_at: newState ? new Date().toISOString() : null
          })
          .eq('id', existingProgress.id)

        if (error) throw error
      } else {
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

      // Sync succeeded
      setLastSyncedAt(new Date())
      await loadJobData()
    } catch (error) {
      console.error('Error toggling checklist item:', error)
      toast.error(t('Saved locally, will sync when online'))
    }
  }

  const handleCompleteJob = async () => {
    setCompleting(true)
    try {
      // If this is a split job, use dual-confirm flow
      if (jobData?.session.split_with && currentEmployeeId) {
        await handleSplitConfirm()
        return
      }

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

      // Send review request email to customer (fire-and-forget)
      fetch('/api/notify/review-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_session_id: sessionId }),
      }).then(res => {
        if (res.ok) toast.success(t('Review request sent to customer'))
      }).catch(() => {
        // Job is still completed even if email fails
      })

      // Navigate back to jobs page
      router.push('/employee/jobs')
    } catch (error) {
      console.error('Error completing job:', error)
      toast.error(t('Failed to complete job'))
    } finally {
      setCompleting(false)
      setShowCompleteDialog(false)
    }
  }

  const handleSplitConfirm = async () => {
    if (!currentEmployeeId) return
    setConfirmingSplit(true)
    try {
      // UPSERT confirmation (idempotent)
      const { error } = await supabase
        .from('job_split_confirmations')
        .upsert(
          {
            job_session_id: sessionId,
            employee_id: currentEmployeeId,
            confirmed_at: new Date().toISOString(),
          },
          { onConflict: 'job_session_id,employee_id' }
        )

      if (error) throw error

      // Re-check how many confirmations exist
      const { data: allConfirmations } = await supabase
        .from('job_split_confirmations')
        .select('*')
        .eq('job_session_id', sessionId)

      setSplitConfirmations(allConfirmations || [])

      // If both have confirmed, mark the job as COMPLETED
      if (allConfirmations && allConfirmations.length >= 2) {
        const completedAt = new Date().toISOString()
        let actualDuration: number | null = null
        if (jobData?.session.started_at) {
          const start = new Date(jobData.session.started_at).getTime()
          const end = new Date(completedAt).getTime()
          actualDuration = Math.round((end - start) / 60000)
        }

        await supabase
          .from('job_sessions')
          .update({
            status: 'COMPLETED',
            completed_at: completedAt,
            actual_duration: actualDuration,
          })
          .eq('id', sessionId)

        // Send review request email to customer (fire-and-forget)
        fetch('/api/notify/review-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_session_id: sessionId }),
        }).catch(() => {})

        toast.success(t('Both confirmed! Job completed.'))
        router.push('/employee/jobs')
      } else {
        toast.success(t('Your confirmation recorded. Waiting for your partner.'))
        setShowCompleteDialog(false)
      }
    } catch (error) {
      console.error('Error confirming split completion:', error)
      toast.error(t('Failed to confirm completion'))
    } finally {
      setConfirmingSplit(false)
      setCompleting(false)
    }
  }

  const handleCancelSplitRequest = async () => {
    if (!pendingSplitId) return
    setCancelingSplit(true)
    try {
      const { error } = await supabase
        .from('job_splits')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', pendingSplitId)

      if (error) throw error

      toast.success(t('Split request cancelled'))
      setPendingSplitId(null)
      setPendingSplitStatus(null)
      setPendingSplitRequestedBy(null)
    } catch (error) {
      console.error('Error canceling split request:', error)
      toast.error(t('Failed to cancel split request'))
    } finally {
      setCancelingSplit(false)
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
      toast.success(t('Notes saved'))
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error(t('Failed to save notes'))
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

  // #4 - Check if all checklist items across all steps are checked
  const allChecklistItemsChecked = useMemo(() => {
    if (!jobData) return false
    const allItems = jobData.steps.flatMap(s => s.job_step_checklist)
    if (allItems.length === 0) return allStepsComplete
    return allItems.every(item =>
      jobData.checklistProgress.some(cp => cp.checklist_item_id === item.id && cp.is_checked)
    )
  }, [jobData, allStepsComplete])

  // #11 - Check if current wizard step's checklist is complete
  const isWizardStepComplete = useMemo(() => {
    if (!jobData) return false
    const step = jobData.steps[wizardStepIndex]
    if (!step) return false
    const items = step.job_step_checklist
    if (items.length === 0) return true
    return items.every(item =>
      jobData.checklistProgress.some(cp => cp.checklist_item_id === item.id && cp.is_checked)
    )
  }, [jobData, wizardStepIndex])

  // #14 - Photo upload handler
  const handlePhotoUpload = async (stepOrder: number, file: File) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('Photo must be under 5MB'))
      return
    }
    const existing = stepPhotos[stepOrder] || []
    if (existing.length >= 3) {
      toast.error(t('Maximum 3 photos per step'))
      return
    }

    setUploadingPhoto(stepOrder)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const timestamp = Date.now()
      const path = `execution-photos/${sessionId}/${stepOrder}-${timestamp}.${ext}`

      const { error } = await supabase.storage
        .from('job-images')
        .upload(path, file)

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('job-images')
        .getPublicUrl(path)

      const photoUrl = urlData.publicUrl
      setStepPhotos(prev => ({
        ...prev,
        [stepOrder]: [...(prev[stepOrder] || []), photoUrl]
      }))
      toast.success(t('Photo uploaded'))
    } catch (error) {
      console.error('Error uploading photo:', error)
      toast.error(t('Failed to upload photo'))
    } finally {
      setUploadingPhoto(null)
    }
  }

  const handleRemovePhoto = (stepOrder: number, photoIndex: number) => {
    setStepPhotos(prev => ({
      ...prev,
      [stepOrder]: (prev[stepOrder] || []).filter((_, i) => i !== photoIndex)
    }))
  }

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

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!jobData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 flex items-center justify-center">
        <div className="p-8 text-center bg-white/10 rounded-xl border border-white/20">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">{t('Job not found')}</h2>
          <p className="text-gray-300 mb-4">{t('This job does not exist or you don\'t have access to it.')}</p>
          <Button
            onClick={() => router.push('/employee/jobs')}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
          >
            {t('Back to Jobs')}
          </Button>
        </div>
      </div>
    )
  }

  const isApproved = jobData.session.status === 'APPROVED'
  const isInProgress = jobData.session.status === 'IN_PROGRESS'
  const isCompleted = jobData.session.status === 'COMPLETED' || jobData.session.status === 'EVALUATED'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black pb-20">
      {/* Sticky Nav Bar */}
      <div className="bg-gray-900/95 backdrop-blur-sm border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/employee/jobs')}
              className="text-white hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('Back')}
            </Button>

            <div className="flex items-center gap-2">
              {/* Elapsed Timer - shown when IN_PROGRESS */}
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
                jobData.session.status === 'EVALUATED' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                isCompleted ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }>
                {isInProgress ? t('In Progress') :
                 isApproved ? t('Approved') :
                 jobData.session.status === 'EVALUATED' ? t('Evaluated') :
                 isCompleted ? t('Completed') :
                 jobData.session.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Job Info Section (scrolls normally) */}
      <div className="max-w-6xl mx-auto p-4 space-y-3">
        <h1 className="text-lg font-bold text-white">
          {jobData.session.job_template.title}
        </h1>

        {/* Video Thumbnail - click to open modal */}
        {jobData.session.job_template.video_url && (
          <button
            type="button"
            onClick={() => setShowVideoModal(true)}
            className="w-full relative rounded-lg border border-white/20 overflow-hidden bg-black cursor-pointer group max-h-36"
          >
            <video
              src={jobData.session.job_template.video_url + '#t=0.1'}
              className="w-full max-h-36 object-cover pointer-events-none"
              preload="metadata"
              muted
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-7 h-7 text-white ml-1" />
              </div>
            </div>
          </button>
        )}

        {/* Procedures File (PPTX) */}
        {jobData.session.job_template.pptx_url && (
          <div className="flex gap-2">
            <a
              href={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(jobData.session.job_template.pptx_url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {t('View Procedures')}
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={jobData.session.job_template.pptx_url}
              download
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-sm text-gray-300">
          {jobData.session.job_template.customer && (
            <div className="flex items-center gap-1">
              <span className="font-medium">{t('Customer')}:</span>
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
          <div className="flex items-center gap-2 text-sm text-blue-300">
            <Timer className="w-4 h-4" />
            <span>{t('Duration')}: {formatDuration(completionDuration)}</span>
          </div>
        )}

        {!isApproved && jobData.session.status !== 'REFUSED' && (
          <>
            <ProgressBar
              current={completedStepsCount}
              total={totalSteps}
              label={t('Overall Progress')}
            />
            {/* #13 - Last synced indicator */}
            {isInProgress && lastSyncedAt && (
              <p className="text-xs text-gray-500 mt-1">
                {t('Last synced')}: {lastSyncedAt.toLocaleTimeString()}
              </p>
            )}
          </>
        )}
      </div>

      {/* Refusal Reason Banner - shown when job is REFUSED */}
      {jobData.session.status === 'REFUSED' && (
        <div className="max-w-6xl mx-auto p-4">
          <div className="p-6 bg-red-500/10 rounded-xl border border-red-500/30">
            <div className="flex items-start gap-3">
              <XCircle className="w-8 h-8 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-300 text-lg mb-2">{t('Claim Refused')}</h3>
                {jobData.refuseMessage ? (
                  <div>
                    <p className="text-red-300 font-medium mb-1">{t('Reason from employer')}:</p>
                    <p className="text-red-200 bg-red-500/20 p-3 rounded-lg border border-red-500/30">
                      {jobData.refuseMessage.message.replace('Your claim was refused: ', '')}
                    </p>
                  </div>
                ) : (
                  <p className="text-red-300">{t('Your claim for this job was refused by the employer.')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split Job Partner Banner */}
      {splitPartner && (
        <div className="max-w-6xl mx-auto p-4">
          <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-purple-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-purple-300">{t('Split Job')}</h3>
                <p className="text-sm text-purple-200">
                  {t('Shared with')} <span className="font-medium text-white">{splitPartner.full_name}</span>
                </p>
              </div>
            </div>
            {/* Confirmation status */}
            {isInProgress && allStepsComplete && (
              <div className="mt-3 pt-3 border-t border-purple-500/30 space-y-2">
                <p className="text-xs text-gray-400">{t('Completion confirmations:')}</p>
                <div className="flex gap-3">
                  {/* Current employee */}
                  <div className="flex items-center gap-1.5 text-sm">
                    {splitConfirmations.some(c => c.employee_id === currentEmployeeId)
                      ? <span className="text-green-400">&#10003; {t('You')}</span>
                      : <span className="text-gray-400">&#9675; {t('You')}</span>
                    }
                  </div>
                  {/* Partner */}
                  <div className="flex items-center gap-1.5 text-sm">
                    {splitConfirmations.some(c => c.employee_id === splitPartner.id)
                      ? <span className="text-green-400">&#10003; {splitPartner.full_name}</span>
                      : <span className="text-gray-400">&#9675; {splitPartner.full_name}</span>
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Split Request - Cancel Action */}
      {pendingSplitId && pendingSplitRequestedBy === currentEmployeeId && (
        <div className="max-w-6xl mx-auto px-4">
          <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm font-medium text-purple-300">
                    {pendingSplitStatus === 'PENDING_PARTNER'
                      ? t('Split request pending partner approval')
                      : t('Split request pending employer approval')}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  if (confirm(t('Cancel this split request?'))) {
                    handleCancelSplitRequest()
                  }
                }}
                disabled={cancelingSplit}
                size="sm"
                className="bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
              >
                {cancelingSplit ? '...' : t('Cancel Split Request')}
              </Button>
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
                <h3 className="text-lg font-semibold text-white">{t('Supplies Needed')}</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                {t('Make sure you have the following before heading to the job site:')}
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
                <h3 className="font-semibold text-green-300">{t('Ready to start?')}</h3>
                <p className="text-sm text-green-400">
                  {t('This job is approved and ready to begin.')}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowStartDialog(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              {t('Start Job')}
            </Button>
          </div>

          {/* Job Steps Preview (read-only when APPROVED) */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-5">
            <h3 className="text-lg font-semibold text-white mb-3">{t('Job Steps Preview')}</h3>
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
        {/* #11 - All Steps / Step by Step toggle */}
        <div className="flex gap-1 max-w-xs mx-auto mb-6 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => { setWizardMode('all'); setShowWizardSummary(false) }}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              wizardMode === 'all'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {t('All Steps')}
          </button>
          <button
            onClick={() => { setWizardMode('wizard'); setShowWizardSummary(false) }}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              wizardMode === 'wizard'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {t('Step by Step')}
          </button>
        </div>

        {/* All Steps - Resume + Accordion View */}
        {wizardMode === 'all' && (
          <div className="space-y-2">
            {/* Progress header */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">
                  {completedStepsCount}/{totalSteps} {t('steps completed')}
                </span>
                <span className="text-xs text-gray-500">
                  {totalSteps > 0 ? Math.round((completedStepsCount / totalSteps) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${totalSteps > 0 ? (completedStepsCount / totalSteps) * 100 : 0}%` }}
                />
              </div>
            </div>

            {jobData.steps.map((step, index) => {
              const stepProg = jobData.stepProgress.find(p => p.job_step_id === step.id)
              const isStepCompleted = stepProg?.is_completed ?? false
              const checklistItems = step.job_step_checklist
              const checkedCount = checklistItems.filter(item =>
                jobData.checklistProgress.some(cp => cp.checklist_item_id === item.id && cp.is_checked)
              ).length
              const isExpanded = expandedStepId === step.id
              const photos = stepPhotos[step.step_order] || []
              const sortedImages = [...(step.job_step_images || [])].sort((a, b) => a.image_order - b.image_order)

              return (
                <div
                  key={step.id}
                  className={`bg-white/5 rounded-xl border overflow-hidden transition-colors ${
                    isStepCompleted ? 'border-green-500/30' : 'border-white/10'
                  }`}
                >
                  {/* Step row */}
                  <div className="flex items-center gap-3 p-3">
                    {/* Step number badge */}
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center text-sm font-bold shrink-0">
                      {index + 1}
                    </div>

                    {/* Title + checklist count - clickable to expand */}
                    <button
                      onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className={`text-sm font-medium block ${
                        isStepCompleted ? 'text-gray-500 line-through' : 'text-white'
                      }`}>
                        {step.title}
                      </span>
                      {checklistItems.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {checkedCount}/{checklistItems.length} {t('items checked')}
                        </span>
                      )}
                    </button>

                    {/* Expand/collapse arrow */}
                    <button
                      onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                      className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-300 shrink-0"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Checkmark toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleStep(step.id, isStepCompleted)
                      }}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isStepCompleted
                          ? 'bg-green-500 border-green-500'
                          : 'border-white/30 hover:border-white/50'
                      }`}
                    >
                      {isStepCompleted && <Check className="w-4 h-4 text-white" />}
                    </button>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="border-t border-white/10 p-4 space-y-4">
                      {/* Description */}
                      {step.description && (
                        <p className="text-sm text-gray-400">{step.description}</p>
                      )}

                      {/* Products needed */}
                      {step.products_needed && (
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                          <p className="text-xs font-semibold text-blue-300 mb-1">{t('Products Needed:')}</p>
                          <p className="text-sm text-blue-200">{step.products_needed}</p>
                        </div>
                      )}

                      {/* Step images */}
                      {sortedImages.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {sortedImages.map((image) => (
                            <div key={image.id} className="relative aspect-video rounded-lg overflow-hidden bg-white/5">
                              <img
                                src={image.image_url}
                                alt={image.caption || `Step ${index + 1} image`}
                                className="w-full h-full object-cover"
                              />
                              {image.caption && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1">
                                  <p className="text-xs text-white text-center">{image.caption}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Checklist */}
                      {checklistItems.length > 0 && (
                        <StepChecklist
                          items={checklistItems}
                          sessionId={sessionId}
                          progress={jobData.checklistProgress.filter(
                            cp => checklistItems.some(item => item.id === cp.checklist_item_id)
                          )}
                          onToggle={handleToggleChecklistItem}
                          disabled={isStepCompleted}
                        />
                      )}

                      {/* PPTX link */}
                      {jobData.session.job_template.pptx_url && (
                        <a
                          href={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(jobData.session.job_template.pptx_url)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30 transition-colors"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          {t('View Procedures')}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* Photo capture + thumbnails */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => photoInputRefs.current[step.step_order]?.click()}
                          disabled={uploadingPhoto === step.step_order || photos.length >= 3}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-sm transition-colors disabled:opacity-30"
                        >
                          <Camera className="w-4 h-4" />
                          {uploadingPhoto === step.step_order ? t('Uploading...') : t('Add Photo')}
                        </button>
                        <input
                          ref={el => { photoInputRefs.current[step.step_order] = el }}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handlePhotoUpload(step.step_order, file)
                            e.target.value = ''
                          }}
                        />
                        {photos.map((url, i) => (
                          <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/20 group">
                            <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => handleRemovePhoto(step.step_order, i)}
                              className="absolute top-0 right-0 w-4 h-4 bg-red-600 rounded-bl-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* #11 - Step by Step Wizard Mode */}
        {wizardMode === 'wizard' && !showWizardSummary && (
          <div>
            {/* Progress indicator */}
            <p className="text-center text-sm text-gray-400 mb-4">
              {t('Step')} {wizardStepIndex + 1} {t('of')} {totalSteps}
            </p>

            {/* Current step */}
            {jobData.steps[wizardStepIndex] && (
              <>
                <div className="mb-4">
                  <StepCard
                    step={jobData.steps[wizardStepIndex]}
                    stepNumber={wizardStepIndex + 1}
                    totalSteps={totalSteps}
                    images={jobData.steps[wizardStepIndex].job_step_images}
                    checklistItems={jobData.steps[wizardStepIndex].job_step_checklist}
                    sessionId={sessionId}
                    stepProgress={jobData.stepProgress.find(p => p.job_step_id === jobData.steps[wizardStepIndex].id)}
                    checklistProgress={jobData.checklistProgress.filter(
                      cp => jobData.steps[wizardStepIndex].job_step_checklist.some(item => item.id === cp.checklist_item_id)
                    )}
                    onToggleStep={handleToggleStep}
                    onToggleChecklistItem={handleToggleChecklistItem}
                    isListMode={false}
                  />
                  {/* #14 - Photo capture in wizard */}
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => photoInputRefs.current[jobData.steps[wizardStepIndex].step_order]?.click()}
                      disabled={uploadingPhoto === jobData.steps[wizardStepIndex].step_order || (stepPhotos[jobData.steps[wizardStepIndex].step_order]?.length || 0) >= 3}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-sm transition-colors disabled:opacity-30"
                    >
                      <Camera className="w-4 h-4" />
                      {uploadingPhoto === jobData.steps[wizardStepIndex].step_order ? t('Uploading...') : t('Add Photo')}
                    </button>
                    <input
                      ref={el => { photoInputRefs.current[jobData.steps[wizardStepIndex].step_order] = el }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handlePhotoUpload(jobData.steps[wizardStepIndex].step_order, file)
                        e.target.value = ''
                      }}
                    />
                    {(stepPhotos[jobData.steps[wizardStepIndex].step_order] || []).map((url, i) => (
                      <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/20 group">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemovePhoto(jobData.steps[wizardStepIndex].step_order, i)}
                          className="absolute top-0 right-0 w-4 h-4 bg-red-600 rounded-bl-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Wizard navigation */}
                <div className="flex justify-between items-center gap-4">
                  <Button
                    onClick={() => setWizardStepIndex(i => i - 1)}
                    disabled={wizardStepIndex === 0}
                    className="flex-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {t('Previous')}
                  </Button>
                  {wizardStepIndex === totalSteps - 1 ? (
                    <Button
                      onClick={() => setShowWizardSummary(true)}
                      disabled={!isWizardStepComplete}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                    >
                      {t('Review & Complete')}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setWizardStepIndex(i => i + 1)}
                      disabled={!isWizardStepComplete}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                    >
                      {t('Next')}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* #11 - Wizard Summary */}
        {wizardMode === 'wizard' && showWizardSummary && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white text-center">{t('Review Summary')}</h3>
            <div className="space-y-2">
              {jobData.steps.map((step, index) => {
                const stepProg = jobData.stepProgress.find(p => p.job_step_id === step.id)
                const isStepDone = stepProg?.is_completed ?? false
                return (
                  <div key={step.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isStepDone ? 'bg-green-500' : 'bg-gray-600'}`}>
                      {isStepDone ? <Check className="w-3.5 h-3.5 text-white" /> : <span className="text-xs text-white">{index + 1}</span>}
                    </div>
                    <span className={`text-sm ${isStepDone ? 'text-green-300' : 'text-gray-400'}`}>{step.title}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowWizardSummary(false)}
                className="flex-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
              >
                {t('Back to Steps')}
              </Button>
              {allStepsComplete && (
                <Button
                  onClick={() => setShowCompleteDialog(true)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t('Complete Job')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Complete Job Button / Split Confirm Button */}
        {allStepsComplete && (
          <div className="p-6 mt-6 bg-green-500/10 rounded-xl border border-green-500/30">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
              <div>
                <h3 className="font-semibold text-green-300">{t('All steps completed!')}</h3>
                <p className="text-sm text-green-400">
                  {jobData?.session.split_with
                    ? t('Confirm completion. Both you and your partner must confirm.')
                    : t('Ready to mark this job as complete.')}
                </p>
              </div>
            </div>
            {/* Split confirmation status */}
            {jobData?.session.split_with && splitPartner && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {splitConfirmations.some(c => c.employee_id === currentEmployeeId)
                    ? <span className="text-green-400">&#10003; {t('You')} - {t('Confirmed')}</span>
                    : <span className="text-gray-400">&#9675; {t('You')} - {t('Not confirmed')}</span>
                  }
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {splitConfirmations.some(c => c.employee_id === splitPartner.id)
                    ? <span className="text-green-400">&#10003; {splitPartner.full_name} - {t('Confirmed')}</span>
                    : <span className="text-gray-400">&#9675; {splitPartner.full_name} - {t('Not confirmed')}</span>
                  }
                </div>
              </div>
            )}
            {splitConfirmations.some(c => c.employee_id === currentEmployeeId) ? (
              <div className="text-center text-sm text-green-300 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                {t('You have confirmed. Waiting for your partner.')}
              </div>
            ) : (
              <Button
                onClick={() => setShowCompleteDialog(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
                disabled={confirmingSplit}
              >
                {jobData?.session.split_with
                  ? (confirmingSplit ? t('Confirming...') : t('Confirm Completion'))
                  : t('Complete Job')}
              </Button>
            )}
          </div>
        )}

        {!allStepsComplete && totalSteps > 0 && (
          <div className="p-4 mt-6 bg-blue-500/10 rounded-xl border border-blue-500/30">
            <p className="text-sm text-blue-300 text-center">
              {t('Complete all steps to finish this job')} ({completedStepsCount}/{totalSteps} {t('done')})
            </p>
          </div>
        )}

        {/* Employee Notes Section (#11) */}
        <div className="mt-6 bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">{t('Notes')}</h3>
          </div>
          <textarea
            value={employeeNotes}
            onChange={(e) => setEmployeeNotes(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder={t('Add any notes about this job...')}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-500">{t('Notes auto-save when you tap away')}</p>
            <Button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              variant="ghost"
              size="sm"
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
            >
              {savingNotes ? t('Saving...') : t('Save Notes')}
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* Notes section for completed jobs */}
      {isCompleted && (
        <div className="max-w-6xl mx-auto p-4 space-y-4">
          {/* Completion Duration */}
          {completionDuration !== null && (
            <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
              <div className="flex items-center gap-2 text-blue-300">
                <Timer className="w-5 h-5" />
                <span className="font-medium">{t('Duration')}: {formatDuration(completionDuration)}</span>
              </div>
            </div>
          )}

          {/* Customer Evaluation */}
          {evaluation && (
            <div className="bg-gradient-to-br from-yellow-900/20 to-amber-900/10 rounded-xl border border-yellow-500/30 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-semibold text-white">{t('Customer Review')}</h3>
              </div>

              {/* Rating stars */}
              <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 mb-3">
                <div className="flex items-center justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`text-3xl ${star <= evaluation.rating ? 'text-yellow-400' : 'text-gray-600'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-center text-white font-bold text-lg">{evaluation.rating}/5</p>
              </div>

              {/* Customer name */}
              {evaluation.customer?.full_name && (
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">{t('Reviewed by')}</span>
                  <span className="text-sm font-semibold text-white">{evaluation.customer.full_name}</span>
                </div>
              )}

              {/* Comment */}
              {evaluation.comment && (
                <div className="bg-gray-900/60 rounded-xl p-4 border border-white/10 mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-400">{t('Comments')}</span>
                  </div>
                  <p className="text-gray-200 text-sm whitespace-pre-wrap">{evaluation.comment}</p>
                </div>
              )}

              {/* Submitted date */}
              {evaluation.submitted_at && (
                <p className="text-xs text-gray-500 mt-3">
                  {t('Submitted')} {new Date(evaluation.submitted_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </p>
              )}
            </div>
          )}

          {/* Awaiting review notice for COMPLETED */}
          {jobData.session.status === 'COMPLETED' && !evaluation && (
            <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-300">
                <Star className="w-5 h-5" />
                <span className="font-medium">{t('Awaiting customer review')}</span>
              </div>
            </div>
          )}

          {/* Employee Notes (read-only for completed) */}
          {employeeNotes && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">{t('Notes')}</h3>
              </div>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{employeeNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && jobData.session.job_template.video_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <div
            className="relative w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowVideoModal(false)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm flex items-center gap-1"
            >
              <XCircle className="w-5 h-5" />
              {t('Close')}
            </button>
            <video
              src={jobData.session.job_template.video_url}
              controls
              muted
              playsInline
              className="w-full rounded-xl border border-white/20 bg-black"
            />
          </div>
        </div>
      )}

      {/* Start Job Confirmation Dialog (#12) */}
      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('Ready to start?')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-gray-300">
                <p>{t('The timer will begin immediately. Make sure you\'re at the job location.')}</p>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-1">
                  <p className="text-white font-medium">{jobData.session.job_template.title}</p>
                  {jobData.session.job_template.customer && (
                    <p className="text-sm text-gray-400">{jobData.session.job_template.customer.full_name}</p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={starting} className="bg-transparent text-white border-0 hover:bg-white/10">{t('Not Yet')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartJob}
              disabled={starting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {starting ? t('Starting...') : t('Start Now')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* #4 - Floating Complete Job FAB */}
      {isInProgress && allChecklistItemsChecked && allStepsComplete && (
        <button
          onClick={() => setShowCompleteDialog(true)}
          className="fixed bottom-20 right-4 z-40 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-2xl px-6 py-3 font-bold flex items-center gap-2 animate-[slideUpFade_0.3s_ease-out]"
        >
          <CheckCircle2 className="w-5 h-5" />
          {t('Complete Job')}
        </button>
      )}

      {/* Complete Job Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('Complete Job?')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              {t('Are you sure you want to mark this job as complete? This action will notify the customer and allow them to submit a review.')}
              {elapsedSeconds > 0 && (
                <span className="block mt-2 text-blue-300">
                  {t('Total duration')}: {formatDuration(elapsedSeconds)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completing} className="bg-white/10 text-white border border-white/20 hover:bg-white/20">{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteJob}
              disabled={completing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {completing ? t('Completing...') : t('Complete Job')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
