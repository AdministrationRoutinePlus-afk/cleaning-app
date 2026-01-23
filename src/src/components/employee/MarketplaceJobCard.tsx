'use client'

import { ChevronDown, Clock, DollarSign, Calendar, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { JobSession, JobTemplate, Customer } from '@/types/database'

interface MarketplaceJobCardProps {
  jobSession: JobSession & {
    job_template: JobTemplate & {
      customer: Customer | null
    }
  }
  onClaim: () => void
  onSkip: () => void
  isExpanded: boolean
  onToggleExpand: () => void
}

export function MarketplaceJobCard({
  jobSession,
  onClaim,
  onSkip,
  isExpanded,
  onToggleExpand
}: MarketplaceJobCardProps) {
  const { job_template } = jobSession

  // Guard against null job_template
  if (!job_template) {
    return (
      <div className="bg-white/10 rounded-xl p-4 text-center text-gray-500 border border-white/20">
        Job data unavailable
      </div>
    )
  }

  // Format duration
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '—'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h${mins}m`
  }

  // Format price
  const formatPrice = (price: number | null) => {
    if (!price) return '—'
    return `$${price.toFixed(0)}`
  }

  // Format time window
  const formatTimeWindow = () => {
    const start = job_template.time_window_start
    const end = job_template.time_window_end
    if (!start && !end) return 'Flexible'
    return `${start?.slice(0, 5) || '—'} - ${end?.slice(0, 5) || '—'}`
  }

  // Get customer name from the nested customer object
  const customerName = job_template.customer?.full_name || job_template.customer?.customer_code || ''

  return (
    <div
      className={`bg-white/10 rounded-2xl border overflow-hidden ${
        isExpanded ? 'border-blue-500/50' : 'border-white/10'
      }`}
    >
      {/* Collapsed View - Always Visible */}
      <div className="p-4">
        <div className="space-y-2">
          {/* Header - Customer name centered */}
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg px-3 py-2 flex items-center justify-center border border-white/10">
            <p className="text-white font-bold text-base">{customerName}</p>
          </div>

          {/* Row 1: Job & Duration */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-gray-300 text-xs">Job</p>
                <p className="text-white font-semibold text-sm">{job_template.title}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-gray-300 text-xs">Duration</p>
                <p className="text-white font-semibold text-sm">{formatDuration(job_template.duration_minutes)}</p>
              </div>
            </div>
          </div>

          {/* Row 2: Time Window & Hourly Rate */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-gray-300 text-xs">Time Window</p>
                <p className="text-white font-semibold text-sm">{formatTimeWindow()}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-gray-300 text-xs">Hourly Rate</p>
                <p className="text-white font-semibold text-sm">{formatPrice(job_template.price_per_hour)}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onToggleExpand}
              className="bg-white/5 border-white/20 text-gray-300 hover:bg-white/10"
            >
              <ChevronDown className={`w-4 h-4 mr-1 ${isExpanded ? 'rotate-180' : ''}`} />
              {isExpanded ? 'Less' : 'More'}
            </Button>
            <Button
              onClick={onClaim}
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              Claim Job
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/10 pt-3">
          {/* Schedule Info */}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Scheduled</p>
            <p className="text-white font-semibold text-sm">
              {jobSession.scheduled_date
                ? new Date(jobSession.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })
                : 'Flexible'}
            </p>
          </div>

          {/* Description */}
          {job_template.description && (
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Description</p>
              <p className="text-white text-sm">{job_template.description}</p>
            </div>
          )}

          {/* Address */}
          {job_template.address && (
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Location</p>
              <p className="text-white text-sm">{job_template.address}</p>
            </div>
          )}

          {/* Skip Button */}
          <Button
            variant="outline"
            onClick={onSkip}
            className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
          >
            Not Interested
          </Button>
        </div>
      )}
    </div>
  )
}
