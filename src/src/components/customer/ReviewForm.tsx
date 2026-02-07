'use client'

import { useState } from 'react'
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
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating || submitting) return

    setSubmitting(true)
    try {
      // Create evaluation
      const { error: evalError } = await supabase
        .from('evaluations')
        .insert({
          job_session_id: jobSession.id,
          customer_id: customer.id,
          employee_id: jobSession.assigned_to || '',
          rating,
          comment: comment.trim() || null,
          submitted_at: new Date().toISOString()
        })

      if (evalError) throw evalError

      // Update job session status to EVALUATED
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

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl">
      <div className="p-6 pb-2">
        <h3 className="text-lg font-semibold text-white">{t('Submit Review')}</h3>
        <div className="text-sm text-gray-300 mt-1">
          <p className="font-medium">{jobSession.job_template?.job_code} - {jobSession.job_template?.title}</p>
          {jobSession.employee && (
            <p className="text-gray-400">{t('Employee')}: {jobSession.employee.full_name}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-6">
          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              {t('How would you rate this service?')}
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star as 1 | 2 | 3 | 4 | 5)}
                  className={`w-12 h-12 text-2xl transition-all ${
                    rating && star <= rating
                      ? 'text-yellow-400 scale-110'
                      : 'text-gray-600 hover:text-yellow-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {rating && (
              <p className="text-sm text-gray-400 mt-2">
                {rating === 5 && t('Excellent!')}
                {rating === 4 && t('Very Good')}
                {rating === 3 && t('Good')}
                {rating === 2 && t('Fair')}
                {rating === 1 && t('Needs Improvement')}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('Additional Comments (Optional)')}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('Share your experience...')}
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/20 text-white placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {comment.length}/500 {t('characters')}
            </p>
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/20 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {t('Cancel')}
          </button>
          <button
            type="submit"
            disabled={!rating || submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? t('Submitting...') : t('Submit Review')}
          </button>
        </div>
      </form>
    </div>
  )
}
