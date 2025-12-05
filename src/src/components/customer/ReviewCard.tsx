'use client'

import type { Evaluation } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
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
        return 'Excellent'
      case 4:
        return 'Very Good'
      case 3:
        return 'Good'
      case 2:
        return 'Fair'
      case 1:
        return 'Needs Improvement'
      default:
        return ''
    }
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'bg-green-100 text-green-800'
    if (rating === 3) return 'bg-blue-100 text-blue-800'
    return 'bg-orange-100 text-orange-800'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">
              {evaluation.job_session?.job_template?.job_code} - {evaluation.job_session?.job_template?.title}
            </CardTitle>
            {evaluation.employee && (
              <p className="text-sm text-gray-500 mt-1">
                Employee: {evaluation.employee.full_name}
              </p>
            )}
          </div>
          <Badge variant="secondary" className={getRatingColor(evaluation.rating)}>
            {getRatingLabel(evaluation.rating)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Star Rating */}
        <div className="flex items-center gap-3">
          {renderStars(evaluation.rating)}
          <span className="text-sm text-gray-600 font-medium">
            {evaluation.rating}/5
          </span>
        </div>

        {/* Comment */}
        {evaluation.comment && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {evaluation.comment}
            </p>
          </div>
        )}

        {/* Submitted Date */}
        {evaluation.submitted_at && (
          <p className="text-xs text-gray-500">
            Submitted on {formatDate(evaluation.submitted_at)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
