'use client'

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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-xl ${
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
    <div className="bg-white/5 border border-white/10 rounded-xl">
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">
              {evaluation.job_session?.job_template?.job_code} - {evaluation.job_session?.job_template?.title}
            </h3>
            {evaluation.employee && (
              <p className="text-sm text-gray-400 mt-1">
                {t('Employee')}: {evaluation.employee.full_name}
              </p>
            )}
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRatingBadge(evaluation.rating)}`}>
            {getRatingLabel(evaluation.rating)}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Star Rating */}
        <div className="flex items-center gap-3">
          {renderStars(evaluation.rating)}
          <span className="text-sm text-gray-300 font-medium">
            {evaluation.rating}/5
          </span>
        </div>

        {/* Comment */}
        {evaluation.comment && (
          <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {evaluation.comment}
            </p>
          </div>
        )}

        {/* Submitted Date */}
        {evaluation.submitted_at && (
          <p className="text-xs text-gray-500">
            {t('Submitted on')} {formatDate(evaluation.submitted_at)}
          </p>
        )}
      </div>
    </div>
  )
}
