'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
      className="relative w-full max-w-sm mx-auto bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-3xl shadow-2xl overflow-hidden border border-gray-700/50"
      style={{ aspectRatio: '3/4' }}
      whileHover={{ scale: 1.02, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Job Image Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black opacity-40">
        {hasImage ? (
          <Image
            src={job_template.image_url!}
            alt={job_template.title}
            fill
            className="object-cover opacity-30"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <div className="text-8xl">
              🧹
            </div>
          </div>
        )}
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent flex flex-col justify-end p-6">
        {/* Top Badge */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <motion.span
            className="inline-block bg-white/20 backdrop-blur-md text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg border border-white/30"
            whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.25)" }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {job_template.job_code}
          </motion.span>
        </div>

        {/* Main Info */}
        <div className="space-y-1 mb-4">
          <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">
            {job_template.title}
          </h2>
          {job_template.customer && (
            <p className="text-gray-300 text-sm font-medium">
              {job_template.customer.full_name}
            </p>
          )}
        </div>

        {/* Key Info - Uniform Style */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Duration */}
          <motion.div
            className="bg-white/10 backdrop-blur-md rounded-xl p-3 text-center border border-white/20"
            whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Duration</p>
            <p className="text-white font-bold text-base">
              {formatDuration(job_template.duration_minutes)}
            </p>
          </motion.div>

          {/* Pay Rate - HIGHLIGHTED */}
          <motion.div
            className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-md rounded-xl p-3 text-center border border-yellow-500/40"
            whileHover={{ scale: 1.05, borderColor: "rgba(245, 158, 11, 0.7)" }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <p className="text-yellow-300 text-[10px] uppercase font-bold mb-1">Pay Rate</p>
            <p className="text-white font-bold text-base">
              {formatPrice(job_template.price_per_hour)}
            </p>
          </motion.div>
        </div>

        {/* Start & End Date/Time - Combined */}
        <motion.div
          className="bg-white/10 backdrop-blur-md rounded-xl p-3 mb-4 border border-white/20"
          whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Start</p>
              <p className="text-white font-bold text-sm">
                {scheduledDateFormatted || '—'}
              </p>
              <p className="text-white font-bold text-base">
                {job_template.time_window_start ? job_template.time_window_start.slice(0, 5) : '—'}
              </p>
            </div>
            <div className="text-center border-l border-white/20 pl-4">
              <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">End</p>
              <p className="text-white font-bold text-sm">
                {endDate || '—'}
              </p>
              <p className="text-white font-bold text-base">
                {endTime || '—'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Expandable Description Button */}
        {job_template.description && (
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-white/10 backdrop-blur-md rounded-xl p-3 w-full text-left border border-white/20 flex items-center justify-between group"
            whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-white text-sm font-medium">Job Details</span>
            <motion.span
              className="text-white text-xl"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              ▼
            </motion.span>
          </motion.button>
        )}

        {/* Expandable Description */}
        <AnimatePresence>
          {isExpanded && job_template.description && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden mt-3"
            >
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/10 max-h-32 overflow-y-auto">
                <p className="text-gray-300 text-sm leading-relaxed">
                  {job_template.description}
                </p>
                {job_template.address && (
                  <p className="text-gray-400 text-xs mt-3">
                    <span className="font-semibold text-gray-300">Address: </span>
                    {job_template.address}
                  </p>
                )}
                {daysFormatted && (
                  <p className="text-gray-400 text-xs mt-2">
                    <span className="font-semibold text-gray-300">Available: </span>
                    {daysFormatted}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Swipe Indicators */}
      <div className="absolute top-8 left-8 right-8 flex justify-between pointer-events-none">
        <motion.div
          className="bg-red-500 text-white font-bold text-lg px-4 py-2 rounded-lg rotate-[-15deg] opacity-0 like-indicator shadow-xl"
          whileHover={{ scale: 1.1 }}
        >
          SKIP
        </motion.div>
        <motion.div
          className="bg-green-500 text-white font-bold text-lg px-4 py-2 rounded-lg rotate-[15deg] opacity-0 nope-indicator shadow-xl"
          whileHover={{ scale: 1.1 }}
        >
          INTERESTED
        </motion.div>
      </div>
    </motion.div>
  )
}
