'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer, DayOfWeek } from '@/types/database'
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

export default function NewJobPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employerId, setEmployerId] = useState<string>('')

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
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
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
    } catch (error) {
      console.error('Error fetching initial data:', error)
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

  const handleSubmit = async (status: 'DRAFT' | 'ACTIVE') => {
    try {
      setLoading(true)

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

      // Prepare job template data
      const jobTemplate = {
        ...codeData,
        title: formData.title,
        description: formData.description || null,
        address: formData.address || null,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        price_per_hour: formData.price_per_hour ? parseFloat(formData.price_per_hour) : null,
        customer_id: formData.customer_id || null,
        timezone: formData.timezone,
        available_days: [] as DayOfWeek[],
        time_window_start: null,
        time_window_end: null,
        is_recurring: formData.is_recurring,
        frequency_per_week: null,
        status: status,
        created_by: employerId,
        notes: null,
      }

      // Insert job template
      const { data, error } = await supabase
        .from('job_templates')
        .insert(jobTemplate)
        .select()
        .single()

      if (error) throw error

      // Redirect back to jobs page
      router.push('/employer/jobs')
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Failed to create job template. Please try again.')
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
            {/* Customer Selector (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer (Optional)</Label>
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

            {/* Client Code */}
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
