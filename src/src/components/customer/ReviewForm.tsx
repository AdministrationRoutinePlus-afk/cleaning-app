'use client'

import { useState, useRef } from 'react'
import { User, Calendar, CheckCircle } from 'lucide-react'
import type { JobSession, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface ReviewFormProps {
  jobSession: JobSession & {
    job_template?: {
      job_code: string
      title: string
    }
    employee?: {
      id: string
      full_name: string
    }
  }
  customer: Customer
  onSuccess: () => void
  onCancel: () => void
}

export function ReviewForm({ jobSession, customer, onSuccess, onCancel }: ReviewFormProps) {
  const { t } = useTranslation()
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating || submitting || !jobSession.assigned_to) return

    setSubmitting(true)
    try {
      const { error: evalError } = await supabase
        .from('evaluations')
        .insert({
          job_session_id: jobSession.id,
          customer_id: customer.id,
          employee_id: jobSession.assigned_to!,
          rating,
          comment: comment.trim() || null,
          submitted_at: new Date().toISOString()
        })

      if (evalError) throw evalError

      const { error: sessionError } = await supabase
        .from('job_sessions')
        .update({ status: 'EVALUATED' })
        .eq('id', jobSession.id)

      if (sessionError) throw sessionError

      onSuccess()
    } catch (error) {
      console.error('Error submitting review:', error)
      toast.error(t('Failed to submit review. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (timestamp: string | null) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-white/20 rounded-xl overflow-hidden">
      {/* Header with job details */}
      <div className="p-5 pb-4 border-b border-white/20">
        <h3 className="text-xl font-bold text-white mb-4">{t('Submit Review')}</h3>

        {/* Job info box */}
        <div className="bg-gray-800/60 border border-white/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="bg-gray-800/80 text-white font-bold text-xs px-3 py-1 rounded-full border border-white/30">
              {jobSession.full_job_code || jobSession.job_template?.job_code}
            </span>
          </div>
          <p className="text-lg font-bold text-white">{jobSession.job_template?.title}</p>
          <div className="space-y-2">
            {jobSession.employee && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-400">{t('Done by')}</span>
                <span className="text-sm font-semibold text-white">{jobSession.employee.full_name}</span>
              </div>
            )}
            {jobSession.scheduled_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">{t('Scheduled')}</span>
                <span className="text-sm font-semibold text-white">{formatDate(jobSession.scheduled_date)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">{t('Completed')}</span>
              <span className="text-sm font-semibold text-white">{formatDate(jobSession.completed_at)}</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-5 space-y-6">
          {/* Star Rating */}
          <div className="bg-gray-800/60 border border-white/20 rounded-xl p-4">
            <p className="text-xs uppercase font-bold tracking-wide text-gray-400 mb-4 text-center">
              {t('How would you rate this service?')}
            </p>
            <div className="flex gap-3 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star as 1 | 2 | 3 | 4 | 5)}
                  className={`w-14 h-14 text-4xl transition-all rounded-xl ${
                    rating && star <= rating
                      ? 'text-yellow-400 scale-110 bg-yellow-400/10 border border-yellow-500/30'
                      : 'text-gray-600 hover:text-yellow-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {rating && (
              <p className={`text-base text-center mt-4 font-bold ${
                rating >= 4 ? 'text-green-400' : rating === 3 ? 'text-blue-400' : 'text-orange-400'
              }`}>
                {rating === 5 && t('Excellent!')}
                {rating === 4 && t('Very Good')}
                {rating === 3 && t('Good')}
                {rating === 2 && t('Fair')}
                {rating === 1 && t('Needs Improvement')}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="bg-gray-800/60 border border-white/20 rounded-xl p-4">
            <p className="text-xs uppercase font-bold tracking-wide text-gray-400 mb-3">
              {t('Comments')} <span className="normal-case text-gray-500">({t('Optional')})</span>
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('Share your experience...')}
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl bg-gray-900/60 border border-white/20 text-white text-base placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              {comment.length}/500 {t('characters')}
            </p>
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/20 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            {t('Cancel')}
          </button>
          <button
            type="submit"
            disabled={!rating || submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            {submitting ? t('Submitting...') : t('Submit Review')}
          </button>
        </div>
      </form>
    </div>
  )
}
