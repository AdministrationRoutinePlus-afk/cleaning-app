'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { JobSessionFull } from '@/types/database'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock, MapPin, User, X, ArrowLeftRight } from 'lucide-react'
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

interface MyJobCardProps {
  jobSession: JobSessionFull
  onStatusChange?: () => void
}

export function MyJobCard({ jobSession, onStatusChange }: MyJobCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showExchangeDialog, setShowExchangeDialog] = useState(false)
  const [imageError, setImageError] = useState(false)
  const supabase = createClient()

  const { job_template, status, scheduled_date, scheduled_time } = jobSession
  const { job_code, title, address, customer, image_url } = job_template
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
    if (!dateStr) return 'Not scheduled'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
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
      alert('Failed to cancel. Please try again.')
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

      alert('Job posted to exchange board! Other employees can now request it.')

      if (onStatusChange) {
        onStatusChange()
      }
    } catch (error) {
      console.error('Error requesting exchange:', error)
      alert('Failed to request exchange. Please try again.')
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
      alert('Failed to start job. Please try again.')
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

  // Render action buttons based on status
  const renderActionButtons = () => {
    switch (status) {
      case 'CLAIMED': // Pending approval
        return (
          <div className="flex gap-2">
            <Button
              onClick={handleViewDetails}
              variant="outline"
              className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              View
            </Button>
            <Button
              onClick={() => setShowCancelDialog(true)}
              variant="destructive"
              disabled={loading}
              className="flex-1 bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        )
      case 'APPROVED':
        return (
          <div className="space-y-2">
            {!canStartJob && (
              <div className="text-xs text-amber-400 text-center p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
                ⏰ This job can only be started during its time window
              </div>
            )}
            <Button
              onClick={handleStartJob}
              disabled={loading || !canStartJob}
              className={`w-full ${
                canStartJob
                  ? 'bg-green-500/20 border-green-500/30 text-green-300 hover:bg-green-500/30'
                  : 'bg-gray-500/10 border-gray-500/30 text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? 'Starting...' : 'Start Job'}
            </Button>
            <Button
              onClick={() => setShowExchangeDialog(true)}
              variant="outline"
              disabled={loading}
              className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <ArrowLeftRight className="w-4 h-4 mr-1" />
              Request Exchange
            </Button>
          </div>
        )
      case 'IN_PROGRESS':
        return (
          <Button
            onClick={handleViewSteps}
            variant="outline"
            className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            View Steps
          </Button>
        )
      case 'COMPLETED':
      case 'EVALUATED':
        return (
          <Button
            onClick={handleViewDetails}
            variant="outline"
            className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            View Details
          </Button>
        )
      case 'REFUSED':
        return (
          <Button
            onClick={handleViewDetails}
            variant="outline"
            className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            View Details
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <Card className="w-full !bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20 relative overflow-hidden">
      {/* Background Image with dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black opacity-40">
        {hasImage ? (
          <Image
            src={image_url}
            alt={title}
            fill
            className="object-cover opacity-30"
            onError={() => setImageError(true)}
          />
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

      <CardHeader className="pb-3 relative z-10">
        {/* Top Badge */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="inline-block bg-gray-800/80 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg border border-white/30">
            {job_code}
          </span>
          <Badge className={getStatusColor(status)}>
            {status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Main Info */}
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-white leading-tight drop-shadow-lg">{title}</h3>
          {customer && (
            <p className="text-gray-300 text-sm font-medium">
              {customer.full_name}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3 relative z-10">
        {/* Duration & Pay Rate Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Duration */}
          {job_template.duration_minutes && (
            <div className="bg-gray-800/60 rounded-xl p-3 text-center border border-white/20">
              <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Duration</p>
              <p className="text-white font-bold text-base">
                {Math.floor(job_template.duration_minutes / 60)}h {job_template.duration_minutes % 60}m
              </p>
            </div>
          )}

          {/* Pay Rate */}
          {job_template.price_per_hour && (
            <div className="bg-gradient-to-br from-yellow-900/40 to-orange-900/40 rounded-xl p-3 text-center border border-yellow-500/40">
              <p className="text-yellow-300 text-[10px] uppercase font-bold mb-1">Pay Rate</p>
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
                <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Start</p>
                <p className="text-white font-bold text-sm">
                  {formatDate(scheduled_date)}
                </p>
                <p className="text-white font-bold text-base">
                  {job_template.time_window_start ? job_template.time_window_start.slice(0, 5) : '—'}
                </p>
              </div>
              <div className="text-center border-l border-white/20 pl-4">
                <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">End</p>
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
            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Location</p>
            <p className="text-white text-sm">{address}</p>
          </div>
        )}
      </CardContent>

      {renderActionButtons() && (
        <CardFooter className="pt-3 relative z-10">
          {renderActionButtons()}
        </CardFooter>
      )}

      {/* Cancel Interest Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Interest?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your interest in this job?
              The job will go back to the marketplace for other employees.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Keep Job</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInterest}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Canceling...' : 'Yes, Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request Exchange Dialog */}
      <AlertDialog open={showExchangeDialog} onOpenChange={setShowExchangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Exchange?</AlertDialogTitle>
            <AlertDialogDescription>
              This will post the job to the exchange board. Other employees can request to take over this job.
              The exchange requires employer approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestExchange}
              disabled={loading}
            >
              {loading ? 'Posting...' : 'Post to Exchange'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
