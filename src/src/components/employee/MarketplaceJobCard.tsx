'use client'

import { motion } from 'framer-motion'
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

  return (
    <motion.div
      className="relative w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl overflow-hidden"
      style={{ aspectRatio: '3/4' }}
    >
      {/* Job Image or Placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-50">
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-6xl text-blue-300">
            {job_template.customer?.customer_code || '🧹'}
          </div>
        </div>
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
        {/* Job Code Badge */}
        <div className="mb-4">
          <span className="inline-block bg-white/90 text-gray-900 font-bold text-sm px-3 py-1 rounded-full">
            {job_template.job_code}
          </span>
        </div>

        {/* Main Info */}
        <div className="space-y-2 mb-4">
          <h2 className="text-2xl font-bold text-white leading-tight">
            {job_template.title}
          </h2>

          {job_template.customer && (
            <p className="text-white/90 text-sm">
              Client: {job_template.customer.full_name}
            </p>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <p className="text-white/70 text-xs mb-1">Duration</p>
            <p className="text-white font-semibold">
              {formatDuration(job_template.duration_minutes)}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <p className="text-white/70 text-xs mb-1">Pay Rate</p>
            <p className="text-white font-semibold">
              {formatPrice(job_template.price_per_hour)}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 col-span-2">
            <p className="text-white/70 text-xs mb-1">Time Window</p>
            <p className="text-white font-semibold">
              {formatTimeWindow(job_template.time_window_start, job_template.time_window_end)}
            </p>
          </div>
        </div>

        {/* Description */}
        {job_template.description && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
            <p className="text-white/90 text-sm line-clamp-3">
              {job_template.description}
            </p>
          </div>
        )}

        {/* Address */}
        {job_template.address && (
          <div className="mt-2">
            <p className="text-white/70 text-xs">
              📍 {job_template.address}
            </p>
          </div>
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
