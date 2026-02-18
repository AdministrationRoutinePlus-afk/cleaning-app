'use client'

import { useState, useEffect, useRef } from 'react'
import { parseISO } from 'date-fns'
import { ChevronDown, Clock, DollarSign, Calendar, FileText, FileSpreadsheet, CalendarRange, CheckCircle, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { JobSession, JobTemplate, Customer } from '@/types/database'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { motion, useMotionValue, useTransform, useAnimation, PanInfo } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

interface MarketplaceJobCardProps {
  jobSession: JobSession & {
    job_template: JobTemplate & {
      customer: Customer | null
    }
  }
  employeeId?: string
  onClaim: () => void
  onSkip: () => void
  isExpanded: boolean
  onToggleExpand: () => void
}

export function MarketplaceJobCard({
  jobSession,
  employeeId,
  onClaim,
  onSkip,
  isExpanded,
  onToggleExpand
}: MarketplaceJobCardProps) {
  const { t } = useTranslation()
  const { job_template } = jobSession
  const [isDismissing, setIsDismissing] = useState(false)
  const [trainingStatus, setTrainingStatus] = useState<{ is_trained: boolean; can_coach: boolean } | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!employeeId || !job_template?.id) return
    const supabase = supabaseRef.current
    supabase
      .from('employee_job_training')
      .select('is_trained, can_coach')
      .eq('employee_id', employeeId)
      .eq('job_template_id', job_template.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setTrainingStatus(data)
      })
  }, [employeeId, job_template?.id])
  const x = useMotionValue(0)
  const controls = useAnimation()
  const skipOpacity = useTransform(x, [-200, -100, 0], [1, 0.5, 0])

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
    if (!minutes) return null
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  // Format price
  const formatPrice = (price: number | null) => {
    if (!price) return null
    return `$${price.toFixed(0)}/hr`
  }

  // Format time window with day names
  const formatTimeWindow = () => {
    const start = job_template.time_window_start
    const end = job_template.time_window_end
    if (!start && !end) return t('Flexible')
    const dayMap: Record<string,string> = {'SUN':'Sunday','MON':'Monday','TUE':'Tuesday','WED':'Wednesday','THU':'Thursday','FRI':'Friday','SAT':'Saturday'}
    const startDay = job_template.window_start_day ? t(dayMap[job_template.window_start_day] || '') : ''
    const endDay = job_template.window_end_day ? t(dayMap[job_template.window_end_day] || '') : ''
    const startStr = `${startDay} ${start?.slice(0, 5) || ''}`.trim() || '\u2014'
    const endStr = `${endDay} ${end?.slice(0, 5) || ''}`.trim() || '\u2014'
    return `${startStr} - ${endStr}`
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
    const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    if (isMultiDay) {
      const end = parseISO(jobSession.scheduled_end_date!)
      const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      return `${startStr} \u2192 ${endStr}`
    }
    return start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -150) {
      setIsDismissing(true)
      await controls.start({ x: -500, opacity: 0, transition: { duration: 0.3 } })
      onSkip()
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 500, damping: 30 } })
    }
  }

  const payDisplay = formatPrice(job_template.price_per_hour)
  const durationDisplay = formatDuration(job_template.duration_minutes)

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* SKIP label behind card */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-8 bg-red-600/20 rounded-2xl"
        style={{ opacity: skipOpacity }}
      >
        <span className="text-red-400 font-bold text-lg">{t('SKIP')}</span>
      </motion.div>

      <motion.div
        style={{ x }}
        animate={controls}
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        className={`relative bg-white/10 rounded-2xl border overflow-hidden ${
          isExpanded ? 'border-blue-500/50' : 'border-white/10'
        } ${isDismissing ? 'pointer-events-none' : ''}`}
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

            {/* Training badges */}
            {employeeId && (
              <div className="flex items-center justify-center gap-1.5">
                {trainingStatus?.can_coach ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <Star className="w-3 h-3" />
                    {t('Coach')}
                  </span>
                ) : trainingStatus?.is_trained ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                    <CheckCircle className="w-3 h-3" />
                    {t('Trained')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-500 border border-gray-500/30">
                    {t('Not Trained')}
                  </span>
                )}
              </div>
            )}

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
                  <p className="text-white font-semibold text-sm">{formatDuration(job_template.duration_minutes) || '\u2014'}</p>
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
                  <p className="text-white font-semibold text-sm">{formatPrice(job_template.price_per_hour) || '\u2014'}</p>
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
      </motion.div>
    </div>
  )
}
