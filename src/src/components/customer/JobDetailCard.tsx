'use client'

import { useState } from 'react'
import { Clock, MapPin, CalendarDays, Repeat, ChevronDown } from 'lucide-react'
import type { JobTemplate, JobStep } from '@/types/database'
import { useTranslation } from '@/lib/i18n/useTranslation'

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
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const formatTime = (time: string | null) => {
    if (!time) return '—'
    return time.slice(0, 5)
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '—'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  const dayLabels: Record<string, string> = {
    MON: t('Monday').slice(0, 3),
    TUE: t('Tuesday').slice(0, 3),
    WED: t('Wednesday').slice(0, 3),
    THU: t('Thursday').slice(0, 3),
    FRI: t('Friday').slice(0, 3),
    SAT: t('Saturday').slice(0, 3),
    SUN: t('Sunday').slice(0, 3)
  }

  const getStatusBadge = () => {
    if (jobTemplate.status === 'ACTIVE') {
      return 'bg-green-500/20 text-green-300 border border-green-500/30'
    }
    return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-white/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-gray-800/80 text-white font-bold text-xs px-3 py-1.5 rounded-full border border-white/30">
            {jobTemplate.job_code}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge()}`}>
            {jobTemplate.status}
          </span>
        </div>
        <h3 className="text-xl font-bold text-white leading-tight">{jobTemplate.title}</h3>
        {jobTemplate.description && (
          <p className="text-sm text-gray-300 mt-1">{jobTemplate.description}</p>
        )}
      </div>

      {/* Info Grid */}
      <div className="px-4 pb-3 space-y-3">
        {/* Duration & Time Window */}
        <div className="grid grid-cols-2 gap-3">
          {jobTemplate.duration_minutes && (
            <div className="bg-gray-800/60 rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-5 h-5 text-blue-400" />
                <p className="text-gray-400 text-xs uppercase font-bold tracking-wide">{t('Duration')}</p>
              </div>
              <p className="text-white font-bold text-lg">{formatDuration(jobTemplate.duration_minutes)}</p>
            </div>
          )}

          {jobTemplate.time_window_start && jobTemplate.time_window_end && (
            <div className="bg-gray-800/60 rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-2 mb-1.5">
                <CalendarDays className="w-5 h-5 text-green-400" />
                <p className="text-gray-400 text-xs uppercase font-bold tracking-wide">{t('Time Window')}</p>
              </div>
              <p className="text-white font-bold text-lg">
                {(() => {
                  const dayMap: Record<string,string> = {'SUN':'Sunday','MON':'Monday','TUE':'Tuesday','WED':'Wednesday','THU':'Thursday','FRI':'Friday','SAT':'Saturday'}
                  const startDay = jobTemplate.window_start_day ? t(dayMap[jobTemplate.window_start_day] || '') : ''
                  const endDay = jobTemplate.window_end_day ? t(dayMap[jobTemplate.window_end_day] || '') : ''
                  return `${startDay} ${formatTime(jobTemplate.time_window_start)} - ${endDay} ${formatTime(jobTemplate.time_window_end)}`.trim()
                })()}
              </p>
            </div>
          )}
        </div>

        {/* Frequency */}
        {jobTemplate.is_recurring && (
          <div className="bg-gray-800/60 rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-2 mb-1.5">
              <Repeat className="w-5 h-5 text-purple-400" />
              <p className="text-gray-400 text-xs uppercase font-bold tracking-wide">{t('Frequency')}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white font-bold text-lg">
                {jobTemplate.frequency_per_week}x {t('per week')}
              </p>
              {jobTemplate.available_days && jobTemplate.available_days.length > 0 && (
                <div className="flex gap-1">
                  {jobTemplate.available_days.map((day) => (
                    <span key={day} className="bg-white/10 text-gray-200 px-1.5 py-0.5 rounded text-xs font-semibold">
                      {dayLabels[day] || day}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Address */}
        {jobTemplate.address && (
          <div className="bg-gray-800/60 rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-2 mb-1.5">
              <MapPin className="w-5 h-5 text-red-400" />
              <p className="text-gray-400 text-xs uppercase font-bold tracking-wide">{t('Address')}</p>
            </div>
            <p className="text-white font-bold text-lg">{jobTemplate.address}</p>
          </div>
        )}

        {/* Session Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 rounded-xl p-4 text-center border border-blue-500/30">
            <p className="text-blue-300 text-xs uppercase font-bold tracking-wide mb-1">{t('Upcoming')}</p>
            <p className="text-white font-bold text-3xl">{upcomingSessions}</p>
          </div>
          <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 rounded-xl p-4 text-center border border-green-500/30">
            <p className="text-green-300 text-xs uppercase font-bold tracking-wide mb-1">{t('Completed')}</p>
            <p className="text-white font-bold text-3xl">{completedSessions}</p>
          </div>
        </div>

        {/* Upcoming Session Dates */}
        {upcomingSessionDates.length > 0 && (
          <div className="bg-gray-800/60 rounded-xl p-4 border border-white/20">
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarDays className="w-5 h-5 text-blue-400" />
              <p className="text-gray-400 text-xs uppercase font-bold tracking-wide">{t('Upcoming Sessions')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {upcomingSessionDates.map((session, idx) => {
                const date = new Date(session.scheduled_date + 'T00:00:00')
                const formatted = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                return (
                  <span
                    key={idx}
                    className="bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg text-sm font-semibold"
                  >
                    {formatted}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Job Steps */}
        {jobTemplate.job_steps && jobTemplate.job_steps.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? t('Hide') : t('Show')} {t('Job Steps')} ({jobTemplate.job_steps.length})
            </button>

            {expanded && (
              <div className="mt-3 space-y-2">
                {jobTemplate.job_steps
                  .sort((a, b) => a.step_order - b.step_order)
                  .map((step, index) => (
                    <div key={step.id} className="bg-gray-800/60 border border-white/20 rounded-xl p-3">
                      <h4 className="text-sm font-bold text-white">
                        {t('Step')} {index + 1}: {step.title}
                      </h4>
                      {step.description && (
                        <p className="text-sm text-gray-300 mt-1">{step.description}</p>
                      )}
                      {step.products_needed && (
                        <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-lg mt-2">
                          <p className="text-xs font-bold text-blue-300 mb-1">
                            {t('Products Needed')}:
                          </p>
                          <p className="text-sm text-blue-200">{step.products_needed}</p>
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
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl">
            <p className="text-xs font-bold text-yellow-300 mb-1">{t('Notes')}:</p>
            <p className="text-sm text-yellow-200">{jobTemplate.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
