'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer, DayOfWeek, Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { addDays, nextDay, format, parseISO, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StepBuilder, Step } from '@/components/employer/StepBuilder'
import { X, Plus, Calendar, Upload, ImageIcon } from 'lucide-react'
import Image from 'next/image'

export default function NewJobPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employerId, setEmployerId] = useState<string>('')
  const [steps, setSteps] = useState<Step[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_code: '',
    address: '',
    duration_minutes: '',
    price_per_hour: '',
    customer_id: '',
    timezone: 'America/Toronto',
    is_recurring: false,
    // Window-based scheduling
    window_start_day: '' as string,
    window_end_day: '' as string,
    time_window_start: '',
    time_window_end: '',
    notes: '',
    // Scheduling fields
    specific_dates: [] as string[],  // For one-time jobs
    start_date: '',  // For recurring jobs
    end_date: '',    // For recurring jobs
    exclude_dates: [] as string[],
    preferred_employee_id: '',
  })

  // Temp state for adding dates
  const [newSpecificDate, setNewSpecificDate] = useState('')
  const [newExcludeDate, setNewExcludeDate] = useState('')

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
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
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
        return
      }

      setEmployerId(employer.id)

      // Fetch customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('created_by', employer.id)
        .eq('status', 'ACTIVE')
        .order('full_name', { ascending: true })

      setCustomers(customersData || [])

      // Fetch active employees for preferred employee selection
      const { data: employeesData } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('full_name', { ascending: true })

      setEmployees(employeesData || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async (jobTemplateId: string): Promise<string | null> => {
    if (!imageFile) return null

    try {
      setUploadingImage(true)
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${jobTemplateId}.${fileExt}`
      const filePath = `job-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('job-images')
        .upload(filePath, imageFile, { upsert: true })

      if (uploadError) {
        console.error('Error uploading image:', uploadError)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('job-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const generateJobCode = async (clientCode: string) => {
    if (!clientCode || clientCode.length !== 3) return null

    // Find the next available template number for this client code
    const { data: existingJobs } = await supabase
      .from('job_templates')
      .select('template_number')
      .eq('client_code', clientCode.toUpperCase())
      .order('template_number', { ascending: false })
      .limit(1)

    let nextNumber = 1
    if (existingJobs && existingJobs.length > 0) {
      const lastNumber = parseInt(existingJobs[0].template_number)
      nextNumber = lastNumber + 1
    }

    const templateNumber = nextNumber.toString().padStart(2, '0')
    const versionLetter = 'A'
    const jobCode = `${clientCode.toUpperCase()}-${templateNumber}${versionLetter}`

    return {
      client_code: clientCode.toUpperCase(),
      template_number: templateNumber,
      version_letter: versionLetter,
      job_code: jobCode,
    }
  }

  /**
   * Create job sessions based on window-based scheduling
   *
   * Window-based model:
   * - A job has a time window from (start_day, start_time) to (end_day, end_time)
   * - Example: Friday 5pm to Sunday 8pm
   * - For recurring jobs: creates one session per week
   * - For one-time jobs: creates sessions for specific dates
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
    }
  ) => {
    try {
      // Map day abbreviations to date-fns day numbers (0 = Sunday, 1 = Monday, etc.)
      const dayMap: Record<string, number> = {
        'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6
      }

      const sessions: Array<{
        job_template_id: string
        session_code: string
        full_job_code: string
        scheduled_date: string
        scheduled_end_date: string | null
        scheduled_time: string | null
        status: string
      }> = []

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      let sessionCounter = 1

      const generateSessionCode = () => {
        const code = `A${String(sessionCounter).padStart(3, '0')}`
        sessionCounter++
        return code
      }

      // Parse exclude dates
      const excludeDates = new Set(sessionData.exclude_dates)

      console.log('=== SESSION CREATION (Window-based) ===')
      console.log('is_recurring:', sessionData.is_recurring)
      console.log('window:', sessionData.window_start_day, sessionData.time_window_start, '→', sessionData.window_end_day, sessionData.time_window_end)

      // Calculate how many days the window spans
      const startDayNum = dayMap[sessionData.window_start_day] ?? 0
      const endDayNum = dayMap[sessionData.window_end_day] ?? startDayNum
      let windowDays = endDayNum - startDayNum
      if (windowDays < 0) windowDays += 7 // Handle wrap around (e.g., Sat to Mon)
      if (windowDays === 0 && sessionData.window_start_day !== sessionData.window_end_day) windowDays = 7

      console.log('Window spans', windowDays, 'days')

      if (sessionData.is_recurring) {
        // Recurring: Create one session per week from start_date to end_date
        const startDate = sessionData.start_date ? new Date(sessionData.start_date + 'T00:00:00') : today
        const endDate = sessionData.end_date ? new Date(sessionData.end_date + 'T00:00:00') : addDays(today, 30)

        console.log('Date range:', format(startDate, 'yyyy-MM-dd'), 'to', format(endDate, 'yyyy-MM-dd'))

        // Find the first occurrence of window_start_day on or after startDate
        let currentDate = new Date(startDate)
        const targetDayNum = dayMap[sessionData.window_start_day]

        // Move to the first window_start_day
        while (currentDate.getDay() !== targetDayNum) {
          currentDate = addDays(currentDate, 1)
        }

        console.log('First window starts:', format(currentDate, 'yyyy-MM-dd (EEEE)'))

        // Create sessions week by week
        while (currentDate <= endDate) {
          const windowStart = new Date(currentDate)
          const windowEnd = addDays(windowStart, windowDays)
          const dateStr = format(windowStart, 'yyyy-MM-dd')

          // Check if this week should be skipped
          if (!excludeDates.has(dateStr)) {
            const sessionCode = generateSessionCode()
            sessions.push({
              job_template_id: jobTemplateId,
              session_code: sessionCode,
              full_job_code: `${jobCode}-${sessionCode}`,
              scheduled_date: dateStr,
              scheduled_end_date: windowDays > 0 ? format(windowEnd, 'yyyy-MM-dd') : null,
              scheduled_time: sessionData.time_window_start || null,
              status: 'OFFERED'
            })
            console.log(`Session ${sessionCode}: ${dateStr} → ${windowDays > 0 ? format(windowEnd, 'yyyy-MM-dd') : 'same day'}`)
          } else {
            console.log(`Skipped: ${dateStr} (excluded)`)
          }

          // Move to next week
          currentDate = addDays(currentDate, 7)
        }
      } else {
        // One-time: Create sessions for specific dates
        const datesToCreate = sessionData.specific_dates.filter(d => !excludeDates.has(d)).sort()

        console.log('Specific dates:', datesToCreate)

        for (const dateStr of datesToCreate) {
          const windowStart = new Date(dateStr + 'T00:00:00')
          const windowEnd = addDays(windowStart, windowDays)

          const sessionCode = generateSessionCode()
          sessions.push({
            job_template_id: jobTemplateId,
            session_code: sessionCode,
            full_job_code: `${jobCode}-${sessionCode}`,
            scheduled_date: dateStr,
            scheduled_end_date: windowDays > 0 ? format(windowEnd, 'yyyy-MM-dd') : null,
            scheduled_time: sessionData.time_window_start || null,
            status: 'OFFERED'
          })
          console.log(`Session ${sessionCode}: ${dateStr}`)
        }
      }

      // Insert all sessions
      if (sessions.length > 0) {
        const { error: sessionsError } = await supabase
          .from('job_sessions')
          .insert(sessions)

        if (sessionsError) {
          console.error('Error creating job sessions:', sessionsError)
        } else {
          console.log(`Created ${sessions.length} job session(s)`)
        }
      } else {
        console.log('No sessions to create')
      }
    } catch (error) {
      console.error('Error in createJobSessions:', error)
    }
  }

  const handleSubmit = async (status: 'DRAFT' | 'ACTIVE') => {
    try {
      setLoading(true)

      // Validate employer ID is set
      if (!employerId) {
        alert('Session error. Please refresh the page.')
        return
      }

      // Validate required fields
      if (!formData.title || !formData.client_code) {
        alert('Please fill in title and client code')
        return
      }

      if (formData.client_code.length !== 3) {
        alert('Client code must be exactly 3 letters')
        return
      }

      // Generate job code
      const codeData = await generateJobCode(formData.client_code)
      if (!codeData) {
        alert('Failed to generate job code')
        return
      }

      // Prepare job template data (job_code is generated by database)
      const jobTemplate = {
        client_code: codeData.client_code,
        template_number: codeData.template_number,
        version_letter: codeData.version_letter,
        title: formData.title,
        description: formData.description || null,
        address: formData.address || null,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        price_per_hour: formData.price_per_hour ? parseFloat(formData.price_per_hour) : null,
        customer_id: formData.customer_id || null,
        timezone: formData.timezone,
        // Window-based scheduling fields
        window_start_day: formData.window_start_day || null,
        window_end_day: formData.window_end_day || null,
        time_window_start: formData.time_window_start || null,
        time_window_end: formData.time_window_end || null,
        is_recurring: formData.is_recurring,
        status: status,
        created_by: employerId,
        notes: formData.notes || null,
        // Scheduling dates
        specific_dates: formData.specific_dates.length > 0 ? formData.specific_dates : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        exclude_dates: formData.exclude_dates.length > 0 ? formData.exclude_dates : null,
        preferred_employee_id: formData.preferred_employee_id || null,
        // Legacy fields (keep for backward compatibility)
        available_days: [] as DayOfWeek[],
        frequency_per_week: null,
      }

      // Insert job template
      const { data, error } = await supabase
        .from('job_templates')
        .insert(jobTemplate)
        .select()
        .single()

      if (error) throw error

      // Upload image if provided
      if (imageFile && data) {
        const imageUrl = await uploadImage(data.id)
        if (imageUrl) {
          await supabase
            .from('job_templates')
            .update({ image_url: imageUrl })
            .eq('id', data.id)
        }
      }

      // If job is being activated, create job sessions for the calendar
      if (status === 'ACTIVE' && data) {
        await createJobSessions(data.id, data.job_code, formData)
      }

      // Insert steps if any
      if (steps.length > 0 && data) {
        for (const step of steps) {
          // Insert job step
          const { data: stepData, error: stepError } = await supabase
            .from('job_steps')
            .insert({
              job_template_id: data.id,
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
      console.error('Error creating job:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || JSON.stringify(error)
      alert(`Failed to create job template: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerChange = (customerId: string) => {
    setFormData({ ...formData, customer_id: customerId })

    // Auto-fill client code from customer
    const customer = customers.find(c => c.id === customerId)
    if (customer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        client_code: customer.customer_code,
        address: customer.address || '',
      })
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Create New Job</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Job Type Selection */}
            <div className="space-y-2">
              <Label>Job Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.customer_id === '' && formData.client_code === 'RND' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, customer_id: '', client_code: 'RND', address: '' })}
                  className="flex-1"
                >
                  Random Job
                </Button>
                <Button
                  type="button"
                  variant={formData.customer_id !== '' || formData.client_code !== 'RND' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, client_code: '' })}
                  className="flex-1"
                >
                  Customer Job
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Random jobs use code RND. Customer jobs link to a customer profile.
              </p>
            </div>

            {/* Customer Selector (shown only for Customer Jobs) */}
            {formData.client_code !== 'RND' && (
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={handleCustomerChange}
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
                <p className="text-xs text-gray-500">
                  Selecting a customer will auto-fill the client code and address
                </p>
              </div>
            )}

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

            {/* Job Image */}
            <div className="space-y-2">
              <Label>Job Image</Label>
              <div className="flex gap-4 items-start">
                {/* Preview */}
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Job preview"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                {/* Upload Button */}
                <div className="flex-1 space-y-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors w-fit">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">{imageFile ? 'Change image' : 'Upload image'}</span>
                    </div>
                  </label>
                  <p className="text-xs text-gray-500">
                    This image will be shown to employees in the marketplace
                  </p>
                  {imageFile && (
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null) }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Client Code (hidden for Random Jobs) */}
            {formData.client_code !== 'RND' && (
              <div className="space-y-2">
                <Label htmlFor="client_code">Client Code *</Label>
                <Input
                  id="client_code"
                  value={formData.client_code}
                  onChange={(e) => setFormData({ ...formData, client_code: e.target.value.toUpperCase() })}
                  placeholder="ABC"
                  maxLength={3}
                  className="uppercase"
                  required
                />
                <p className="text-xs text-gray-500">
                  3-letter code that identifies the client (e.g., ABC)
                </p>
              </div>
            )}

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
                placeholder="Notes visible only to you (not shown to employees)..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Scheduling Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduling
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Job Type */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Job Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!formData.is_recurring ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({ ...formData, is_recurring: false })}
                  className="flex-1"
                >
                  One-time
                </Button>
                <Button
                  type="button"
                  variant={formData.is_recurring ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({ ...formData, is_recurring: true })}
                  className="flex-1"
                >
                  Recurring
                </Button>
              </div>
            </div>

            <div className="border-t border-gray-200" />

            {/* Step 2: Time Window */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Job Window</Label>
              <p className="text-sm text-gray-600">
                When can this job be done? Employee can complete it anytime within this window.
              </p>

              {/* Window Start */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">From Day</Label>
                    <Select
                      value={formData.window_start_day}
                      onValueChange={(value) => setFormData({ ...formData, window_start_day: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map(day => (
                          <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">From Time</Label>
                    <Select
                      value={formData.time_window_start}
                      onValueChange={(value) => setFormData({ ...formData, time_window_start: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Start time" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map(time => (
                          <SelectItem key={time} value={time}>{formatTime12h(time)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-center">
                  <span className="text-gray-400 text-sm">to</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">To Day</Label>
                    <Select
                      value={formData.window_end_day}
                      onValueChange={(value) => setFormData({ ...formData, window_end_day: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map(day => (
                          <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">To Time</Label>
                    <Select
                      value={formData.time_window_end}
                      onValueChange={(value) => setFormData({ ...formData, time_window_end: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="End time" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map(time => (
                          <SelectItem key={time} value={time}>{formatTime12h(time)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Window Preview */}
                {formData.window_start_day && formData.window_end_day && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                    <p className="text-sm text-blue-800 font-medium">
                      {DAYS_OF_WEEK.find(d => d.value === formData.window_start_day)?.label} {formData.time_window_start ? formatTime12h(formData.time_window_start) : ''}
                      {' → '}
                      {DAYS_OF_WEEK.find(d => d.value === formData.window_end_day)?.label} {formData.time_window_end ? formatTime12h(formData.time_window_end) : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200" />

            {/* Step 3: Date Range or Specific Dates */}
            {formData.is_recurring ? (
              <div className="space-y-4">
                <Label className="text-base font-semibold">Recurring Period</Label>
                <p className="text-sm text-gray-600">
                  One job session will be created for each week in this period.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Start Date</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">End Date</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      min={formData.start_date || undefined}
                    />
                  </div>
                </div>

                {/* Skip Dates */}
                <div className="space-y-2 pt-2">
                  <Label className="text-sm">Skip Dates (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={newExcludeDate}
                      onChange={(e) => setNewExcludeDate(e.target.value)}
                      className="flex-1"
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
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {formData.exclude_dates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.exclude_dates.map(date => (
                        <Badge key={date} variant="outline" className="flex items-center gap-1 text-red-600 border-red-300">
                          {format(parseISO(date), 'MMM d')}
                          <button
                            type="button"
                            onClick={() => setFormData({
                              ...formData,
                              exclude_dates: formData.exclude_dates.filter(d => d !== date)
                            })}
                            className="ml-1 hover:text-red-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Label className="text-base font-semibold">Select Date(s)</Label>
                <p className="text-sm text-gray-600">
                  Pick the specific date(s) when this job should be done.
                </p>

                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={newSpecificDate}
                    onChange={(e) => setNewSpecificDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="flex-1"
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
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
                {formData.specific_dates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.specific_dates.map(date => (
                      <Badge key={date} variant="secondary" className="flex items-center gap-1 py-1">
                        {format(parseISO(date), 'EEE, MMM d')}
                        <button
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            specific_dates: formData.specific_dates.filter(d => d !== date)
                          })}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-gray-200" />

            {/* Preferred Employee */}
            <div className="space-y-2">
              <Label>Assign To (Optional)</Label>
              <Select
                value={formData.preferred_employee_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, preferred_employee_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Anyone available" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Anyone available</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {loading ? 'Saving...' : 'Activate Job'}
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Draft jobs can be edited later. Active jobs appear in the employee marketplace.
        </p>
      </div>
    </div>
  )
}
