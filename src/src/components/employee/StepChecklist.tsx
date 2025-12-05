'use client'

import { useState } from 'react'
import type { JobStepChecklist, JobSessionChecklistProgress } from '@/types/database'

interface StepChecklistProps {
  items: JobStepChecklist[]
  sessionId: string
  progress: JobSessionChecklistProgress[]
  onToggle: (itemId: string, isChecked: boolean) => Promise<void>
  disabled?: boolean
}

export function StepChecklist({ items, sessionId, progress, onToggle, disabled = false }: StepChecklistProps) {
  const [updating, setUpdating] = useState<string | null>(null)

  const handleToggle = async (itemId: string, currentState: boolean) => {
    if (disabled) return

    setUpdating(itemId)
    try {
      await onToggle(itemId, !currentState)
    } finally {
      setUpdating(null)
    }
  }

  const isChecked = (itemId: string) => {
    return progress.some(p => p.checklist_item_id === itemId && p.is_checked)
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Checklist</h4>
      {items
        .sort((a, b) => a.item_order - b.item_order)
        .map((item) => {
          const checked = isChecked(item.id)
          const isUpdating = updating === item.id

          return (
            <label
              key={item.id}
              className={`
                flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer
                ${checked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-gray-300'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${isUpdating ? 'opacity-50' : ''}
              `}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleToggle(item.id, checked)}
                disabled={disabled || isUpdating}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className={`flex-1 text-sm ${checked ? 'text-gray-600 line-through' : 'text-gray-900'}`}>
                {item.item_text}
              </span>
            </label>
          )
        })}
    </div>
  )
}
