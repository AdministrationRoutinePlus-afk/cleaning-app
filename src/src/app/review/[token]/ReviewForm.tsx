'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useDateFormat } from '@/lib/i18n/useDateFormat'

interface ReviewFormProps {
  token: string
  jobTitle: string | null
  employeeName: string | null
  scheduledDate: string | null
}

export function ReviewForm({ token, jobTitle, employeeName, scheduledDate }: ReviewFormProps) {
  const { t } = useTranslation()
  const { formatDate } = useDateFormat()

  const displayJobTitle = jobTitle || t('Cleaning Service')
  const displayEmployeeName = employeeName || t('Your cleaner')
  const displayDate = scheduledDate
    ? formatDate(new Date(scheduledDate + 'T12:00:00'), 'MMMM d, yyyy')
    : ''
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (rating === 0) {
      setError(t('Please select a rating'))
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rating,
          comment: comment.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('Failed to submit review'))
        return
      }

      setSubmitted(true)
    } catch {
      setError(t('Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">&#127881;</div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('Thank You!')}</h1>
        <p className="text-gray-400">
          {t('Your review has been submitted. We appreciate your feedback!')}
        </p>
        <div className="mt-6 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-600'}`}
            >
              &#9733;
            </span>
          ))}
        </div>
      </div>
    )
  }

  const ratingLabels: Record<number, string> = {
    1: t('Poor'),
    2: t('Fair'),
    3: t('Good'),
    4: t('Very Good'),
    5: t('Excellent'),
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">&#10024;</div>
        <h1 className="text-2xl font-bold text-white mb-1">{t('How was your cleaning?')}</h1>
        <p className="text-gray-400 text-sm">{t('Your feedback helps us improve')}</p>
      </div>

      {/* Job Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
        <div className="text-blue-400 text-xs font-semibold uppercase tracking-wide mb-1">
          {t('Service completed')}
        </div>
        <div className="text-white font-semibold">{displayJobTitle}</div>
        <div className="text-gray-400 text-sm mt-1">
          {displayEmployeeName} {displayDate && `\u00B7 ${displayDate}`}
        </div>
      </div>

      {/* Star Rating */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
          {t('Tap a star to rate')}
        </label>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
            >
              <span
                className={`text-4xl ${
                  star <= (hoveredRating || rating)
                    ? 'text-yellow-400'
                    : 'text-gray-600'
                }`}
              >
                &#9733;
              </span>
            </button>
          ))}
        </div>
        {rating > 0 && (
          <div className="text-center mt-2 text-sm text-gray-400">
            {ratingLabels[rating]}
          </div>
        )}
      </div>

      {/* Comment */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {t('Comment')} <span className="text-gray-500">{t('(optional)')}</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          placeholder={t('Tell us about your experience...')}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 resize-none"
        />
        <div className="text-right text-xs text-gray-500 mt-1">
          {comment.length}/500
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        {submitting ? t('Submitting...') : t('Submit Review')}
      </button>
    </div>
  )
}
