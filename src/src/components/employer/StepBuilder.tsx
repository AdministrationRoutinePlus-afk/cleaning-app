'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

function StepBuilderImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="aspect-video relative rounded-lg overflow-hidden bg-white/5">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-white/10" />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

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
          toast.error(`${file.name} is not an image file`)
          continue
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Max size is 5MB`)
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
          toast.error(`Failed to upload ${file.name}: ${uploadError.message}`)
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
      toast.error('Failed to upload images')
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
        <span className="text-base font-medium text-gray-300">Step-by-Step Instructions</span>
        <button
          type="button"
          onClick={addStep}
          className="bg-white/10 border border-white/20 text-white hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm"
        >
          + Add Step
        </button>
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No steps added yet. Click &quot;Add Step&quot; to create instructions.
        </p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <div
                className="p-3 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => setExpandedStep(expandedStep === index ? null : index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-sm font-bold flex items-center justify-center">
                      {step.step_order}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {step.title || <span className="text-gray-500">Step {step.step_order}</span>}
                    </span>
                    {step.images.length > 0 && (
                      <span className="text-xs text-gray-500">
                        ({step.images.length} image{step.images.length > 1 ? 's' : ''})
                      </span>
                    )}
                    {step.checklist_items.length > 0 && (
                      <span className="text-xs text-gray-500">
                        ({step.checklist_items.length} item{step.checklist_items.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        moveStep(index, 'up')
                      }}
                      disabled={index === 0}
                      className="text-gray-500 hover:text-white hover:bg-white/10 h-7 w-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        moveStep(index, 'down')
                      }}
                      disabled={index === steps.length - 1}
                      className="text-gray-500 hover:text-white hover:bg-white/10 h-7 w-7 rounded-lg flex items-center justify-center disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <span className="text-gray-500 ml-2">
                      {expandedStep === index ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {expandedStep === index && (
                <div className="border-t border-white/10 p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">Step Title</label>
                    <Input
                      value={step.title}
                      onChange={(e) => updateStep(index, { title: e.target.value })}
                      placeholder="e.g., Clean kitchen counters"
                      className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">Description</label>
                    <Textarea
                      value={step.description}
                      onChange={(e) => updateStep(index, { description: e.target.value })}
                      placeholder="Detailed instructions for this step..."
                      rows={3}
                      className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">Products Needed</label>
                    <Input
                      value={step.products_needed}
                      onChange={(e) => updateStep(index, { products_needed: e.target.value })}
                      placeholder="e.g., All-purpose cleaner, microfiber cloth"
                      className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                    />
                  </div>

                  {/* Reference Images */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-300">Reference Images</label>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          ref={(el) => { fileInputRefs.current[index] = el }}
                          onChange={(e) => handleImageUpload(index, e)}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[index]?.click()}
                          disabled={uploading === index}
                          className="bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20 text-xs px-2 py-1 rounded-lg disabled:opacity-50"
                        >
                          {uploading === index ? 'Uploading...' : '+ Add Images'}
                        </button>
                      </div>
                    </div>

                    {step.images.length === 0 ? (
                      <p className="text-xs text-gray-400">No images added</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {step.images.map((image, imgIndex) => (
                          <div key={imgIndex} className="relative group">
                            <StepBuilderImage
                              src={image.url}
                              alt={image.caption || `Step ${step.step_order} image ${imgIndex + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index, imgIndex)}
                              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              x
                            </button>
                            <Input
                              value={image.caption || ''}
                              onChange={(e) => updateImageCaption(index, imgIndex, e.target.value)}
                              placeholder="Caption (optional)"
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 text-xs mt-1"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-300">Checklist Items</label>
                      <button
                        type="button"
                        onClick={() => addChecklistItem(index)}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        + Add Item
                      </button>
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
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => removeChecklistItem(index, itemIndex)}
                              className="text-red-400 hover:text-red-300 h-8 w-8 flex items-center justify-center"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 text-xs px-3 py-1.5 rounded-lg"
                    >
                      Remove Step
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
