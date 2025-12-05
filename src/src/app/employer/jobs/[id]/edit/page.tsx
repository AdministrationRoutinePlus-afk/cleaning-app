'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Customer, JobTemplate, DayOfWeek } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StepBuilder, Step } from '@/components/employer/StepBuilder'

export default function EditJobPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [job, setJob] = useState<JobTemplate | null>(null)
  const [steps, setSteps] = useState<Step[]>([])

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    duration_minutes: '',
    price_per_hour: '',
    customer_id: '',
    timezone: 'America/Toronto',
    is_recurring: false,
    notes: '',
  })

  useEffect(() => {
    fetchJobData()
  }, [jobId])

  const fetchJobData = async () => {
    try {
      setInitialLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get employer record
      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) {
        console.error('Employer record not found')
        router.push('/login')
        return
      }

      // Fetch job template
      const { data: jobData, error: jobError } = await supabase
        .from('job_templates')
        .select('*')
        .eq('id', jobId)
        .eq('created_by', employer.id)
        .single()

      if (jobError || !jobData) {
        console.error('Job not found:', jobError)
        router.push('/employer/jobs')
        return
      }

      setJob(jobData)
      setFormData({
        title: jobData.title || '',
        description: jobData.description || '',
        address: jobData.address || '',
        duration_minutes: jobData.duration_minutes?.toString() || '',
        price_per_hour: jobData.price_per_hour?.toString() || '',
        customer_id: jobData.customer_id || '',
        timezone: jobData.timezone || 'America/Toronto',
        is_recurring: jobData.is_recurring || false,
        notes: jobData.notes || '',
      })

      // Fetch customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('created_by', employer.id)
        .eq('status', 'ACTIVE')
        .order('full_name', { ascending: true })

      setCustomers(customersData || [])

      // Fetch steps with checklist items and images
      const { data: stepsData } = await supabase
        .from('job_steps')
        .select('*')
        .eq('job_template_id', jobId)
        .order('step_order', { ascending: true })

      if (stepsData && stepsData.length > 0) {
        const stepsWithDetails: Step[] = []

        for (const step of stepsData) {
          // Fetch checklist items for this step
          const { data: checklistData } = await supabase
            .from('job_step_checklist')
            .select('*')
            .eq('job_step_id', step.id)
            .order('item_order', { ascending: true })

          // Fetch images for this step
          const { data: imagesData } = await supabase
            .from('job_step_images')
            .select('*')
            .eq('job_step_id', step.id)
            .order('image_order', { ascending: true })

          stepsWithDetails.push({
            id: step.id,
            step_order: step.step_order,
            title: step.title || '',
            description: step.description || '',
            products_needed: step.products_needed || '',
            checklist_items: checklistData?.map(item => item.item_text) || [],
            images: imagesData?.map(img => ({
              url: img.image_url,
              caption: img.caption || '',
            })) || [],
          })
        }

        setSteps(stepsWithDetails)
      }
    } catch (error) {
      console.error('Error fetching job data:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  const handleSubmit = async (status: 'DRAFT' | 'ACTIVE') => {
    try {
      setLoading(true)

      if (!job) {
        alert('Job data not loaded')
        return
      }

      // Validate required fields
      if (!formData.title) {
        alert('Please fill in the job title')
        return
      }

      // Prepare update data
      const updateData = {
        title: formData.title,
        description: formData.description || null,
        address: formData.address || null,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        price_per_hour: formData.price_per_hour ? parseFloat(formData.price_per_hour) : null,
        customer_id: formData.customer_id || null,
        timezone: formData.timezone,
        is_recurring: formData.is_recurring,
        notes: formData.notes || null,
        status: status,
        updated_at: new Date().toISOString(),
      }

      // Update job template
      const { error } = await supabase
        .from('job_templates')
        .update(updateData)
        .eq('id', jobId)

      if (error) throw error

      // Delete existing steps (cascade will handle checklist and images)
      await supabase
        .from('job_steps')
        .delete()
        .eq('job_template_id', jobId)

      // Insert updated steps
      if (steps.length > 0) {
        for (const step of steps) {
          // Insert job step
          const { data: stepData, error: stepError } = await supabase
            .from('job_steps')
            .insert({
              job_template_id: jobId,
              step_order: step.step_order,
              title: step.title,
              description: step.description || null,
              products_needed: step.products_needed || null,
            })
            .select()
            .single()

          if (stepError) {
            console.error('Error creating step:', stepError)
            continue
          }

          // Insert checklist items for this step
          if (step.checklist_items.length > 0 && stepData) {
            const checklistItems = step.checklist_items
              .filter(item => item.trim() !== '')
              .map((item, index) => ({
                job_step_id: stepData.id,
                item_text: item,
                item_order: index + 1,
              }))

            if (checklistItems.length > 0) {
              const { error: checklistError } = await supabase
                .from('job_step_checklist')
                .insert(checklistItems)

              if (checklistError) {
                console.error('Error creating checklist items:', checklistError)
              }
            }
          }

          // Insert images for this step
          if (step.images.length > 0 && stepData) {
            const stepImages = step.images.map((image, index) => ({
              job_step_id: stepData.id,
              image_url: image.url,
              caption: image.caption || null,
              image_order: index + 1,
            }))

            const { error: imagesError } = await supabase
              .from('job_step_images')
              .insert(stepImages)

            if (imagesError) {
              console.error('Error saving step images:', imagesError)
            }
          }
        }
      }

      // Redirect back to jobs page
      router.push('/employer/jobs')
    } catch (error: unknown) {
      console.error('Error updating job:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || JSON.stringify(error)
      alert(`Failed to update job template: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('job_templates')
        .delete()
        .eq('id', jobId)

      if (error) throw error

      router.push('/employer/jobs')
    } catch (error: unknown) {
      console.error('Error deleting job:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || JSON.stringify(error)
      alert(`Failed to delete job: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-gray-500">Loading job...</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-gray-500">Job not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Job</h1>
        </div>

        {/* Job Code Display */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Job Code</p>
                <p className="text-lg font-mono font-semibold">{job.job_code}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                job.status === 'ACTIVE'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {job.status}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Selector */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Select
                value={formData.customer_id}
                onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
              >
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.full_name} ({customer.customer_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Kitchen Deep Clean"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the job..."
                rows={4}
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, Province"
              />
            </div>

            {/* Duration and Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  placeholder="120"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price per Hour ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price_per_hour}
                  onChange={(e) => setFormData({ ...formData, price_per_hour: e.target.value })}
                  placeholder="25.00"
                  min="0"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes visible only to you..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Step-by-Step Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <StepBuilder steps={steps} onChange={setSteps} />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => handleSubmit('DRAFT')}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button
            onClick={() => handleSubmit('ACTIVE')}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Saving...' : 'Save & Activate'}
          </Button>
        </div>

        {/* Delete Button */}
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={loading}
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Delete Job
        </Button>
      </div>
    </div>
  )
}
