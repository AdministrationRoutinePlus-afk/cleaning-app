'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { JobStep, JobStepImage, JobStepChecklist, JobSessionProgress, JobSessionChecklistProgress } from '@/types/database'
import { StepChecklist } from './StepChecklist'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

function ImageWithSkeleton({ src, alt, caption }: { src: string; alt: string; caption: string | null }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-white/5">
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-white/10" />
      )}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/5">
          <span className="text-xs text-gray-500">Image unavailable</span>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
      {caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-1">
          <p className="text-xs text-white text-center">{caption}</p>
        </div>
      )}
    </div>
  )
}

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
  compact?: boolean
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
  isListMode = false,
  compact = false
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

  if (compact) {
    return (
      <div className={`
        bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border-2 transition-all
        ${isCompleted ? 'border-green-500/50' : 'border-white/10'}
        mb-4
      `}>
        {/* Compact header row */}
        <div className="flex items-center gap-3 p-4">
          <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-sm font-bold flex-shrink-0">
            {stepNumber}
          </span>
          <h3 className="text-lg font-semibold text-white flex-1">{step.title}</h3>
          {isCompleted ? (
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-white" />
              </div>
            </div>
          ) : (
            <Button
              onClick={handleToggleComplete}
              disabled={updating}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
            >
              {updating ? 'Updating...' : 'Complete'}
            </Button>
          )}
        </div>

        {/* Inline checklist items (compact) */}
        {checklistItems.length > 0 && (
          <div className="px-4 pb-4 border-t border-white/10">
            <StepChecklist
              items={checklistItems}
              sessionId={sessionId}
              progress={checklistProgress}
              onToggle={onToggleChecklistItem}
              disabled={isCompleted}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`
      bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border-2 transition-all
      ${isCompleted ? 'border-green-500/50' : 'border-white/10'}
      ${isListMode ? 'mb-4' : 'h-full'}
    `}>
      {/* Header */}
      <div className="border-b border-white/10 p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-sm font-bold">
                {stepNumber}
              </span>
              <span className="text-xs text-gray-500">of {totalSteps}</span>
            </div>
            <h3 className="text-lg font-semibold text-white">{step.title}</h3>
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
          <p className="text-sm text-gray-400 mt-2">{step.description}</p>
        )}

        {step.products_needed && (
          <div className="mt-3 p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <p className="text-xs font-semibold text-blue-300 mb-1">Products Needed:</p>
            <p className="text-sm text-blue-200">{step.products_needed}</p>
          </div>
        )}
      </div>

      {/* Images */}
      {sortedImages.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="grid grid-cols-2 gap-2">
            {sortedImages.map((image) => (
              <ImageWithSkeleton
                key={image.id}
                src={image.image_url}
                alt={image.caption || `Step ${stepNumber} image`}
                caption={image.caption}
              />
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      {checklistItems.length > 0 && (
        <div className="p-4 border-b border-white/10">
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
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {updating ? 'Updating...' : isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
        </Button>
      </div>
    </div>
  )
}
