'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export interface StepImage {
  url: string
  caption?: string
}

export interface Step {
  id?: string
  step_order: number
  title: string
  description: string
  products_needed: string
  checklist_items: string[]
  images: StepImage[]
}

interface StepBuilderProps {
  steps: Step[]
  onChange: (steps: Step[]) => void
}

export function StepBuilder({ steps, onChange }: StepBuilderProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({})
  const supabase = createClient()

  const addStep = () => {
    const newStep: Step = {
      step_order: steps.length + 1,
      title: '',
      description: '',
      products_needed: '',
      checklist_items: [],
      images: [],
    }
    onChange([...steps, newStep])
    setExpandedStep(steps.length)
  }

  const updateStep = (index: number, updates: Partial<Step>) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], ...updates }
    onChange(newSteps)
  }

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index)
    const reordered = newSteps.map((step, i) => ({
      ...step,
      step_order: i + 1,
    }))
    onChange(reordered)
    setExpandedStep(null)
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === steps.length - 1) return

    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    const temp = newSteps[index]
    newSteps[index] = newSteps[targetIndex]
    newSteps[targetIndex] = temp

    const reordered = newSteps.map((step, i) => ({
      ...step,
      step_order: i + 1,
    }))

    onChange(reordered)
    setExpandedStep(targetIndex)
  }

  const addChecklistItem = (stepIndex: number) => {
    const newSteps = [...steps]
    newSteps[stepIndex].checklist_items = [
      ...newSteps[stepIndex].checklist_items,
      '',
    ]
    onChange(newSteps)
  }

  const updateChecklistItem = (stepIndex: number, itemIndex: number, value: string) => {
    const newSteps = [...steps]
    newSteps[stepIndex].checklist_items[itemIndex] = value
    onChange(newSteps)
  }

  const removeChecklistItem = (stepIndex: number, itemIndex: number) => {
    const newSteps = [...steps]
    newSteps[stepIndex].checklist_items = newSteps[stepIndex].checklist_items.filter(
      (_, i) => i !== itemIndex
    )
    onChange(newSteps)
  }

  // Image handling
  const handleImageUpload = async (stepIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setUploading(stepIndex)

    try {
      const uploadedImages: StepImage[] = []

      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert(`${file.name} is not an image file`)
          continue
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name} is too large. Max size is 5MB`)
          continue
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `step-images/${fileName}`

        // Upload to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from('job-images')
          .upload(filePath, file)

        if (uploadError) {
          console.error('Upload error:', uploadError)
          alert(`Failed to upload ${file.name}: ${uploadError.message}`)
          continue
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('job-images')
          .getPublicUrl(filePath)

        uploadedImages.push({ url: publicUrl, caption: '' })
      }

      // Add uploaded images to step
      if (uploadedImages.length > 0) {
        const newSteps = [...steps]
        newSteps[stepIndex].images = [
          ...newSteps[stepIndex].images,
          ...uploadedImages,
        ]
        onChange(newSteps)
      }
    } catch (error) {
      console.error('Error uploading images:', error)
      alert('Failed to upload images')
    } finally {
      setUploading(null)
      // Reset file input
      if (fileInputRefs.current[stepIndex]) {
        fileInputRefs.current[stepIndex]!.value = ''
      }
    }
  }

  const removeImage = async (stepIndex: number, imageIndex: number) => {
    const newSteps = [...steps]
    const image = newSteps[stepIndex].images[imageIndex]

    // Try to delete from storage (extract path from URL)
    try {
      const url = new URL(image.url)
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/job-images\/(.+)/)
      if (pathMatch) {
        await supabase.storage.from('job-images').remove([pathMatch[1]])
      }
    } catch (error) {
      console.error('Error deleting image from storage:', error)
    }

    newSteps[stepIndex].images = newSteps[stepIndex].images.filter(
      (_, i) => i !== imageIndex
    )
    onChange(newSteps)
  }

  const updateImageCaption = (stepIndex: number, imageIndex: number, caption: string) => {
    const newSteps = [...steps]
    newSteps[stepIndex].images[imageIndex].caption = caption
    onChange(newSteps)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Step-by-Step Instructions</Label>
        <Button type="button" variant="outline" size="sm" onClick={addStep}>
          + Add Step
        </Button>
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No steps added yet. Click "Add Step" to create instructions.
        </p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader
                className="py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedStep(expandedStep === index ? null : index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-sm font-medium">
                      {step.step_order}
                    </span>
                    <CardTitle className="text-base">
                      {step.title || `Step ${step.step_order}`}
                    </CardTitle>
                    {step.images.length > 0 && (
                      <span className="text-xs text-gray-400">
                        ({step.images.length} image{step.images.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        moveStep(index, 'up')
                      }}
                      disabled={index === 0}
                      className="h-7 w-7 p-0"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        moveStep(index, 'down')
                      }}
                      disabled={index === steps.length - 1}
                      className="h-7 w-7 p-0"
                    >
                      ↓
                    </Button>
                    <span className="text-gray-400 ml-2">
                      {expandedStep === index ? '−' : '+'}
                    </span>
                  </div>
                </div>
              </CardHeader>

              {expandedStep === index && (
                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-2">
                    <Label>Step Title</Label>
                    <Input
                      value={step.title}
                      onChange={(e) => updateStep(index, { title: e.target.value })}
                      placeholder="e.g., Clean kitchen counters"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={step.description}
                      onChange={(e) => updateStep(index, { description: e.target.value })}
                      placeholder="Detailed instructions for this step..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Products Needed</Label>
                    <Input
                      value={step.products_needed}
                      onChange={(e) => updateStep(index, { products_needed: e.target.value })}
                      placeholder="e.g., All-purpose cleaner, microfiber cloth"
                    />
                  </div>

                  {/* Reference Images */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Reference Images</Label>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          ref={(el) => { fileInputRefs.current[index] = el }}
                          onChange={(e) => handleImageUpload(index, e)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRefs.current[index]?.click()}
                          disabled={uploading === index}
                        >
                          {uploading === index ? 'Uploading...' : '+ Add Images'}
                        </Button>
                      </div>
                    </div>

                    {step.images.length === 0 ? (
                      <p className="text-xs text-gray-400">No images added</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {step.images.map((image, imgIndex) => (
                          <div key={imgIndex} className="relative group">
                            <div className="aspect-video relative rounded-lg overflow-hidden bg-gray-100">
                              <Image
                                src={image.url}
                                alt={image.caption || `Step ${step.step_order} image ${imgIndex + 1}`}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeImage(index, imgIndex)}
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </Button>
                            <Input
                              value={image.caption || ''}
                              onChange={(e) => updateImageCaption(index, imgIndex, e.target.value)}
                              placeholder="Caption (optional)"
                              className="mt-1 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Checklist Items</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addChecklistItem(index)}
                      >
                        + Add Item
                      </Button>
                    </div>
                    {step.checklist_items.length === 0 ? (
                      <p className="text-xs text-gray-400">No checklist items</p>
                    ) : (
                      <div className="space-y-2">
                        {step.checklist_items.map((item, itemIndex) => (
                          <div key={itemIndex} className="flex gap-2">
                            <Input
                              value={item}
                              onChange={(e) =>
                                updateChecklistItem(index, itemIndex, e.target.value)
                              }
                              placeholder={`Item ${itemIndex + 1}`}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeChecklistItem(index, itemIndex)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeStep(index)}
                    >
                      Remove Step
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
