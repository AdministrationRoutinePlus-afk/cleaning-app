'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { JobSessionFull } from '@/types/database'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock, MapPin, User } from 'lucide-react'

interface MyJobCardProps {
  jobSession: JobSessionFull
  onStatusChange?: () => void
}

export function MyJobCard({ jobSession, onStatusChange }: MyJobCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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
      router.push(`/employee/jobs/${jobSession.id}/execute`)

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
    router.push(`/employee/jobs/${jobSession.id}/execute`)
  }

  // Handle View Details button click
  const handleViewDetails = () => {
    router.push(`/employee/jobs/${jobSession.id}`)
  }

  // Render action button based on status
  const renderActionButton = () => {
    switch (status) {
      case 'APPROVED':
        return (
          <Button
            onClick={handleStartJob}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Starting...' : 'Start Job'}
          </Button>
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

      {renderActionButton() && (
        <CardFooter className="pt-3">
          {renderActionButton()}
        </CardFooter>
      )}
    </Card>
  )
}
