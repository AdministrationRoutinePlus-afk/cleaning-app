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

  // Format scheduled date
  const formatScheduledDate = (date: string | null) => {
    if (!date) return null
    const d = new Date(date + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const hasImage = job_template.image_url && !imageError
  const scheduledDateFormatted = formatScheduledDate(jobSession.scheduled_date)
  const daysFormatted = formatDays(job_template.available_days)

  return (
    <motion.div
      className="relative w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl overflow-hidden"
      style={{ aspectRatio: '3/4' }}
    >
      {/* Job Image or Placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-50">
        {hasImage ? (
          <Image
            src={job_template.image_url!}
            alt={job_template.title}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-6xl text-blue-300">
              {job_template.customer?.customer_code || '🧹'}
            </div>
          </div>
        )}
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-5">
        {/* Top Badges */}
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="inline-block bg-white/90 text-gray-900 font-bold text-xs px-2.5 py-1 rounded-full">
            {job_template.job_code}
          </span>
          {scheduledDateFormatted && (
            <span className="inline-block bg-blue-500 text-white font-medium text-xs px-2.5 py-1 rounded-full">
              📅 {scheduledDateFormatted}
            </span>
          )}
        </div>

        {/* Main Info */}
        <div className="space-y-1 mb-3">
          <h2 className="text-xl font-bold text-white leading-tight">
            {job_template.title}
          </h2>
          {job_template.customer && (
            <p className="text-white/80 text-sm">
              {job_template.customer.full_name}
            </p>
          )}
        </div>

        {/* Description */}
        {job_template.description && (
          <p className="text-white/80 text-sm line-clamp-2 mb-3">
            {job_template.description}
          </p>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2 text-center">
            <p className="text-white/60 text-[10px] uppercase">Duration</p>
            <p className="text-white font-semibold text-sm">
              {formatDuration(job_template.duration_minutes)}
            </p>
          </div>

          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2 text-center">
            <p className="text-white/60 text-[10px] uppercase">Pay</p>
            <p className="text-white font-semibold text-sm">
              {formatPrice(job_template.price_per_hour)}
            </p>
          </div>

          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2 text-center">
            <p className="text-white/60 text-[10px] uppercase">Time</p>
            <p className="text-white font-semibold text-sm">
              {job_template.time_window_start ? job_template.time_window_start.slice(0, 5) : '—'}
            </p>
          </div>
        </div>

        {/* Days/Schedule */}
        {daysFormatted && (
          <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2 mb-2">
            <p className="text-white/60 text-[10px] uppercase mb-1">Schedule</p>
            <p className="text-white text-sm">{daysFormatted}</p>
          </div>
        )}

        {/* Address */}
        {job_template.address && (
          <p className="text-white/60 text-xs truncate">
            📍 {job_template.address}
          </p>
        )}
      </div>

      {/* Swipe Indicators (Optional - can be shown on drag) */}
      <div className="absolute top-8 left-8 right-8 flex justify-between pointer-events-none">
        <div className="bg-red-500 text-white font-bold text-lg px-4 py-2 rounded-lg rotate-[-15deg] opacity-0 like-indicator">
          SKIP
        </div>
        <div className="bg-green-500 text-white font-bold text-lg px-4 py-2 rounded-lg rotate-[15deg] opacity-0 nope-indicator">
          INTERESTED
        </div>
      </div>
    </motion.div>
  )
}
