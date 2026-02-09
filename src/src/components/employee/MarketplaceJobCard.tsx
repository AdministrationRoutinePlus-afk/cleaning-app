'use client'

import { parseISO } from 'date-fns'
import { ChevronDown, Clock, DollarSign, Calendar, FileText, Video, FileSpreadsheet, CalendarRange } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { JobSession, JobTemplate, Customer } from '@/types/database'
import { useTranslation } from '@/lib/i18n/useTranslation'

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
  const { t } = useTranslation()
  const { job_template } = jobSession

  // Guard against null job_template
  if (!job_template) {
    return (
      <div className="bg-white/10 rounded-xl p-4 text-center text-gray-500 border border-white/20">
        {t('Job data unavailable')}
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
    if (!start && !end) return t('Flexible')
    return `${start?.slice(0, 5) || '—'} - ${end?.slice(0, 5) || '—'}`
  }

  // Get customer name from the nested customer object
  const customerName = job_template.customer?.full_name || job_template.customer?.customer_code || ''

  // Multi-day detection
  const isMultiDay = jobSession.scheduled_date && jobSession.scheduled_end_date &&
    jobSession.scheduled_end_date !== jobSession.scheduled_date

  // Format date range for multi-day jobs
  const formatDateRange = () => {
    if (!jobSession.scheduled_date) return t('Flexible')
    const start = parseISO(jobSession.scheduled_date)
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (isMultiDay) {
      const end = parseISO(jobSession.scheduled_end_date!)
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `${startStr} → ${endStr}`
    }
    return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

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
            {isMultiDay && (
              <Badge className="ml-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <CalendarRange className="w-3 h-3 mr-1" />
                {t('Multi-day')}
              </Badge>
            )}
          </div>

          {/* Row 1: Job & Duration */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-gray-300 text-xs">{t('Job')}</p>
                <p className="text-white font-semibold text-sm">{job_template.title}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-gray-300 text-xs">{t('Duration')}</p>
                <p className="text-white font-semibold text-sm">{formatDuration(job_template.duration_minutes)}</p>
              </div>
            </div>
          </div>

          {/* Row 2: Time Window & Hourly Rate */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-gray-300 text-xs">{t('Time Window')}</p>
                <p className="text-white font-semibold text-sm">{formatTimeWindow()}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-gray-300 text-xs">{t('Hourly Rate')}</p>
                <p className="text-white font-semibold text-sm">{formatPrice(job_template.price_per_hour)}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onToggleExpand}
              className="bg-white/5 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <ChevronDown className={`w-4 h-4 mr-1 ${isExpanded ? 'rotate-180' : ''}`} />
              {isExpanded ? t('Less') : t('More')}
            </Button>
            <Button
              onClick={onClaim}
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              {t('Claim Job')}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/10 pt-3">
          {/* Schedule Info */}
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">{t('Scheduled')}</p>
            <p className="text-white font-semibold text-sm">
              {formatDateRange()}
            </p>
          </div>

          {/* Description */}
          {job_template.description && (
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">{t('Description')}</p>
              <p className="text-white text-sm">{job_template.description}</p>
            </div>
          )}

          {/* Address */}
          {job_template.address && (
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">{t('Location')}</p>
              <p className="text-white text-sm">{job_template.address}</p>
            </div>
          )}

          {/* Video Player */}
          {job_template.video_url && (
            <div className="bg-white/5 rounded-lg overflow-hidden">
              <video
                controls
                playsInline
                className="w-full max-h-48 bg-black"
                preload="metadata"
              >
                <source src={job_template.video_url} type="video/mp4" />
                <source src={job_template.video_url} type="video/webm" />
              </video>
            </div>
          )}

          {/* PPTX Procedures */}
          {job_template.pptx_url && (
            <a
              href={job_template.pptx_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-lg px-3 py-2 text-sm font-medium hover:bg-orange-500/30 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('View Procedures')}
            </a>
          )}

          {/* Skip Button */}
          <Button
            variant="outline"
            onClick={onSkip}
            className="w-full bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
          >
            {t('Not Interested')}
          </Button>
        </div>
      )}
    </div>
  )
}
