'use client'

import type { JobSessionFull } from '@/types/database'
import { Badge } from '@/components/ui/badge'

interface JobSessionCardProps {
  session: JobSessionFull
}

export function JobSessionCard({ session }: JobSessionCardProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      OFFERED: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
      CLAIMED: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      APPROVED: 'bg-green-500/20 text-green-300 border border-green-500/30',
      IN_PROGRESS: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
      COMPLETED: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
      EVALUATED: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
      CANCELLED: 'bg-red-500/20 text-red-300 border border-red-500/30',
    }
    return colors[status as keyof typeof colors] || 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
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
    <div className="bg-white/5 rounded-xl border border-white/10 hover:bg-white/[0.07] transition-colors">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-mono text-gray-500 truncate">
                {session.full_job_code || session.session_code}
              </span>
              <Badge
                className={getStatusColor(session.status)}
              >
                {session.status}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold text-white truncate">
              {session.job_template.title}
            </h3>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Schedule Info */}
        <div className="space-y-2">
          {(session.job_template.time_window_start || session.job_template.time_window_end) && session.scheduled_date && (
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-xs text-blue-400 font-medium mb-1">Time Window</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Start:</span>
                  <span className="text-gray-300 font-medium">
                    {formatDate(session.scheduled_date)}
                    {session.job_template.time_window_start && ` at ${formatTime(session.job_template.time_window_start)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">End:</span>
                  <span className="text-gray-300 font-medium">
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
            <p className="text-sm font-medium text-gray-200">{session.employee.full_name}</p>
          </div>
        )}

        {/* Customer Info */}
        {session.job_template.customer && (
          <div>
            <p className="text-xs text-gray-500">Customer</p>
            <p className="text-sm text-gray-300">
              {session.job_template.customer.full_name} ({session.job_template.customer.customer_code})
            </p>
          </div>
        )}

        {/* Address */}
        {session.job_template.address && (
          <div>
            <p className="text-xs text-gray-500">Address</p>
            <p className="text-sm text-gray-300 line-clamp-2">{session.job_template.address}</p>
          </div>
        )}

        {/* Pricing */}
        {(session.price_override || session.job_template.price_per_hour) && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-gray-500">Rate</p>
            <p className="text-sm font-medium text-gray-200">
              ${session.price_override || session.job_template.price_per_hour}/hr
              {session.price_override && (
                <span className="text-xs text-orange-400 ml-1">(override)</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
