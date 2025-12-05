'use client'

/**
 * Customer Profile Page
 *
 * Displays detailed customer information including:
 * - Customer code (3 letters, e.g., ABC)
 * - Personal details (name, email, phone, address)
 * - Editable notes field for employer
 * - Job history (jobs linked to this customer)
 * - Evaluations submitted by this customer
 * - Strikes system with severity levels (Minor/Major/Critical)
 *
 * Employer can:
 * - View all customer information
 * - Edit customer details (name, email, phone, address, notes)
 * - Add strikes with severity and description
 * - View job history and evaluations
 * - Reactivate inactive customers
 */

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Customer, Strike, Evaluation, JobTemplate } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'

export default function CustomerProfilePage() {
  const router = useRouter()
  const params = useParams()
  const customerId = params.id as string
  const supabase = createClient()

  // Main state
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [strikes, setStrikes] = useState<Strike[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [jobs, setJobs] = useState<JobTemplate[]>([])
  const [employerId, setEmployerId] = useState<string>('')

  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  // Strike form state
  const [strikeDialogOpen, setStrikeDialogOpen] = useState(false)
  const [strikeForm, setStrikeForm] = useState({
    description: '',
    notes: '',
    severity: 'MINOR' as 'MINOR' | 'MAJOR' | 'CRITICAL',
  })
  const [submitting, setSubmitting] = useState(false)

  // Load all data when component mounts
  useEffect(() => {
    loadData()
  }, [customerId])

  /**
   * Loads customer data, strikes, evaluations, and linked jobs
   */
  const loadData = async () => {
    setLoading(true)
    try {
      // Get current user and employer for authorization
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) {
        router.push('/login')
        return
      }
      setEmployerId(employer.id)

      // Load customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError || !customerData) {
        console.error('Customer not found:', customerError)
        router.push('/employer/users')
        return
      }
      setCustomer(customerData)

      // Initialize edit form with current values
      setEditForm({
        full_name: customerData.full_name || '',
        email: customerData.email || '',
        phone: customerData.phone || '',
        address: customerData.address || '',
        notes: customerData.notes || '',
      })

      // Load strikes for this customer (target_type = CUSTOMER, target_id = customerId)
      const { data: strikesData } = await supabase
        .from('strikes')
        .select('*')
        .eq('target_type', 'CUSTOMER')
        .eq('target_id', customerId)
        .order('created_at', { ascending: false })

      setStrikes(strikesData || [])

      // Load evaluations submitted by this customer
      const { data: evalData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      setEvaluations(evalData || [])

      // Load job templates linked to this customer
      const { data: jobsData } = await supabase
        .from('job_templates')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      setJobs(jobsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Saves updated customer details
   */
  const handleSave = async () => {
    if (!editForm.full_name || !editForm.email) {
      alert('Name and email are required')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone || null,
          address: editForm.address || null,
          notes: editForm.notes || null,
        })
        .eq('id', customerId)

      if (error) throw error
      setEditing(false)
      await loadData()
    } catch (error) {
      console.error('Error saving customer:', error)
      alert('Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Adds a new strike to the customer's record
   * Strike severities: MINOR, MAJOR, CRITICAL
   */
  const handleAddStrike = async () => {
    if (!strikeForm.description) {
      alert('Please enter a description')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('strikes')
        .insert({
          target_type: 'CUSTOMER',
          target_id: customerId,
          date: new Date().toISOString().split('T')[0], // Today's date
          description: strikeForm.description,
          notes: strikeForm.notes || null,
          severity: strikeForm.severity,
          created_by: employerId,
        })

      if (error) throw error

      // Reset form and refresh data
      setStrikeDialogOpen(false)
      setStrikeForm({ description: '', notes: '', severity: 'MINOR' })
      await loadData()
    } catch (error) {
      console.error('Error adding strike:', error)
      alert('Failed to add strike')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Reactivates an inactive customer
   */
  const handleReactivate = async () => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ status: 'ACTIVE' })
        .eq('id', customerId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error reactivating customer:', error)
      alert('Failed to reactivate customer')
    }
  }

  // Helper: Maps customer status to badge color
  const getStatusColor = (status: Customer['status']) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500'
      case 'INACTIVE': return 'bg-gray-500'
      case 'BLOCKED': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  // Helper: Maps strike severity to badge color
  const getSeverityColor = (severity: Strike['severity']) => {
    switch (severity) {
      case 'MINOR': return 'bg-yellow-500'
      case 'MAJOR': return 'bg-orange-500'
      case 'CRITICAL': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  // Helper: Maps job status to badge color
  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500'
      case 'DRAFT': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-gray-500">Loading customer...</p>
      </div>
    )
  }

  // Not found state
  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-gray-500">Customer not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Customer Profile</h1>
        </div>

        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-lg">
                    {customer.customer_code}
                  </Badge>
                  <Badge className={getStatusColor(customer.status)}>
                    {customer.status}
                  </Badge>
                </div>
                <CardTitle className="text-xl">{customer.full_name}</CardTitle>
                <p className="text-gray-600">{customer.email}</p>
              </div>
              <div className="flex gap-2">
                {customer.status === 'INACTIVE' && (
                  <Button size="sm" onClick={handleReactivate}>
                    Reactivate
                  </Button>
                )}
                {!editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              // Edit mode - show form
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="Email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      placeholder="Address"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Notes about this customer..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setEditing(false)
                    // Reset form to current values
                    setEditForm({
                      full_name: customer.full_name || '',
                      email: customer.email || '',
                      phone: customer.phone || '',
                      address: customer.address || '',
                      notes: customer.notes || '',
                    })
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // View mode - show details
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{customer.phone || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium">{customer.address || 'Not provided'}</p>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-700">{customer.notes || 'No notes'}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Jobs, Evaluations, Strikes */}
        <Tabs defaultValue="jobs" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger>
            <TabsTrigger value="evaluations">Evaluations ({evaluations.length})</TabsTrigger>
            <TabsTrigger value="strikes">Strikes ({strikes.length})</TabsTrigger>
          </TabsList>

          {/* Jobs linked to this customer */}
          <TabsContent value="jobs" className="space-y-4 mt-4">
            {jobs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No jobs linked to this customer</p>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <Card key={job.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{job.title}</p>
                          <p className="text-sm text-gray-500 font-mono">{job.job_code}</p>
                          {job.address && (
                            <p className="text-sm text-gray-500">{job.address}</p>
                          )}
                          {job.is_recurring && (
                            <p className="text-sm text-gray-500">
                              Recurring: {job.frequency_per_week}x/week
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getJobStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/employer/jobs/${job.id}/edit`)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Evaluations submitted by this customer */}
          <TabsContent value="evaluations" className="space-y-4 mt-4">
            {evaluations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No evaluations submitted</p>
            ) : (
              <div className="space-y-3">
                {evaluations.map((evaluation) => (
                  <Card key={evaluation.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold">{evaluation.rating}/5</span>
                            <span className="text-yellow-500">
                              {'★'.repeat(evaluation.rating)}{'☆'.repeat(5 - evaluation.rating)}
                            </span>
                          </div>
                          {evaluation.comment && (
                            <p className="text-gray-600">{evaluation.comment}</p>
                          )}
                          <p className="text-sm text-gray-400 mt-1">
                            {format(new Date(evaluation.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Strikes */}
          <TabsContent value="strikes" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Dialog open={strikeDialogOpen} onOpenChange={setStrikeDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">Add Strike</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Strike</DialogTitle>
                    <DialogDescription>
                      Record a strike for {customer.full_name}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select
                        value={strikeForm.severity}
                        onValueChange={(v) => setStrikeForm({ ...strikeForm, severity: v as typeof strikeForm.severity })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MINOR">Minor</SelectItem>
                          <SelectItem value="MAJOR">Major</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Input
                        value={strikeForm.description}
                        onChange={(e) => setStrikeForm({ ...strikeForm, description: e.target.value })}
                        placeholder="What happened?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Textarea
                        value={strikeForm.notes}
                        onChange={(e) => setStrikeForm({ ...strikeForm, notes: e.target.value })}
                        placeholder="Additional details..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setStrikeDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleAddStrike} disabled={submitting}>
                      {submitting ? 'Adding...' : 'Add Strike'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {strikes.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No strikes recorded</p>
            ) : (
              <div className="space-y-3">
                {strikes.map((strike) => (
                  <Card key={strike.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getSeverityColor(strike.severity)}>
                              {strike.severity}
                            </Badge>
                            <span className="text-sm text-gray-400">
                              {format(new Date(strike.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <p className="font-medium">{strike.description}</p>
                          {strike.notes && (
                            <p className="text-sm text-gray-600 mt-1">{strike.notes}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
