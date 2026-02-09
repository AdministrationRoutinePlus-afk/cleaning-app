'use client'

import { User, Calendar } from 'lucide-react'
import type { Evaluation } from '@/types/database'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface ReviewCardProps {
  evaluation: Evaluation & {
    job_session?: {
      job_template?: {
        job_code: string
        title: string
      }
    }
    employee?: {
      full_name: string
    }
  }
}

export function ReviewCard({ evaluation }: ReviewCardProps) {
  const { t } = useTranslation()
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-2xl ${
              star <= rating ? 'text-yellow-400' : 'text-gray-600'
            }`}
          >
            ★
          </span>
        ))}
      </div>
    )
  }

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 5:
        return t('Excellent')
      case 4:
        return t('Very Good')
      case 3:
        return t('Good')
      case 2:
        return t('Fair')
      case 1:
        return t('Needs Improvement')
      default:
        return ''
    }
  }

  const getRatingBadge = (rating: number) => {
    if (rating >= 4) return 'bg-green-500/20 text-green-300 border border-green-500/30'
    if (rating === 3) return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
    return 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
  }

  return (
    <div className="bg-gray-800/60 border border-white/20 rounded-xl p-4">
      {/* Header: code + rating badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="bg-gray-800/80 text-white font-bold text-xs px-3 py-1 rounded-full border border-white/30">
          {evaluation.job_session?.job_template?.job_code}
        </span>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getRatingBadge(evaluation.rating)}`}>
          {getRatingLabel(evaluation.rating)}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-white mb-3">
        {evaluation.job_session?.job_template?.title}
      </h3>

      {/* Info rows */}
      <div className="space-y-2 mb-3">
        {evaluation.employee && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-400">{t('Done by')}</span>
            <span className="text-sm font-semibold text-white">{evaluation.employee.full_name}</span>
          </div>
        )}
        {evaluation.submitted_at && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">{t('Submitted on')}</span>
            <span className="text-sm font-semibold text-white">{formatDate(evaluation.submitted_at)}</span>
          </div>
        )}
      </div>

      {/* Star Rating */}
      <div className="bg-gray-900/60 border border-white/10 rounded-xl p-3 mb-3">
        <div className="flex items-center justify-center gap-3">
          {renderStars(evaluation.rating)}
          <span className="text-lg font-bold text-white">
            {evaluation.rating}/5
          </span>
        </div>
      </div>

      {/* Comment */}
      {evaluation.comment && (
        <div className="bg-gray-900/60 border border-white/10 p-4 rounded-xl">
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
            {evaluation.comment}
          </p>
        </div>
      )}
    </div>
  )
}
