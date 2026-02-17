'use client'

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer, DayOfWeek, Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { createJobSessions as createJobSessionsShared } from '@/lib/jobs/sessionGenerator'
import { Button } from '@/components/ui/button'
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
import { parsePptxToSteps } from '@/lib/pptx/parsePptx'
import { X, Plus, Calendar, Upload, ImageIcon, ArrowLeft, Video, FileSpreadsheet } from 'lucide-react'
import Image from 'next/image'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function NewJobPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employerId, setEmployerId] = useState<string>('')
  const [steps, setSteps] = useState<Step[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [pptxFile, setPptxFile] = useState<File | null>(null)
  const [pptxFileName, setPptxFileName] = useState<string | null>(null)
  const [importingPptx, setImportingPptx] = useState(false)

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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [newExcludeDate, setNewExcludeDate] = useState('')

  const DAYS_OF_WEEK = [
    { value: 'SUN', label: t('Sunday') },
    { value: 'MON', label: t('Monday') },
    { value: 'TUE', label: t('Tuesday') },
    { value: 'WED', label: t('Wednesday') },
    { value: 'THU', label: t('Thursday') },
    { value: 'FRI', label: t('Friday') },
    { value: 'SAT', label: t('Saturday') },
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
        .eq('created_by', employer.id)
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

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(t('Video must be less than 50MB'))
        return
      }
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoPreview(url)
    }
  }

  const uploadVideo = async (jobTemplateId: string): Promise<string | null> => {
    if (!videoFile) return null

    try {
      const fileExt = videoFile.name.split('.').pop()
      const fileName = `${jobTemplateId}.${fileExt}`
      const filePath = `job-videos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('job-images')
        .upload(filePath, videoFile, {
          upsert: true,
          contentType: videoFile.type || 'video/mp4',
        })

      if (uploadError) {
        console.error('Error uploading video:', uploadError)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('job-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading video:', error)
      return null
    }
  }

  const handlePptxImport = async (file: File) => {
    setImportingPptx(true)
    try {
      const parsedSlides = await parsePptxToSteps(file)

      const importedSteps: Step[] = []

      for (let i = 0; i < parsedSlides.length; i++) {
        const slide = parsedSlides[i]
        const stepImages: { url: string; caption: string }[] = []

        // Upload each image from the slide to Supabase storage
        for (const img of slide.images) {
          const fileExt = img.filename.split('.').pop() || 'png'
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
          const filePath = `step-images/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('job-images')
            .upload(filePath, img.blob)

          if (uploadError) {
            console.error('Error uploading PPTX image:', uploadError)
            continue
          }

          const { data: { publicUrl } } = supabase.storage
            .from('job-images')
            .getPublicUrl(filePath)

          stepImages.push({ url: publicUrl, caption: '' })
        }

        importedSteps.push({
          step_order: i + 1,
          title: slide.title,
          description: slide.description,
          products_needed: '',
          checklist_items: [],
          images: stepImages,
        })
      }

      setSteps(importedSteps)

      // Also set the file for upload as pptx_url reference
      setPptxFile(file)
      setPptxFileName(file.name)

      toast.success(`${importedSteps.length} ${t('steps imported from PPTX')}`)
    } catch (error) {
      console.error('Error parsing PPTX:', error)
      toast.error(t('Failed to parse PPTX file'))
    } finally {
      setImportingPptx(false)
    }
  }

  const uploadPptx = async (jobTemplateId: string): Promise<string | null> => {
    if (!pptxFile) return null

    try {
      const fileExt = pptxFile.name.split('.').pop()
      const fileName = `${jobTemplateId}.${fileExt}`
      const filePath = `job-pptx/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('job-images')
        .upload(filePath, pptxFile, { upsert: true })

      if (uploadError) {
        console.error('Error uploading PPTX:', uploadError)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('job-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading PPTX:', error)
      return null
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
    preferredEmployeeId?: string
  ) => {
    await createJobSessionsShared(supabase, jobTemplateId, jobCode, sessionData, 1, preferredEmployeeId)
  }

  const handleSubmit = async (status: 'DRAFT' | 'ACTIVE') => {
    try {
      setLoading(true)

      // Auto-include any pending From/To dates that haven't been added yet
      if (dateFrom) {
        const end = dateTo || dateFrom
        const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(end) })
        const newDates = days.map(d => format(d, 'yyyy-MM-dd'))
        const merged = [...new Set([...formData.specific_dates, ...newDates])].sort()
        formData.specific_dates = merged
        setDateFrom('')
        setDateTo('')
      }

      // Validate employer ID is set
      if (!employerId) {
        toast.error(t('Session error. Please refresh the page.'))
        return
      }

      // Validate required fields
      if (!formData.title || !formData.client_code) {
        toast.error(t('Please fill in title and client code'))
        return
      }

      if (formData.client_code.length !== 3) {
        toast.error(t('Client code must be exactly 3 letters'))
        return
      }

      // Validate dates when activating a non-recurring job
      if (status === 'ACTIVE' && !formData.is_recurring && formData.specific_dates.length === 0) {
        toast.error(t('Please add at least one date before activating'))
        return
      }

      // Validate time windows
      if (formData.window_start_day && formData.window_end_day &&
          formData.window_start_day === formData.window_end_day &&
          formData.time_window_start && formData.time_window_end) {
        if (formData.time_window_end <= formData.time_window_start) {
          toast.error(t('End time must be after start time when start and end days are the same'))
          return
        }
      }

      // Generate job code
      const codeData = await generateJobCode(formData.client_code)
      if (!codeData) {
        toast.error(t('Failed to generate job code'))
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

      const templateId = data.id

      try {
        // Upload image if provided
        if (imageFile) {
          const imageUrl = await uploadImage(templateId)
          if (imageUrl) {
            await supabase
              .from('job_templates')
              .update({ image_url: imageUrl })
              .eq('id', templateId)
          }
        }

        // Upload video if provided
        if (videoFile) {
          const videoUrl = await uploadVideo(templateId)
          if (videoUrl) {
            await supabase
              .from('job_templates')
              .update({ video_url: videoUrl })
              .eq('id', templateId)
          }
        }

        // Upload PPTX if provided
        if (pptxFile) {
          const pptxUrl = await uploadPptx(templateId)
          if (pptxUrl) {
            await supabase
              .from('job_templates')
              .update({ pptx_url: pptxUrl })
              .eq('id', templateId)
          }
        }

        // If job is being activated, create job sessions for the calendar
        if (status === 'ACTIVE') {
          await createJobSessions(templateId, data.job_code, formData, formData.preferred_employee_id || undefined)
        }

        // Insert steps if any
        if (steps.length > 0) {
          for (const step of steps) {
            // Insert job step
            const { data: stepData, error: stepError } = await supabase
              .from('job_steps')
              .insert({
                job_template_id: templateId,
                step_order: step.step_order,
                title: step.title,
                description: step.description || null,
                products_needed: step.products_needed || null,
              })
              .select()
              .single()

            if (stepError) {
              throw new Error(`Failed to create step "${step.title}": ${stepError.message}`)
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
                  throw new Error(`Failed to create checklist for step "${step.title}": ${checklistError.message}`)
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
                throw new Error(`Failed to save images for step "${step.title}": ${imagesError.message}`)
              }
            }
          }
        }
      } catch (innerError) {
        // Cleanup: delete the template (cascade will remove steps, checklist, images, sessions)
        console.error('Error during job creation, cleaning up template:', innerError)
        await supabase.from('job_templates').delete().eq('id', templateId)
        throw innerError
      }

      // Redirect back to jobs page
      router.push('/employer/jobs')
    } catch (error: unknown) {
      console.error('Error creating job:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || JSON.stringify(error)
      toast.error(`${t('Failed to create job')}: ${errorMessage}`)
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
    <div className="min-h-screen p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            disabled={loading}
            className="p-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-white">{t('Create New Job')}</h1>
        </div>

        {/* Job Details Section */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-white/20 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-white">{t('Job Details')}</h2>

          {/* Job Type Selection */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">{t('Job Type')}</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, customer_id: '', client_code: 'RND', address: '' })}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${formData.customer_id === '' && formData.client_code === 'RND' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {t('Random Job')}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, client_code: '' })}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${formData.customer_id !== '' || formData.client_code !== 'RND' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {t('Customer Job')}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {t('Random jobs use code RND. Customer jobs link to a customer profile.')}
            </p>
          </div>

          {/* Customer Selector (shown only for Customer Jobs) */}
          {formData.client_code !== 'RND' && (
            <div className="space-y-2">
              <Label htmlFor="customer" className="text-gray-300 text-sm">{t('Customer')}</Label>
              <Select
                value={formData.customer_id}
                onValueChange={handleCustomerChange}
              >
                <SelectTrigger id="customer" className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder={t('Select a customer')} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-white/20">
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id} className="text-white hover:bg-white/10">
                      {customer.full_name} ({customer.customer_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {t('Selecting a customer will auto-fill the client code and address')}
              </p>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-gray-300 text-sm">{t('Job Title')} *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('e.g., Kitchen Deep Clean')}
              required
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Job Image */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">{t('Job Image')}</Label>
            <div className="flex gap-4 items-start">
              {/* Preview */}
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden bg-white/5">
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Job preview"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-gray-500" />
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
                  <div className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors w-fit text-gray-300">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">{imageFile ? t('Change image') : t('Upload image')}</span>
                  </div>
                </label>
                <p className="text-xs text-gray-500">
                  {t('This image will be shown to employees in the marketplace')}
                </p>
                {imageFile && (
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null) }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    {t('Remove image')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Job Video */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">{t('Job Video')}</Label>
            <div className="flex gap-4 items-start">
              {/* Preview */}
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden bg-white/5">
                {videoPreview ? (
                  <video
                    src={videoPreview}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <Video className="h-8 w-8 text-gray-500" />
                )}
              </div>
              {/* Upload Button */}
              <div className="flex-1 space-y-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={handleVideoChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors w-fit text-gray-300">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">{videoFile ? t('Change video') : t('Upload video')}</span>
                  </div>
                </label>
                <p className="text-xs text-gray-500">
                  {t('This video gives employees a preview of the job')}
                </p>
                {videoFile && (
                  <button
                    type="button"
                    onClick={() => { setVideoFile(null); setVideoPreview(null) }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    {t('Remove video')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Import PPTX as Steps */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">{t('Procedures File')}</Label>
            <div className="flex gap-4 items-start">
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden bg-white/5">
                <FileSpreadsheet className={`h-8 w-8 ${pptxFileName ? 'text-orange-400' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1 space-y-2">
                <label className={`${importingPptx ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="file"
                    accept=".pptx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 50 * 1024 * 1024) {
                          toast.error(t('File must be less than 50MB'))
                          return
                        }
                        handlePptxImport(file)
                      }
                      e.target.value = ''
                    }}
                    className="hidden"
                    disabled={importingPptx}
                  />
                  <div className="flex items-center gap-2 px-4 py-2 border border-orange-500/30 rounded-lg hover:bg-orange-500/10 transition-colors w-fit text-orange-300">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="text-sm">
                      {importingPptx ? t('Parsing PPTX...') : t('Import PPTX as Steps')}
                    </span>
                  </div>
                </label>
                <p className="text-xs text-gray-500">
                  {t('Upload a PowerPoint file with step-by-step procedures')}
                </p>
                {pptxFileName && (
                  <p className="text-xs text-orange-300">{pptxFileName}</p>
                )}
                {pptxFile && (
                  <button
                    type="button"
                    onClick={() => { setPptxFile(null); setPptxFileName(null) }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    {t('Remove file')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-300 text-sm">{t('Description')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('Describe the job...')}
              rows={4}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-gray-300 text-sm">{t('Address')}</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder={t('123 Main St, City, Province')}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Client Code (hidden for Random Jobs) */}
          {formData.client_code !== 'RND' && (
            <div className="space-y-2">
              <Label htmlFor="client_code" className="text-gray-300 text-sm">{t('Client Code')} *</Label>
              <Input
                id="client_code"
                value={formData.client_code}
                onChange={(e) => setFormData({ ...formData, client_code: e.target.value.toUpperCase() })}
                placeholder="ABC"
                maxLength={3}
                className="uppercase bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                required
              />
              <p className="text-xs text-gray-500">
                {t('3-letter code that identifies the client (e.g., ABC)')}
              </p>
            </div>
          )}
        </div>

        {/* Pricing & Duration Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-white">{t('Pricing & Duration')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-gray-300 text-sm">{t('Duration (minutes)')}</Label>
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
              <Label htmlFor="price" className="text-gray-300 text-sm">{t('Price per Hour ($)')}</Label>
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
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-xl border border-white/20 p-4 space-y-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('Scheduling')}
          </h2>

          {/* Job Type Toggle */}
          <div className="space-y-3">
            <Label className="text-gray-300 text-sm">{t('Job Type')}</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_recurring: false })}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!formData.is_recurring ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {t('One-time')}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_recurring: true })}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${formData.is_recurring ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                {t('Recurring')}
              </button>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Time Window */}
          <div className="space-y-4">
            <Label className="text-gray-300 text-sm font-semibold">{t('Job Window')}</Label>
            <p className="text-xs text-gray-500">
              {t('When can this job be done? Employee can complete it anytime within this window.')}
            </p>

            <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{t('From Day')}</Label>
                  <Select
                    value={formData.window_start_day}
                    onValueChange={(value) => setFormData({ ...formData, window_start_day: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder={t('Select day')} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-white/20">
                      {DAYS_OF_WEEK.map(day => (
                        <SelectItem key={day.value} value={day.value} className="text-white hover:bg-white/10">{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{t('From Time')}</Label>
                  <Select
                    value={formData.time_window_start}
                    onValueChange={(value) => setFormData({ ...formData, time_window_start: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder={t('Start time')} />
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
                <span className="text-gray-500 text-sm">{t('to')}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{t('To Day')}</Label>
                  <Select
                    value={formData.window_end_day}
                    onValueChange={(value) => setFormData({ ...formData, window_end_day: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder={t('Select day')} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-white/20">
                      {DAYS_OF_WEEK.map(day => (
                        <SelectItem key={day.value} value={day.value} className="text-white hover:bg-white/10">{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{t('To Time')}</Label>
                  <Select
                    value={formData.time_window_end}
                    onValueChange={(value) => setFormData({ ...formData, time_window_end: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder={t('End time')} />
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
              <Label className="text-gray-300 text-sm font-semibold">{t('Recurring Period')}</Label>
              <p className="text-xs text-gray-500">
                {t('One job session will be created for each week in this period.')}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{t('Start Date')}</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">{t('End Date')}</Label>
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
                <Label className="text-gray-300 text-sm">{t('Skip Dates (Optional)')}</Label>
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
                      <Badge key={date} variant="outline" className="flex items-center gap-1 bg-red-500/20 text-red-300 border-red-500/30">
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
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Label className="text-gray-300 text-sm font-semibold">{t('Select Date(s)')}</Label>
              <p className="text-xs text-gray-500">
                {t('Pick the specific date(s) when this job should be done.')}
              </p>

              {/* Date range: From / To */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">{t('From')}</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">{t('To')}</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    min={dateFrom || format(new Date(), 'yyyy-MM-dd')}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (dateFrom) {
                    const end = dateTo || dateFrom
                    const days = eachDayOfInterval({
                      start: parseISO(dateFrom),
                      end: parseISO(end),
                    })
                    const newDates = days.map(d => format(d, 'yyyy-MM-dd'))
                    const merged = [...new Set([...formData.specific_dates, ...newDates])].sort()
                    setFormData({ ...formData, specific_dates: merged })
                    setDateFrom('')
                    setDateTo('')
                  }
                }}
                disabled={!dateFrom}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('Add')}
              </Button>

              {formData.specific_dates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.specific_dates.map(date => (
                    <Badge key={date} variant="secondary" className="flex items-center gap-1 py-1 bg-white/10 text-gray-200 border border-white/20">
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
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-white/10" />

          {/* Preferred Employee */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">{t('Assign To (Optional)')}</Label>
            <Select
              value={formData.preferred_employee_id || 'none'}
              onValueChange={(value) => setFormData({ ...formData, preferred_employee_id: value === 'none' ? '' : value })}
            >
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder={t('Anyone available')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-white/20">
                <SelectItem value="none" className="text-white hover:bg-white/10">{t('Anyone available')}</SelectItem>
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
          <h2 className="text-lg font-semibold text-white">{t('Instructions (Optional)')}</h2>
          <StepBuilder steps={steps} onChange={setSteps} />
        </div>

        {/* Internal Notes Section */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
          <h2 className="text-lg font-semibold text-white">{t('Internal Notes')}</h2>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder={t('Notes visible only to you (not shown to employees)...')}
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
            {loading ? t('Saving...') : t('Save as Draft')}
          </Button>
          <Button
            onClick={() => handleSubmit('ACTIVE')}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? t('Saving...') : t('Activate Job')}
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          {t('Draft jobs can be edited later. Active jobs appear in the employee marketplace.')}
        </p>
      </div>
    </div>
  )
}
