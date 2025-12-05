'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const supabase = createClient()

  const { job_template, status, scheduled_date, scheduled_time } = jobSession
  const { job_code, title, address, customer } = job_template

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
        return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REFUSED':
        return 'bg-red-100 text-red-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-purple-100 text-purple-800'
      case 'EVALUATED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
              className="flex-1"
            >
              View
            </Button>
            <Button
              onClick={() => setShowCancelDialog(true)}
              variant="destructive"
              disabled={loading}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        )
      case 'APPROVED':
        return (
          <div className="space-y-2">
            <Button
              onClick={handleStartJob}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Starting...' : 'Start Job'}
            </Button>
            <Button
              onClick={() => setShowExchangeDialog(true)}
              variant="outline"
              disabled={loading}
              className="w-full"
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
            className="w-full"
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
            className="w-full"
          >
            View Details
          </Button>
        )
      case 'REFUSED':
        return (
          <Button
            onClick={handleViewDetails}
            variant="outline"
            className="w-full"
          >
            View Details
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-gray-600">{job_code}</span>
              <Badge className={getStatusColor(status)}>
                {status.replace('_', ' ')}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-2">
        {customer && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4" />
            <span>{customer.full_name}</span>
          </div>
        )}

        {address && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span>{address}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(scheduled_date)}</span>
        </div>

        {scheduled_time && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{formatTime(scheduled_time)}</span>
          </div>
        )}
      </CardContent>

      {renderActionButtons() && (
        <CardFooter className="pt-3">
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
