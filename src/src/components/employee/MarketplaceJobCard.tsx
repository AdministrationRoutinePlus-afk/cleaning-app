'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import type { JobSession, JobTemplate, Customer } from '@/types/database'

interface MarketplaceJobCardProps {
  jobSession: JobSession & {
    job_template: JobTemplate & {
      customer: Customer | null
    }
  }
  onSwipe?: (direction: 'left' | 'right') => void
}

export function MarketplaceJobCard({ jobSession, onSwipe }: MarketplaceJobCardProps) {
  const { job_template } = jobSession
  const [imageError, setImageError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Guard against null job_template
  if (!job_template) {
    return (
      <div className="relative w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl overflow-hidden p-6 text-center text-gray-500">
        Job data unavailable
      </div>
    )
  }

  // Format duration
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'Duration not specified'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}min`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}min`
  }

  // Format time window
  const formatTimeWindow = (start: string | null, end: string | null) => {
    if (!start || !end) return 'Time not specified'
    return `${start} - ${end}`
  }

  // Format price
  const formatPrice = (price: number | null) => {
    if (!price) return 'Price not specified'
    return `$${price.toFixed(2)}/hr`
  }

  // Format available days
  const formatDays = (days: string[] | null) => {
    if (!days || days.length === 0) return null
    const dayMap: Record<string, string> = {
      'MON': 'Mon', 'TUE': 'Tue', 'WED': 'Wed', 'THU': 'Thu', 'FRI': 'Fri', 'SAT': 'Sat', 'SUN': 'Sun'
    }
    return days.map(d => dayMap[d] || d).join(', ')
  }

  // Format scheduled date and time
  const formatScheduledDate = (date: string | null) => {
    if (!date) return null
    const d = new Date(date + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Calculate end date and time based on duration
  const calculateEndDateTime = () => {
    if (!jobSession.scheduled_date || !job_template.time_window_start || !job_template.duration_minutes) {
      return { endDate: null, endTime: null }
    }

    const startDate = new Date(jobSession.scheduled_date + 'T' + job_template.time_window_start)
    const endDate = new Date(startDate.getTime() + job_template.duration_minutes * 60000)

    return {
      endDate: endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      endTime: endDate.toTimeString().slice(0, 5)
    }
  }

  const hasImage = job_template.image_url && !imageError
  const scheduledDateFormatted = formatScheduledDate(jobSession.scheduled_date)
  const daysFormatted = formatDays(job_template.available_days)
  const { endDate, endTime } = calculateEndDateTime()

  return (
    <motion.div
      className="relative w-full max-w-xs mx-auto bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl shadow-2xl overflow-hidden border border-gray-700/50"
      style={{ aspectRatio: '3/4' }}
      whileHover={{ scale: 1.02, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Job Image - Upper Right Box */}
      <div className="absolute top-3 right-3 w-[200px] h-[200px] rounded-lg border border-white/20 bg-gray-800/80 shadow-lg z-10 p-2">
        <div className="relative w-full h-full rounded overflow-hidden">
          {hasImage ? (
            <Image
              src={job_template.image_url!}
              alt={job_template.title}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/10 rounded">
              <span className="text-6xl">🧹</span>
            </div>
          )}
        </div>
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40 flex flex-col justify-end p-4">
        {/* Top Badge */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="inline-block bg-gray-800/80 text-white font-bold text-[10px] px-2 py-1 rounded-full shadow-lg border border-white/30">
            {job_template.job_code}
          </span>
        </div>

        {/* Main Info */}
        <div className="space-y-0.5 mb-3">
          <h2 className="text-lg font-bold text-white leading-tight drop-shadow-lg">
            {job_template.title}
          </h2>
          {job_template.customer && (
            <p className="text-gray-300 text-xs font-medium">
              {job_template.customer.full_name}
            </p>
          )}
        </div>

        {/* Key Info - Uniform Style */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* Duration */}
          <div className="bg-gray-800/60 rounded-lg p-2 text-center border border-white/20">
            <p className="text-gray-400 text-[9px] uppercase font-bold mb-0.5">Duration</p>
            <p className="text-white font-bold text-sm">
              {formatDuration(job_template.duration_minutes)}
            </p>
          </div>

          {/* Pay Rate - HIGHLIGHTED */}
          <div className="bg-gradient-to-br from-yellow-900/40 to-orange-900/40 rounded-lg p-2 text-center border border-yellow-500/40">
            <p className="text-yellow-300 text-[9px] uppercase font-bold mb-0.5">Pay Rate</p>
            <p className="text-white font-bold text-sm">
              {formatPrice(job_template.price_per_hour)}
            </p>
          </div>
        </div>

        {/* Start & End Date/Time - Combined */}
        <div className="bg-gray-800/60 rounded-lg p-2 mb-3 border border-white/20">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-gray-400 text-[9px] uppercase font-bold mb-0.5">Start</p>
              <p className="text-white font-bold text-xs">
                {scheduledDateFormatted || '—'}
              </p>
              <p className="text-white font-bold text-sm">
                {job_template.time_window_start ? job_template.time_window_start.slice(0, 5) : '—'}
              </p>
            </div>
            <div className="text-center border-l border-white/20 pl-2">
              <p className="text-gray-400 text-[9px] uppercase font-bold mb-0.5">End</p>
              <p className="text-white font-bold text-xs">
                {endDate || '—'}
              </p>
              <p className="text-white font-bold text-sm">
                {endTime || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Expandable Description Button */}
        {job_template.description && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-gray-800/60 rounded-lg p-2 w-full text-left border border-white/20 flex items-center justify-between group"
          >
            <span className="text-white text-xs font-medium">Job Details</span>
            <span className={`text-white text-base transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        )}

        {/* Expandable Description */}
        {isExpanded && job_template.description && (
          <div className="overflow-hidden mt-2">
            <div className="bg-gray-900/80 rounded-lg p-3 border border-white/10 max-h-24 overflow-y-auto">
                <p className="text-gray-300 text-xs leading-relaxed">
                  {job_template.description}
                </p>
                {job_template.address && (
                  <p className="text-gray-400 text-[10px] mt-2">
                    <span className="font-semibold text-gray-300">Address: </span>
                    {job_template.address}
                  </p>
                )}
                {daysFormatted && (
                  <p className="text-gray-400 text-[10px] mt-1">
                    <span className="font-semibold text-gray-300">Available: </span>
                    {daysFormatted}
                  </p>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Swipe Indicators */}
      <div className="absolute top-6 left-6 right-6 flex justify-between pointer-events-none">
        <div className="bg-red-500 text-white font-bold text-sm px-3 py-1.5 rounded-lg rotate-[-15deg] opacity-0 like-indicator shadow-xl">
          SKIP
        </div>
        <div className="bg-green-500 text-white font-bold text-sm px-3 py-1.5 rounded-lg rotate-[15deg] opacity-0 nope-indicator shadow-xl">
          INTERESTED
        </div>
      </div>
    </motion.div>
  )
}
