'use client'

import type { JobSessionFull } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface JobSessionCardProps {
  session: JobSessionFull
}

export function JobSessionCard({ session }: JobSessionCardProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      OFFERED: 'bg-blue-100 text-blue-800 border-blue-200',
      CLAIMED: 'bg-purple-100 text-purple-800 border-purple-200',
      APPROVED: 'bg-green-100 text-green-800 border-green-200',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      COMPLETED: 'bg-gray-100 text-gray-800 border-gray-200',
      EVALUATED: 'bg-teal-100 text-teal-800 border-teal-200',
      CANCELLED: 'bg-red-100 text-red-800 border-red-200',
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return ''
    // timeString is in HH:MM:SS format
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-mono text-gray-500 truncate">
                {session.full_job_code || session.session_code}
              </span>
              <Badge
                variant="outline"
                className={getStatusColor(session.status)}
              >
                {session.status}
              </Badge>
            </div>
            <CardTitle className="text-lg truncate">
              {session.job_template.title}
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Schedule Info */}
        <div className="space-y-2">
          {(session.job_template.time_window_start || session.job_template.time_window_end) && session.scheduled_date && (
            <div className="bg-blue-50 p-2 rounded border border-blue-200">
              <p className="text-xs text-blue-700 font-medium mb-1">Time Window</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Start:</span>
                  <span className="text-gray-700 font-medium">
                    {formatDate(session.scheduled_date)}
                    {session.job_template.time_window_start && ` at ${formatTime(session.job_template.time_window_start)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">End:</span>
                  <span className="text-gray-700 font-medium">
                    {formatDate(session.scheduled_end_date || session.scheduled_date)}
                    {session.job_template.time_window_end && ` at ${formatTime(session.job_template.time_window_end)}`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Employee Info */}
        {session.employee && (
          <div>
            <p className="text-xs text-gray-500">Assigned to</p>
            <p className="text-sm font-medium">{session.employee.full_name}</p>
          </div>
        )}

        {/* Customer Info */}
        {session.job_template.customer && (
          <div>
            <p className="text-xs text-gray-500">Customer</p>
            <p className="text-sm">
              {session.job_template.customer.full_name} ({session.job_template.customer.customer_code})
            </p>
          </div>
        )}

        {/* Address */}
        {session.job_template.address && (
          <div>
            <p className="text-xs text-gray-500">Address</p>
            <p className="text-sm line-clamp-2">{session.job_template.address}</p>
          </div>
        )}

        {/* Pricing */}
        {(session.price_override || session.job_template.price_per_hour) && (
          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500">Rate</p>
            <p className="text-sm font-medium">
              ${session.price_override || session.job_template.price_per_hour}/hr
              {session.price_override && (
                <span className="text-xs text-orange-600 ml-1">(override)</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
