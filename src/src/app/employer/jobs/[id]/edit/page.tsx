'use client'

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Customer, JobTemplate, DayOfWeek, Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { addDays, format, parseISO, nextDay, startOfDay } from 'date-fns'
import { createJobSessions as createJobSessionsShared, getNextSessionNumber } from '@/lib/jobs/sessionGenerator'
import { Button } from '@/components/ui/button'
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
import { X, Plus, Calendar, ArrowLeft, Trash2, Briefcase, DollarSign, ListChecks, FileText } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function EditJobPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [job, setJob] = useState<JobTemplate | null>(null)
  const [steps, setSteps] = useState<Step[]>([])

  // Scheduling state
  const [newSpecificDate, setNewSpecificDate] = useState('')
  const [newExcludeDate, setNewExcludeDate] = useState('')

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
    // Window-based scheduling
    window_start_day: '' as string,
    window_end_day: '' as string,
    time_window_start: '',
    time_window_end: '',
    // Scheduling dates
    specific_dates: [] as string[],
    start_date: '',
    end_date: '',
    exclude_dates: [] as string[],
    preferred_employee_id: '',
  })

  const DAYS_OF_WEEK = [
    { value: 'SUN', label: 'Sunday' },
    { value: 'MON', label: 'Monday' },
    { value: 'TUE', label: 'Tuesday' },
    { value: 'WED', label: 'Wednesday' },
    { value: 'THU', label: 'Thursday' },
    { value: 'FRI', label: 'Friday' },
    { value: 'SAT', label: 'Saturday' },
  ]

  const TIME_OPTIONS = [
    '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
  ]

  const formatTime12h = (time: string) => {
    const hour = parseInt(time.split(':')[0])
    if (hour === 0) return '12:00 AM'
    if (hour < 12) return `${hour}:00 AM`
    if (hour === 12) return '12:00 PM'
    return `${hour - 12}:00 PM`
  }

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
        // Window-based scheduling
        window_start_day: jobData.window_start_day || '',
        window_end_day: jobData.window_end_day || '',
        time_window_start: jobData.time_window_start || '',
        time_window_end: jobData.time_window_end || '',
        // Scheduling dates
        specific_dates: jobData.specific_dates || [],
        start_date: jobData.start_date || '',
        end_date: jobData.end_date || '',
        exclude_dates: jobData.exclude_dates || [],
        preferred_employee_id: jobData.preferred_employee_id || '',
      })

      // Fetch customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('created_by', employer.id)
        .eq('status', 'ACTIVE')
        .order('full_name', { ascending: true })

      setCustomers(customersData || [])

      // Fetch employees
      const { data: employeesData } = await supabase
        .from('employees')
        .select('*')
        .eq('created_by', employer.id)
        .eq('status', 'ACTIVE')
        .order('full_name', { ascending: true })

      setEmployees(employeesData || [])

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

  /**
   * Create job sessions using shared utility
   */
  const createJobSessions = async (
    jobTemplateId: string,
    jobCode: string,
    sessionData: {
      is_recurring: boolean
      window_start_day: string
      window_end_day: string
      time_window_start: string
      time_window_end: string
      start_date: string
      end_date: string
      specific_dates: string[]
      exclude_dates: string[]
    },
    startingSessionNumber: number = 1,
    preferredEmployeeId?: string
  ) => {
    await createJobSessionsShared(supabase, jobTemplateId, jobCode, sessionData, startingSessionNumber, preferredEmployeeId)
  }

  /**
   * Detect if scheduling fields changed between old job and new form data
   */
  const hasScheduleChanged = (): boolean => {
    if (!job) return false
    return (
      (job.window_start_day || '') !== formData.window_start_day ||
      (job.window_end_day || '') !== formData.window_end_day ||
      (job.time_window_start || '') !== formData.time_window_start ||
      (job.time_window_end || '') !== formData.time_window_end ||
      (job.start_date || '') !== formData.start_date ||
      (job.end_date || '') !== formData.end_date ||
      (job.is_recurring || false) !== formData.is_recurring ||
      JSON.stringify(job.specific_dates || []) !== JSON.stringify(formData.specific_dates) ||
      JSON.stringify(job.exclude_dates || []) !== JSON.stringify(formData.exclude_dates)
    )
  }

  /**
   * Regenerate OFFERED sessions when schedule changes on an active job.
   * Keeps CLAIMED/APPROVED/IN_PROGRESS/COMPLETED sessions untouched.
   */
  const regenerateOfferedSessions = async () => {
    if (!job) return

    // Delete only OFFERED sessions (safe — nobody claimed them)
    const { error: deleteError } = await supabase
      .from('job_sessions')
      .delete()
      .eq('job_template_id', jobId)
      .eq('status', 'OFFERED')

    if (deleteError) {
      console.error('Error deleting OFFERED sessions:', deleteError)
      return
    }

    // Get next session number to avoid code collisions
    const nextNum = await getNextSessionNumber(supabase, jobId)

    // Generate new sessions (APPROVED if preferred employee, otherwise OFFERED)
    await createJobSessions(jobId, job.job_code, {
      is_recurring: formData.is_recurring,
      window_start_day: formData.window_start_day,
      window_end_day: formData.window_end_day,
      time_window_start: formData.time_window_start,
      time_window_end: formData.time_window_end,
      start_date: formData.start_date,
      end_date: formData.end_date,
      specific_dates: formData.specific_dates,
      exclude_dates: formData.exclude_dates,
    }, nextNum, formData.preferred_employee_id || undefined)
  }

  const handleSubmit = async (status: 'DRAFT' | 'ACTIVE') => {
    try {
      setLoading(true)

      if (!job) {
        toast.error('Job data not loaded')
        return
      }

      // Validate required fields
      if (!formData.title) {
        toast.error('Please fill in the job title')
        return
      }

      // Validate time windows
      if (formData.window_start_day && formData.window_end_day &&
          formData.window_start_day === formData.window_end_day &&
          formData.time_window_start && formData.time_window_end) {
        if (formData.time_window_end <= formData.time_window_start) {
          toast.error('End time must be after start time when start and end days are the same')
          return
        }
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
        // Window-based scheduling fields
        window_start_day: formData.window_start_day || null,
        window_end_day: formData.window_end_day || null,
        time_window_start: formData.time_window_start || null,
        time_window_end: formData.time_window_end || null,
        // Scheduling dates
        specific_dates: formData.specific_dates.length > 0 ? formData.specific_dates : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        exclude_dates: formData.exclude_dates.length > 0 ? formData.exclude_dates : null,
        preferred_employee_id: formData.preferred_employee_id || null,
        // Legacy fields (keep for backward compatibility)
        available_days: [],
        frequency_per_week: null,
      }

      // Update job template
      const { error } = await supabase
        .from('job_templates')
        .update(updateData)
        .eq('id', jobId)

      if (error) throw error

      // Handle session creation/regeneration based on status transitions
      if (job.status === 'DRAFT' && status === 'ACTIVE') {
        // DRAFT -> ACTIVE: Create sessions from scratch
        await createJobSessions(jobId, job.job_code, {
          is_recurring: formData.is_recurring,
          window_start_day: formData.window_start_day,
          window_end_day: formData.window_end_day,
          time_window_start: formData.time_window_start,
          time_window_end: formData.time_window_end,
          start_date: formData.start_date,
          end_date: formData.end_date,
          specific_dates: formData.specific_dates,
          exclude_dates: formData.exclude_dates,
        }, 1, formData.preferred_employee_id || undefined)
      } else if (job.status === 'ACTIVE' && status === 'ACTIVE' && hasScheduleChanged()) {
        // ACTIVE -> ACTIVE with schedule changes: Regenerate OFFERED sessions
        await regenerateOfferedSessions()
      }

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
      toast.error(`Failed to update job template: ${errorMessage}`)
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
      toast.error(`Failed to delete job: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return <LoadingSpinner fullScreen />
  }

  if (!job) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <p className="text-gray-400">Job not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-white">Edit Job</h1>
        </div>

        {/* Job Code + Status Header */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-white/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-gray-800/80 text-white font-bold text-xs px-3 py-1.5 rounded-full font-mono border border-white/30">
                {job.job_code}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                job.status === 'ACTIVE'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
              }`}>
                {job.status}
              </span>
            </div>
          </div>
        </div>

        {/* Job Details Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Job Details</h2>
          </div>

          {/* Customer Selector */}
          <div className="space-y-2">
            <Label htmlFor="customer" className="text-gray-300 text-sm">Customer</Label>
            <Select
              value={formData.customer_id}
              onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
            >
              <SelectTrigger id="customer" className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id} className="text-white hover:bg-white/10">
                    {customer.full_name} ({customer.customer_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-gray-300 text-sm">Job Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Kitchen Deep Clean"
              required
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-300 text-sm">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the job..."
              rows={4}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-gray-300 text-sm">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main St, City, Province"
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Pricing & Duration Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Pricing & Duration</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-gray-300 text-sm">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                placeholder="120"
                min="0"
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price" className="text-gray-300 text-sm">Price per Hour ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price_per_hour}
                onChange={(e) => setFormData({ ...formData, price_per_hour: e.target.value })}
                placeholder="25.00"
                min="0"
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Scheduling Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Scheduling</h2>
          </div>

          {/* Job Type Toggle */}
          <div className="space-y-3">
            <Label className="text-gray-300 text-sm">Job Type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_recurring: false })}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !formData.is_recurring
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                One-time
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_recurring: true })}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.is_recurring
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Recurring
              </button>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Time Window */}
          <div className="space-y-4">
            <Label className="text-gray-300 text-sm">Job Window</Label>
            <p className="text-xs text-gray-500">
              When can this job be done? Employee can complete it anytime within this window.
            </p>

            <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">From Day</Label>
                  <Select
                    value={formData.window_start_day}
                    onValueChange={(value) => setFormData({ ...formData, window_start_day: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-white/20">
                      {DAYS_OF_WEEK.map(day => (
                        <SelectItem key={day.value} value={day.value} className="text-white hover:bg-white/10">{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">From Time</Label>
                  <Select
                    value={formData.time_window_start}
                    onValueChange={(value) => setFormData({ ...formData, time_window_start: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder="Start time" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-white/20">
                      {TIME_OPTIONS.map(time => (
                        <SelectItem key={time} value={time} className="text-white hover:bg-white/10">{formatTime12h(time)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-center">
                <span className="text-gray-500 text-sm">to</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">To Day</Label>
                  <Select
                    value={formData.window_end_day}
                    onValueChange={(value) => setFormData({ ...formData, window_end_day: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-white/20">
                      {DAYS_OF_WEEK.map(day => (
                        <SelectItem key={day.value} value={day.value} className="text-white hover:bg-white/10">{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">To Time</Label>
                  <Select
                    value={formData.time_window_end}
                    onValueChange={(value) => setFormData({ ...formData, time_window_end: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder="End time" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-white/20">
                      {TIME_OPTIONS.map(time => (
                        <SelectItem key={time} value={time} className="text-white hover:bg-white/10">{formatTime12h(time)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Window Preview */}
              {formData.window_start_day && formData.window_end_day && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mt-2">
                  <p className="text-sm text-blue-300 font-medium">
                    {DAYS_OF_WEEK.find(d => d.value === formData.window_start_day)?.label} {formData.time_window_start ? formatTime12h(formData.time_window_start) : ''}
                    {' → '}
                    {DAYS_OF_WEEK.find(d => d.value === formData.window_end_day)?.label} {formData.time_window_end ? formatTime12h(formData.time_window_end) : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Date Range or Specific Dates */}
          {formData.is_recurring ? (
            <div className="space-y-4">
              <Label className="text-gray-300 text-sm">Recurring Period</Label>
              <p className="text-xs text-gray-500">
                One job session will be created for each week in this period.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.start_date || undefined}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>

              {/* Skip Dates */}
              <div className="space-y-2 pt-2">
                <Label className="text-gray-300 text-sm">Skip Dates (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newExcludeDate}
                    onChange={(e) => setNewExcludeDate(e.target.value)}
                    className="flex-1 bg-white/5 border-white/20 text-white"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (newExcludeDate && !formData.exclude_dates.includes(newExcludeDate)) {
                        setFormData({
                          ...formData,
                          exclude_dates: [...formData.exclude_dates, newExcludeDate].sort()
                        })
                        setNewExcludeDate('')
                      }
                    }}
                    disabled={!newExcludeDate}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.exclude_dates.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.exclude_dates.map(date => (
                      <span key={date} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                        {format(parseISO(date), 'MMM d')}
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            exclude_dates: formData.exclude_dates.filter(d => d !== date)
                          })}
                          className="ml-1 hover:text-red-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Label className="text-gray-300 text-sm">Select Date(s)</Label>
              <p className="text-xs text-gray-500">
                Pick the specific date(s) when this job should be done.
              </p>

              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newSpecificDate}
                  onChange={(e) => setNewSpecificDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="flex-1 bg-white/5 border-white/20 text-white"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (newSpecificDate && !formData.specific_dates.includes(newSpecificDate)) {
                      setFormData({
                        ...formData,
                        specific_dates: [...formData.specific_dates, newSpecificDate].sort()
                      })
                      setNewSpecificDate('')
                    }
                  }}
                  disabled={!newSpecificDate}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              {formData.specific_dates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.specific_dates.map(date => (
                    <span key={date} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {format(parseISO(date), 'EEE, MMM d')}
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          specific_dates: formData.specific_dates.filter(d => d !== date)
                        })}
                        className="ml-1 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-white/10" />

          {/* Preferred Employee */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">Assign To (Optional)</Label>
            <Select
              value={formData.preferred_employee_id || 'none'}
              onValueChange={(value) => setFormData({ ...formData, preferred_employee_id: value === 'none' ? '' : value })}
            >
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder="Anyone available" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="none" className="text-white hover:bg-white/10">Anyone available</SelectItem>
                {employees.map(employee => (
                  <SelectItem key={employee.id} value={employee.id} className="text-white hover:bg-white/10">
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Instructions Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Instructions</h2>
            <span className="text-xs text-gray-500">(Optional)</span>
          </div>
          <StepBuilder steps={steps} onChange={setSteps} />
        </div>

        {/* Internal Notes Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Internal Notes</h2>
          </div>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Notes visible only to you..."
            rows={2}
            className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => handleSubmit('DRAFT')}
            disabled={loading}
            className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            {loading ? 'Saving...' : 'Save as Draft'}
          </Button>
          <Button
            onClick={() => handleSubmit('ACTIVE')}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'Saving...' : 'Save & Activate'}
          </Button>
        </div>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Delete Job
        </button>
      </div>
    </div>
  )
}
