'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
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
  const [imageError, setImageError] = useState(false)

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
    if (hours === 0) return `${mins}min`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}min`
  }

  // Format price
  const formatPrice = (price: number | null) => {
    if (!price) return '—'
    return `$${price.toFixed(2)}/hr`
  }

  // Format time window
  const formatTimeWindow = () => {
    const start = job_template.time_window_start
    const end = job_template.time_window_end
    if (!start && !end) return null
    return `${start?.slice(0, 5) || '—'} - ${end?.slice(0, 5) || '—'}`
  }

  const hasImage = job_template.image_url && !imageError
  const timeWindow = formatTimeWindow()

  return (
    <motion.div
      layout
      className={`bg-white/10 rounded-xl border-2 overflow-hidden transition-colors ${
        isExpanded ? 'border-blue-500/50' : 'border-white/20'
      }`}
    >
      {/* Collapsed View - Always Visible */}
      <div
        className="p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800/60 border border-white/20 flex-shrink-0">
            {hasImage ? (
              <Image
                src={job_template.image_url!}
                alt={job_template.title}
                width={64}
                height={64}
                className="object-cover w-full h-full"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-2xl">🧹</span>
              </div>
            )}
          </div>

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-gray-700/80 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                {job_template.job_code}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </div>
            <h3 className="text-white font-semibold text-sm truncate mb-0.5">
              {job_template.title}
            </h3>
            {job_template.customer && (
              <p className="text-gray-400 text-xs truncate">
                {job_template.customer.full_name}
              </p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="text-right flex-shrink-0">
            <p className="text-yellow-400 font-bold text-sm">
              {formatPrice(job_template.price_per_hour)}
            </p>
            <p className="text-gray-400 text-xs">
              {formatDuration(job_template.duration_minutes)}
            </p>
            {timeWindow && (
              <p className="text-gray-500 text-[10px]">
                {timeWindow}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Expanded View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
              {/* Larger Image */}
              {hasImage && (
                <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-800/60 border border-white/20">
                  <Image
                    src={job_template.image_url!}
                    alt={job_template.title}
                    width={400}
                    height={200}
                    className="object-cover w-full h-full"
                    onError={() => setImageError(true)}
                  />
                </div>
              )}

              {/* Time Window Details */}
              <div className="bg-gray-800/60 rounded-lg p-3 border border-white/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Window Start</p>
                    <p className="text-white font-semibold text-sm">
                      {jobSession.scheduled_date ? new Date(jobSession.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                    </p>
                    <p className="text-gray-300 text-xs">
                      {job_template.time_window_start?.slice(0, 5) || '—'}
                    </p>
                  </div>
                  <div className="text-center border-l border-white/20">
                    <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Window End</p>
                    <p className="text-white font-semibold text-sm">
                      {(jobSession.scheduled_end_date || jobSession.scheduled_date) ? new Date((jobSession.scheduled_end_date || jobSession.scheduled_date) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                    </p>
                    <p className="text-gray-300 text-xs">
                      {job_template.time_window_end?.slice(0, 5) || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {job_template.description && (
                <div className="bg-gray-800/60 rounded-lg p-3 border border-white/20">
                  <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Description</p>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {job_template.description}
                  </p>
                </div>
              )}

              {/* Address */}
              {job_template.address && (
                <div className="bg-gray-800/60 rounded-lg p-3 border border-white/20">
                  <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Address</p>
                  <p className="text-white text-sm">
                    {job_template.address}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSkip()
                  }}
                  className="flex-1 bg-white/5 border-white/20 text-gray-300 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300"
                >
                  Skip
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    onClaim()
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
                >
                  Claim Job
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
