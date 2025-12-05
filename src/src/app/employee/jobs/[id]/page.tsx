'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronLeft,
  ChevronRight,
  List,
  Layers,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  XCircle
} from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

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

export default function JobExecutionPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [jobData, setJobData] = useState<JobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'swipe'>('list')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [completing, setCompleting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadJobData()
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

      setJobData({
        session: session as any,
        steps: steps as any,
        stepProgress: stepProgress || [],
        checklistProgress: checklistProgress || [],
        refuseMessage
      })

      // Auto-start job if not started
      if (session.status === 'APPROVED') {
        await supabase
          .from('job_sessions')
          .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
          .eq('id', sessionId)
      }
    } catch (error) {
      console.error('Error loading job data:', error)
    } finally {
      setLoading(false)
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
    }
  }

  const handleCompleteJob = async () => {
    setCompleting(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      if (error) throw error

      // Navigate back to jobs page
      router.push('/employee/jobs')
    } catch (error) {
      console.error('Error completing job:', error)
    } finally {
      setCompleting(false)
      setShowCompleteDialog(false)
    }
  }

  const completedStepsCount = useMemo(() => {
    if (!jobData) return 0
    return jobData.stepProgress.filter(p => p.is_completed).length
  }, [jobData])

  const totalSteps = jobData?.steps.length || 0
  const allStepsComplete = completedStepsCount === totalSteps && totalSteps > 0

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
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job...</p>
        </div>
      </div>
    )
  }

  if (!jobData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Job not found</h2>
          <p className="text-gray-600 mb-4">This job does not exist or you don't have access to it.</p>
          <Button onClick={() => router.push('/employee/jobs')}>Back to Jobs</Button>
        </Card>
      </div>
    )
  }

  const currentStep = jobData.steps[currentStepIndex]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/employee/jobs')}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <Badge className={
              jobData.session.status === 'IN_PROGRESS' ? 'bg-amber-500' :
              jobData.session.status === 'REFUSED' ? 'bg-red-500' :
              'bg-blue-600'
            }>
              {jobData.session.status === 'IN_PROGRESS' ? 'In Progress' : jobData.session.status}
            </Badge>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {jobData.session.job_template.title}
          </h1>

          <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-4">
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

          {jobData.session.status !== 'REFUSED' && (
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
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <XCircle className="w-8 h-8 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 text-lg mb-2">Claim Refused</h3>
                {jobData.refuseMessage ? (
                  <div>
                    <p className="text-red-800 font-medium mb-1">Reason from employer:</p>
                    <p className="text-red-700 bg-red-100 p-3 rounded-lg">
                      {jobData.refuseMessage.message.replace('Your claim was refused: ', '')}
                    </p>
                  </div>
                ) : (
                  <p className="text-red-700">Your claim for this job was refused by the employer.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* View Mode Selector - hidden for REFUSED jobs */}
      {jobData.session.status !== 'REFUSED' && (
      <div className="max-w-6xl mx-auto p-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'swipe')} className="mb-4">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              List Mode
            </TabsTrigger>
            <TabsTrigger value="swipe" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Swipe Mode
            </TabsTrigger>
          </TabsList>

          {/* List Mode */}
          <TabsContent value="list" className="mt-6">
            <div className="space-y-4">
              {jobData.steps.map((step, index) => {
                const stepProgress = jobData.stepProgress.find(p => p.job_step_id === step.id)
                const stepChecklistProgress = jobData.checklistProgress.filter(
                  cp => step.job_step_checklist.some(item => item.id === cp.checklist_item_id)
                )

                return (
                  <StepCard
                    key={step.id}
                    step={step}
                    stepNumber={index + 1}
                    totalSteps={totalSteps}
                    images={step.job_step_images}
                    checklistItems={step.job_step_checklist}
                    sessionId={sessionId}
                    stepProgress={stepProgress}
                    checklistProgress={stepChecklistProgress}
                    onToggleStep={handleToggleStep}
                    onToggleChecklistItem={handleToggleChecklistItem}
                    isListMode={true}
                  />
                )
              })}
            </div>
          </TabsContent>

          {/* Swipe Mode */}
          <TabsContent value="swipe" className="mt-6">
            {currentStep && (
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
                    variant="outline"
                    onClick={handlePreviousStep}
                    disabled={currentStepIndex === 0}
                    className="flex-1"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 whitespace-nowrap">
                    {currentStepIndex + 1} of {totalSteps}
                  </span>
                  <Button
                    variant="outline"
                    onClick={handleNextStep}
                    disabled={currentStepIndex === totalSteps - 1}
                    className="flex-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Complete Job Button */}
        {allStepsComplete && (
          <Card className="p-6 mt-6 bg-green-50 border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">All steps completed!</h3>
                <p className="text-sm text-green-700">Ready to mark this job as complete.</p>
              </div>
            </div>
            <Button
              onClick={() => setShowCompleteDialog(true)}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              Complete Job
            </Button>
          </Card>
        )}

        {!allStepsComplete && totalSteps > 0 && (
          <Card className="p-4 mt-6 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-900 text-center">
              Complete all steps to finish this job ({completedStepsCount}/{totalSteps} done)
            </p>
          </Card>
        )}
      </div>
      )}

      {/* Complete Job Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Job?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this job as complete? This action will notify the customer
              and allow them to submit a review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteJob}
              disabled={completing}
              className="bg-green-600 hover:bg-green-700"
            >
              {completing ? 'Completing...' : 'Complete Job'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
