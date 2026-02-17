'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { JobSessionFull, JobSplitStatus } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Calendar, CalendarRange, Clock, MapPin, User, X, ArrowLeftRight, Star, Users, Video, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SplitJobDialog } from '@/components/employee/SplitJobDialog'

interface MyJobCardProps {
  jobSession: JobSessionFull
  onStatusChange?: () => void
}

export function MyJobCard({ jobSession, onStatusChange }: MyJobCardProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showExchangeDialog, setShowExchangeDialog] = useState(false)
  const [showSplitDialog, setShowSplitDialog] = useState(false)
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [evalRating, setEvalRating] = useState<number | null>(null)
  const [splitStatus, setSplitStatus] = useState<JobSplitStatus | null>(null)
  const [splitPartnerName, setSplitPartnerName] = useState<string | null>(null)
  const [splitPartnerMinutes, setSplitPartnerMinutes] = useState<number | null>(null)
  const [splitId, setSplitId] = useState<string | null>(null)
  const [splitRequestedBy, setSplitRequestedBy] = useState<string | null>(null)
  const [cancelingSplit, setCancelingSplit] = useState(false)
  const [showCancelSplitDialog, setShowCancelSplitDialog] = useState(false)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const { job_template, status, scheduled_date, scheduled_time } = jobSession

  // Fetch evaluation rating for EVALUATED sessions
  useEffect(() => {
    if (status === 'EVALUATED') {
      supabase
        .from('evaluations')
        .select('rating')
        .eq('job_session_id', jobSession.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setEvalRating(data.rating)
        })
    }

    // Load current employee ID for split feature
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('employees').select('id').eq('user_id', user.id).single()
          .then(({ data }) => { if (data) setCurrentEmployeeId(data.id) })
      }
    })

    // Load split request status for this job session
    supabase
      .from('job_splits')
      .select('id, status, partner_minutes, requested_by, partner_id, requested_by_employee:employees!job_splits_requested_by_fkey(full_name), partner_employee:employees!job_splits_partner_id_fkey(full_name)')
      .eq('job_session_id', jobSession.id)
      .in('status', ['PENDING_PARTNER', 'PENDING_EMPLOYER', 'APPROVED'])
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSplitStatus(data.status as JobSplitStatus)
          setSplitPartnerMinutes(data.partner_minutes)
          setSplitId(data.id)
          setSplitRequestedBy(data.requested_by)
          const partner = data.partner_employee as unknown as { full_name: string } | null
          const requester = data.requested_by_employee as unknown as { full_name: string } | null
          setSplitPartnerName(partner?.full_name || requester?.full_name || null)
        }
      })
  }, [jobSession.id, status])
  const { job_code, title, address, customer, image_url, video_url, pptx_url } = job_template
  const hasImage = image_url && !imageError

  // Check if current time is within the job's time window
  const isWithinTimeWindow = () => {
    if (!scheduled_date) return false

    const now = new Date()
    const jobStartDate = new Date(scheduled_date)
    const jobEndDate = jobSession.scheduled_end_date
      ? new Date(jobSession.scheduled_end_date)
      : new Date(scheduled_date)

    // If job has time window, check times
    if (job_template.time_window_start && job_template.time_window_end) {
      const [startHours, startMinutes] = job_template.time_window_start.split(':').map(Number)
      const [endHours, endMinutes] = job_template.time_window_end.split(':').map(Number)

      // Set start datetime
      const startDateTime = new Date(jobStartDate)
      startDateTime.setHours(startHours, startMinutes, 0, 0)

      // Set end datetime
      const endDateTime = new Date(jobEndDate)
      endDateTime.setHours(endHours, endMinutes, 0, 0)

      // Check if current time is within the window
      return now >= startDateTime && now <= endDateTime
    }

    // If no time window specified, check if it's the same day
    const todayDateStr = now.toDateString()
    const jobDateStr = jobStartDate.toDateString()
    return todayDateStr === jobDateStr
  }

  const canStartJob = isWithinTimeWindow()

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('Not scheduled')
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Format time for display
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return ''
    return timeStr
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CLAIMED':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
      case 'APPROVED':
        return 'bg-green-500/20 text-green-300 border border-green-500/30'
      case 'REFUSED':
        return 'bg-red-500/20 text-red-300 border border-red-500/30'
      case 'IN_PROGRESS':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
      case 'COMPLETED':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
      case 'EVALUATED':
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
      case 'MISSED':
        return 'bg-red-600/30 text-red-300 border border-red-500/50'
      case 'OVERDUE':
        return 'bg-red-600/30 text-red-300 border border-red-500/50'
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  // Handle Cancel Interest - remove claim from pending job
  const handleCancelInterest = async () => {
    setLoading(true)
    try {
      // Set the job session back to OFFERED and remove assignment
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'OFFERED',
          assigned_to: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobSession.id)

      if (error) throw error

      if (onStatusChange) {
        onStatusChange()
      }
    } catch (error) {
      console.error('Error canceling interest:', error)
      toast.error(t('Failed to cancel. Please try again.'))
    } finally {
      setLoading(false)
      setShowCancelDialog(false)
    }
  }

  // Handle Request Exchange - post job to exchange board
  const handleRequestExchange = async () => {
    setLoading(true)
    try {
      // Get current employee ID
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employee) throw new Error('Employee not found')

      // Create exchange request
      const { error } = await supabase
        .from('job_exchanges')
        .insert({
          job_session_id: jobSession.id,
          from_employee_id: employee.id,
          status: 'PENDING'
        })

      if (error) throw error

      toast.success(t('Job posted to exchange board! Other employees can now request it.'))

      if (onStatusChange) {
        onStatusChange()
      }
    } catch (error) {
      console.error('Error requesting exchange:', error)
      toast.error(t('Failed to request exchange. Please try again.'))
    } finally {
      setLoading(false)
      setShowExchangeDialog(false)
    }
  }

  // Handle Start Job button click
  const handleStartJob = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('job_sessions')
        .update({
          status: 'IN_PROGRESS',
          started_at: new Date().toISOString()
        })
        .eq('id', jobSession.id)

      if (error) throw error

      // Redirect to step-by-step execution page
      router.push(`/employee/jobs/${jobSession.id}`)

      // Trigger refresh if callback provided
      if (onStatusChange) {
        onStatusChange()
      }
    } catch (error) {
      console.error('Error starting job:', error)
      toast.error(t('Failed to start job. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  // Handle View Steps button click
  const handleViewSteps = () => {
    router.push(`/employee/jobs/${jobSession.id}`)
  }

  // Handle View Details button click
  const handleViewDetails = () => {
    router.push(`/employee/jobs/${jobSession.id}`)
  }

  // Handle Cancel Split Request
  const handleCancelSplit = async () => {
    if (!splitId) return
    setCancelingSplit(true)
    try {
      const { error } = await supabase
        .from('job_splits')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', splitId)

      if (error) throw error

      toast.success(t('Split request cancelled'))
      setSplitStatus(null)
      setSplitId(null)
      setSplitRequestedBy(null)
      setSplitPartnerName(null)
      setSplitPartnerMinutes(null)
      if (onStatusChange) onStatusChange()
    } catch (error) {
      console.error('Error canceling split:', error)
      toast.error(t('Failed to cancel split request'))
    } finally {
      setCancelingSplit(false)
      setShowCancelSplitDialog(false)
    }
  }

  // Render action buttons based on status
  const renderActionButtons = () => {
    switch (status) {
      case 'CLAIMED': // Pending approval
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                onClick={handleViewDetails}
                className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/20"
              >
                {t('View')}
              </Button>
              <Button
                onClick={() => setShowCancelDialog(true)}
                disabled={loading}
                className="flex-1 bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
              >
                <X className="w-4 h-4 mr-1" />
                {t('Cancel')}
              </Button>
            </div>
            {currentEmployeeId && !splitStatus && (
              <Button
                onClick={() => setShowSplitDialog(true)}
                disabled={loading}
                className="w-full bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30"
              >
                <Users className="w-4 h-4 mr-1" />
                {t('Split Job')}
              </Button>
            )}
          </div>
        )
      case 'APPROVED':
        return (
          <div className="space-y-2">
            {!canStartJob && (
              <div className="text-xs text-amber-400 text-center p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
                {t('This job can only be started during its time window')}
              </div>
            )}
            <Button
              onClick={handleStartJob}
              disabled={loading || !canStartJob}
              className={`w-full ${
                canStartJob
                  ? 'bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30'
                  : 'bg-gray-500/10 border border-gray-500/30 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? t('Starting...') : t('Start Job')}
            </Button>
            {!jobSession.split_with && (
              <Button
                onClick={() => setShowExchangeDialog(true)}
                disabled={loading}
                className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20"
              >
                <ArrowLeftRight className="w-4 h-4 mr-1" />
                {t('Request Exchange')}
              </Button>
            )}
            {currentEmployeeId && !jobSession.split_with && !splitStatus && (
              <Button
                onClick={() => setShowSplitDialog(true)}
                disabled={loading}
                className="w-full bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30"
              >
                <Users className="w-4 h-4 mr-1" />
                {t('Split Job')}
              </Button>
            )}
            {jobSession.split_with && (
              <div className="text-xs text-purple-300 text-center p-2 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <Users className="w-3 h-3 inline mr-1" />
                {t('Split job - shared with teammate')}
              </div>
            )}
          </div>
        )
      case 'IN_PROGRESS':
        return (
          <Button
            onClick={handleViewSteps}
            className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20"
          >
            {t('View Steps')}
          </Button>
        )
      case 'COMPLETED':
      case 'EVALUATED':
        return (
          <Button
            onClick={handleViewDetails}
            className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20"
          >
            {t('View Details')}
          </Button>
        )
      case 'REFUSED':
        return (
          <Button
            onClick={handleViewDetails}
            className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20"
          >
            {t('View Details')}
          </Button>
        )
      case 'MISSED':
        return (
          <div className="space-y-2">
            <div className="text-xs text-red-400 text-center p-2 bg-red-500/10 rounded-lg border border-red-500/30">
              {t('This job was not started within its time window')}
            </div>
            <Button
              onClick={handleViewDetails}
              className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20"
            >
              {t('View Details')}
            </Button>
          </div>
        )
      case 'OVERDUE':
        return (
          <div className="space-y-2">
            <div className="text-xs text-red-400 text-center p-2 bg-red-500/10 rounded-lg border border-red-500/30">
              {t('This job was started but not completed within its time window')}
            </div>
            <Button
              onClick={handleViewDetails}
              className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20"
            >
              {t('View Details')}
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-white/20 rounded-xl relative overflow-hidden">
      {/* Background Image with dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black opacity-40">
        {hasImage ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gray-700" />
            )}
            <Image
              src={image_url}
              alt={title}
              fill
              className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-30' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <div className="text-8xl">
              🧹
            </div>
          </div>
        )}
      </div>

      {/* Content Overlay - Brightness degradation gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none"></div>

      <div className="p-4 pb-3 relative z-10">
        {/* Top Badge */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="inline-block bg-gray-800/80 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg border border-white/30">
            {job_code}
          </span>
          <Badge className={getStatusColor(status)}>
            {status.replace('_', ' ')}
          </Badge>
          {jobSession.scheduled_end_date && jobSession.scheduled_date &&
            jobSession.scheduled_end_date !== jobSession.scheduled_date && (
            <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <CalendarRange className="w-3 h-3 mr-1" />
              {t('Multi-day')}
            </Badge>
          )}
          {video_url && (
            <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Video className="w-3 h-3 mr-1" />
              {t('Video')}
            </Badge>
          )}
          {pptx_url && (
            <Badge className="bg-orange-500/20 text-orange-300 border border-orange-500/30">
              <FileSpreadsheet className="w-3 h-3 mr-1" />
              PPTX
            </Badge>
          )}
        </div>

        {/* Main Info */}
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white leading-tight drop-shadow-lg">
            {jobSession.full_job_code || `${job_code}-${jobSession.session_code}`} — {title}
          </h3>
          {customer && (
            <p className="text-gray-300 text-sm font-medium">
              {customer.full_name}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 space-y-3 relative z-10">
        {/* Duration & Pay Rate Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Duration */}
          {job_template.duration_minutes && (
            <div className="bg-gray-800/60 rounded-xl p-3 text-center border border-white/20">
              <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">{t('Duration')}</p>
              <p className="text-white font-bold text-base">
                {Math.floor(job_template.duration_minutes / 60)}h {job_template.duration_minutes % 60}m
              </p>
            </div>
          )}

          {/* Pay Rate */}
          {job_template.price_per_hour && (
            <div className="bg-gradient-to-br from-yellow-900/40 to-orange-900/40 rounded-xl p-3 text-center border border-yellow-500/40">
              <p className="text-yellow-300 text-[10px] uppercase font-bold mb-1">{t('Pay Rate')}</p>
              <p className="text-white font-bold text-base">
                ${job_template.price_per_hour.toFixed(2)}/hr
              </p>
            </div>
          )}
        </div>

        {/* Start & End Date/Time - Combined */}
        {scheduled_date && (job_template.time_window_start || job_template.time_window_end) && (
          <div className="bg-gray-800/60 rounded-xl p-3 border border-white/20">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">{t('Start')}</p>
                <p className="text-white font-bold text-sm">
                  {formatDate(scheduled_date)}
                </p>
                <p className="text-white font-bold text-base">
                  {job_template.time_window_start ? job_template.time_window_start.slice(0, 5) : '—'}
                </p>
              </div>
              <div className="text-center border-l border-white/20 pl-4">
                <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">{t('End')}</p>
                <p className="text-white font-bold text-sm">
                  {formatDate(jobSession.scheduled_end_date || scheduled_date)}
                </p>
                <p className="text-white font-bold text-base">
                  {job_template.time_window_end ? job_template.time_window_end.slice(0, 5) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Address */}
        {address && (
          <div className="bg-gray-800/60 rounded-xl p-3 border border-white/20">
            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">{t('Location')}</p>
            <p className="text-white text-sm">{address}</p>
          </div>
        )}
      </div>

      {/* Split Status Banner */}
      {splitStatus && splitStatus !== 'APPROVED' && (
        <div className="px-4 pb-2 relative z-10">
          <div className={`rounded-xl p-3 border ${
            splitStatus === 'PENDING_PARTNER'
              ? 'bg-purple-500/10 border-purple-500/30'
              : 'bg-blue-500/10 border-blue-500/30'
          }`}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div className="flex-1">
                <p className={`text-xs font-medium ${
                  splitStatus === 'PENDING_PARTNER' ? 'text-purple-300' : 'text-blue-300'
                }`}>
                  {splitStatus === 'PENDING_PARTNER'
                    ? `${t('Split requested')} — ${t('Waiting for')} ${splitPartnerName || t('teammate')}`
                    : `${t('Split requested')} — ${t('Waiting for employer approval')}`
                  }
                </p>
                {splitPartnerMinutes && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {t('Teammate')}: {Math.floor(splitPartnerMinutes / 60)}h{splitPartnerMinutes % 60 > 0 ? `${splitPartnerMinutes % 60}m` : ''}
                  </p>
                )}
              </div>
              {/* Cancel Split button - only for the requester */}
              {currentEmployeeId && splitRequestedBy === currentEmployeeId && (splitStatus === 'PENDING_PARTNER' || splitStatus === 'PENDING_EMPLOYER') && (
                <Button
                  onClick={() => setShowCancelSplitDialog(true)}
                  disabled={cancelingSplit}
                  size="sm"
                  className="bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 text-xs px-2 py-1 h-auto"
                >
                  <X className="w-3 h-3 mr-1" />
                  {t('Cancel')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Rating for EVALUATED sessions */}
      {status === 'EVALUATED' && evalRating && (
        <div className="px-4 pb-2 relative z-10">
          <div className="bg-gradient-to-br from-yellow-900/30 to-amber-900/20 rounded-xl p-3 border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-gray-300">{t('Customer Review')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`text-lg ${star <= evalRating ? 'text-yellow-400' : 'text-gray-600'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-white font-bold text-sm ml-1">{evalRating}/5</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {(() => {
        const actionButtons = renderActionButtons()
        return actionButtons ? (
          <div className="px-4 pb-4 pt-3 relative z-10">
            {actionButtons}
          </div>
        ) : null
      })()}

      {/* Cancel Interest Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('Cancel Interest?')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              {t('Are you sure you want to cancel your interest in this job? The job will go back to the marketplace for other employees.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading} className="bg-white/10 text-white border border-white/20 hover:bg-white/20">{t('Keep Job')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInterest}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? t('Canceling...') : t('Yes, Cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request Exchange Dialog */}
      <AlertDialog open={showExchangeDialog} onOpenChange={setShowExchangeDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('Request Exchange?')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              {t('This will post the job to the exchange board. Other employees can request to take over this job. The exchange requires employer approval.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading} className="bg-white/10 text-white border border-white/20 hover:bg-white/20">{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestExchange}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? t('Posting...') : t('Post to Exchange')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Split Job Dialog */}
      {currentEmployeeId && (
        <SplitJobDialog
          open={showSplitDialog}
          onOpenChange={setShowSplitDialog}
          jobSessionId={jobSession.id}
          currentEmployeeId={currentEmployeeId}
          totalDurationMinutes={job_template?.duration_minutes ?? null}
          onSuccess={onStatusChange}
        />
      )}

      {/* Cancel Split Dialog */}
      <AlertDialog open={showCancelSplitDialog} onOpenChange={setShowCancelSplitDialog}>
        <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('Cancel Split Request?')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              {t('Are you sure you want to cancel this split request? The partner will no longer be involved in this job.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelingSplit} className="bg-white/10 text-white border border-white/20 hover:bg-white/20">{t('Keep Split')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSplit}
              disabled={cancelingSplit}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelingSplit ? t('Canceling...') : t('Yes, Cancel Split')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
