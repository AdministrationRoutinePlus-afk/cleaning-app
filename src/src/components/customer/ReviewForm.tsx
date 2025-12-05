'use client'

import { useState } from 'react'
import type { JobSession, Customer } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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
      alert('Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Review</CardTitle>
        <div className="text-sm text-gray-600">
          <p className="font-medium">{jobSession.job_template?.job_code} - {jobSession.job_template?.title}</p>
          {jobSession.employee && (
            <p className="text-gray-500">Employee: {jobSession.employee.full_name}</p>
          )}
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How would you rate this service?
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
                      : 'text-gray-300 hover:text-yellow-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {rating && (
              <p className="text-sm text-gray-600 mt-2">
                {rating === 5 && 'Excellent!'}
                {rating === 4 && 'Very Good'}
                {rating === 3 && 'Good'}
                {rating === 2 && 'Fair'}
                {rating === 1 && 'Needs Improvement'}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Comments (Optional)
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              {comment.length}/500 characters
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!rating || submitting}
            className="flex-1"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
