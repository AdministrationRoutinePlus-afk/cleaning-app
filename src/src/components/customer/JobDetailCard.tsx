'use client'

import { useState } from 'react'
import type { JobTemplate, JobStep } from '@/types/database'

interface UpcomingSessionDate {
  scheduled_date: string
  status: string
}

interface JobDetailCardProps {
  jobTemplate: JobTemplate & {
    job_steps: JobStep[]
  }
  upcomingSessions?: number
  completedSessions?: number
  upcomingSessionDates?: UpcomingSessionDate[]
}

export function JobDetailCard({ jobTemplate, upcomingSessions = 0, completedSessions = 0, upcomingSessionDates = [] }: JobDetailCardProps) {
  const [expanded, setExpanded] = useState(false)

  const formatTime = (time: string | null) => {
    if (!time) return 'N/A'
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}min`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}min`
  }

  const dayLabels: Record<string, string> = {
    MON: 'Mon',
    TUE: 'Tue',
    WED: 'Wed',
    THU: 'Thu',
    FRI: 'Fri',
    SAT: 'Sat',
    SUN: 'Sun'
  }

  const getStatusBadge = () => {
    if (jobTemplate.status === 'ACTIVE') {
      return 'bg-green-500/20 text-green-300 border border-green-500/30'
    }
    return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl">
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/10 text-gray-300 border border-white/20 px-2 py-0.5 rounded text-xs font-medium">
                {jobTemplate.job_code}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge()}`}>
                {jobTemplate.status}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white">{jobTemplate.title}</h3>
            {jobTemplate.description && (
              <p className="text-sm text-gray-300 mt-1">{jobTemplate.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Job Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          {jobTemplate.address && (
            <div>
              <p className="text-xs text-gray-500">Address</p>
              <p className="text-sm font-medium text-gray-200">{jobTemplate.address}</p>
            </div>
          )}

          {jobTemplate.duration_minutes && (
            <div>
              <p className="text-xs text-gray-500">Duration</p>
              <p className="text-sm font-medium text-gray-200">{formatDuration(jobTemplate.duration_minutes)}</p>
            </div>
          )}

          {jobTemplate.time_window_start && jobTemplate.time_window_end && (
            <div>
              <p className="text-xs text-gray-500">Time Window</p>
              <p className="text-sm font-medium text-gray-200">
                {formatTime(jobTemplate.time_window_start)} - {formatTime(jobTemplate.time_window_end)}
              </p>
            </div>
          )}

          {jobTemplate.is_recurring && (
            <div>
              <p className="text-xs text-gray-500">Frequency</p>
              <p className="text-sm font-medium text-gray-200">
                {jobTemplate.frequency_per_week}x per week
              </p>
            </div>
          )}
        </div>

        {/* Available Days */}
        {jobTemplate.available_days && jobTemplate.available_days.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Available Days</p>
            <div className="flex flex-wrap gap-1">
              {jobTemplate.available_days.map((day) => (
                <span key={day} className="bg-gray-500/20 text-gray-300 border border-gray-500/30 px-2 py-0.5 rounded text-xs">
                  {dayLabels[day] || day}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Session Stats */}
        <div className="flex gap-4 pt-3 border-t border-white/10">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-blue-400">{upcomingSessions}</p>
            <p className="text-xs text-gray-500">Upcoming</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-green-400">{completedSessions}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
        </div>

        {/* Upcoming Session Dates */}
        <div className="pt-3 border-t border-white/10">
          <p className="text-xs text-gray-500 mb-2">Upcoming Sessions</p>
          {upcomingSessionDates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {upcomingSessionDates.map((session, idx) => {
                const date = new Date(session.scheduled_date + 'T00:00:00')
                const formatted = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                return (
                  <span
                    key={idx}
                    className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-1 rounded text-xs"
                  >
                    {formatted}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming sessions scheduled</p>
          )}
        </div>

        {/* Job Steps */}
        {jobTemplate.job_steps && jobTemplate.job_steps.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              {expanded ? 'Hide' : 'Show'} Job Steps ({jobTemplate.job_steps.length})
            </button>

            {expanded && (
              <div className="mt-3 space-y-2">
                {jobTemplate.job_steps
                  .sort((a, b) => a.step_order - b.step_order)
                  .map((step, index) => (
                    <div key={step.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-white">
                        Step {index + 1}: {step.title}
                      </h4>
                      {step.description && (
                        <p className="text-sm text-gray-300 mt-1">{step.description}</p>
                      )}
                      {step.products_needed && (
                        <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded mt-2">
                          <p className="text-xs font-medium text-blue-300 mb-1">
                            Products Needed:
                          </p>
                          <p className="text-xs text-blue-200">{step.products_needed}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {jobTemplate.notes && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg">
            <p className="text-xs font-medium text-yellow-300 mb-1">Notes:</p>
            <p className="text-sm text-yellow-200">{jobTemplate.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
