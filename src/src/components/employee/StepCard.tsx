'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { JobStep, JobStepImage, JobStepChecklist, JobSessionProgress, JobSessionChecklistProgress } from '@/types/database'
import { StepChecklist } from './StepChecklist'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

interface StepCardProps {
  step: JobStep
  stepNumber: number
  totalSteps: number
  images: JobStepImage[]
  checklistItems: JobStepChecklist[]
  sessionId: string
  stepProgress: JobSessionProgress | undefined
  checklistProgress: JobSessionChecklistProgress[]
  onToggleStep: (stepId: string, isCompleted: boolean) => Promise<void>
  onToggleChecklistItem: (itemId: string, isChecked: boolean) => Promise<void>
  isListMode?: boolean
}

export function StepCard({
  step,
  stepNumber,
  totalSteps,
  images,
  checklistItems,
  sessionId,
  stepProgress,
  checklistProgress,
  onToggleStep,
  onToggleChecklistItem,
  isListMode = false
}: StepCardProps) {
  const [updating, setUpdating] = useState(false)
  const isCompleted = stepProgress?.is_completed || false

  const handleToggleComplete = async () => {
    setUpdating(true)
    try {
      await onToggleStep(step.id, isCompleted)
    } finally {
      setUpdating(false)
    }
  }

  const sortedImages = [...images].sort((a, b) => a.image_order - b.image_order)

  return (
    <div className={`
      bg-white rounded-lg shadow-md border-2 transition-all
      ${isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-200'}
      ${isListMode ? 'mb-4' : 'h-full'}
    `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold">
                {stepNumber}
              </span>
              <span className="text-xs text-gray-500">of {totalSteps}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
          </div>

          {isCompleted && (
            <div className="flex-shrink-0 ml-2">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
        </div>

        {step.description && (
          <p className="text-sm text-gray-600 mt-2">{step.description}</p>
        )}

        {step.products_needed && (
          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs font-semibold text-blue-900 mb-1">Products Needed:</p>
            <p className="text-sm text-blue-800">{step.products_needed}</p>
          </div>
        )}
      </div>

      {/* Images */}
      {sortedImages.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-2">
            {sortedImages.map((image) => (
              <div key={image.id} className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={image.image_url}
                  alt={image.caption || `Step ${stepNumber} image`}
                  fill
                  className="object-cover"
                />
                {image.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-1">
                    <p className="text-xs text-white text-center">{image.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      {checklistItems.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <StepChecklist
            items={checklistItems}
            sessionId={sessionId}
            progress={checklistProgress}
            onToggle={onToggleChecklistItem}
            disabled={isCompleted}
          />
        </div>
      )}

      {/* Mark Complete Button */}
      <div className="p-4">
        <Button
          onClick={handleToggleComplete}
          disabled={updating}
          className={`w-full ${
            isCompleted
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {updating ? 'Updating...' : isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
        </Button>
      </div>
    </div>
  )
}
