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

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Customer, Strike, Evaluation, JobTemplate } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { ArrowLeft, Building2, Edit2, Star, AlertTriangle, Briefcase, MapPin, RefreshCw } from 'lucide-react'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function CustomerProfilePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const params = useParams()
  const customerId = params.id as string
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  // Main state
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [strikes, setStrikes] = useState<Strike[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [jobs, setJobs] = useState<JobTemplate[]>([])
  const [employerId, setEmployerId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'jobs' | 'evaluations' | 'strikes'>('jobs')

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

  // Credentials state
  const [credentials, setCredentials] = useState<{ username: string } | null>(null)
  const [credentialsLoading, setCredentialsLoading] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [newAccountForm, setNewAccountForm] = useState({ username: '', password: '' })
  const [accountCreating, setAccountCreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [customerId])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) { router.push('/login'); return }
      setEmployerId(employer.id)

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError || !customerData) {
        router.push('/employer/users')
        return
      }
      setCustomer(customerData)

      setEditForm({
        full_name: customerData.full_name || '',
        email: customerData.email || '',
        phone: customerData.phone || '',
        address: customerData.address || '',
        notes: customerData.notes || '',
      })

      if (customerData.user_id) {
        loadCredentials(customerData.user_id)
      }

      const { data: strikesData } = await supabase
        .from('strikes')
        .select('*')
        .eq('target_type', 'CUSTOMER')
        .eq('target_id', customerId)
        .order('created_at', { ascending: false })
      setStrikes(strikesData || [])

      const { data: evalData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
      setEvaluations(evalData || [])

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

  const loadCredentials = async (userId: string) => {
    setCredentialsLoading(true)
    try {
      const response = await fetch('/api/auth/get-user-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
      const result = await response.json()
      if (response.ok && result.success) {
        setCredentials({ username: result.username })
      }
    } catch (error) {
      console.error('Error loading credentials:', error)
    } finally {
      setCredentialsLoading(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!customer?.user_id || !newPassword) return
    if (newPassword.length < 6) {
      toast.error(t('Password must be at least 6 characters'))
      return
    }
    setPasswordSaving(true)
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: customer.user_id, new_password: newPassword })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to update password')
      toast.success(t('Password updated successfully'))
      setShowPasswordForm(false)
      setNewPassword('')
    } catch (error) {
      console.error('Error updating password:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update password')
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleCreateAccount = async () => {
    if (!newAccountForm.username || !newAccountForm.password) {
      toast.error(t('Username and password are required'))
      return
    }
    if (newAccountForm.password.length < 6) {
      toast.error(t('Password must be at least 6 characters'))
      return
    }
    setAccountCreating(true)
    try {
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAccountForm.username,
          password: newAccountForm.password,
          full_name: customer?.full_name,
          role: 'customer'
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create account')

      const { error: updateError } = await supabase
        .from('customers')
        .update({ user_id: result.user_id })
        .eq('id', customerId)
      if (updateError) throw updateError

      toast.success(t('Account created successfully'))
      setShowCreateAccount(false)
      setNewAccountForm({ username: '', password: '' })
      await loadData()
    } catch (error) {
      console.error('Error creating account:', error)
      toast.error(error instanceof Error ? error.message : t('Failed to create account'))
    } finally {
      setAccountCreating(false)
    }
  }

  const handleSave = async () => {
    if (!editForm.full_name) {
      toast.error(t('Name is required'))
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          full_name: editForm.full_name,
          email: editForm.email || null,
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
      toast.error(t('Failed to save customer'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddStrike = async () => {
    if (!strikeForm.description) {
      toast.error(t('Please enter a description'))
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('strikes')
        .insert({
          target_type: 'CUSTOMER',
          target_id: customerId,
          date: new Date().toISOString().split('T')[0],
          description: strikeForm.description,
          notes: strikeForm.notes || null,
          severity: strikeForm.severity,
          created_by: employerId,
        })
      if (error) throw error
      setStrikeDialogOpen(false)
      setStrikeForm({ description: '', notes: '', severity: 'MINOR' })
      await loadData()
    } catch (error) {
      console.error('Error adding strike:', error)
      toast.error(t('Failed to add strike'))
    } finally {
      setSubmitting(false)
    }
  }

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
      toast.error(t('Failed to reactivate customer'))
    }
  }

  const getStatusBadge = (status: Customer['status']) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-300 border border-green-500/30'
      case 'INACTIVE': return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
      case 'BLOCKED': return 'bg-red-500/20 text-red-300 border border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  const getSeverityBadge = (severity: Strike['severity']) => {
    switch (severity) {
      case 'MINOR': return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
      case 'MAJOR': return 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
      case 'CRITICAL': return 'bg-red-500/20 text-red-300 border border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-300 border border-green-500/30'
      case 'DRAFT': return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 flex items-center justify-center">
        <p className="text-gray-400">{t('Customer not found')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 pb-20">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('Back')}
          </button>
          <h1 className="text-2xl font-bold text-white">{t('Customer Profile')}</h1>
        </div>

        {/* Customer Info Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                  <Building2 className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold bg-white/10 text-white px-2.5 py-1 rounded-full border border-white/20">
                      {customer.customer_code}
                    </span>
                    <Badge className={getStatusBadge(customer.status)}>
                      {customer.status}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-bold text-white">{customer.full_name}</h2>
                  {customer.email && <p className="text-sm text-gray-400">{customer.email}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {customer.status === 'INACTIVE' && (
                  <button
                    onClick={handleReactivate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t('Reactivate')}
                  </button>
                )}
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    {t('Edit')}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">{t('Full Name')} *</Label>
                      <Input
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        placeholder={t('Full name')}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">{t('Email')}</Label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder={t('Email')}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">{t('Phone')}</Label>
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder={t('Phone number')}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">{t('Address')}</Label>
                      <Input
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        placeholder={t('Address')}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-400">{t('Notes')}</Label>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder={t('Notes about this customer...')}
                      rows={3}
                      className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? t('Saving...') : t('Save Changes')}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        setEditForm({
                          full_name: customer.full_name || '',
                          email: customer.email || '',
                          phone: customer.phone || '',
                          address: customer.address || '',
                          notes: customer.notes || '',
                        })
                      }}
                      className="px-4 py-2 rounded-lg text-sm bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 transition-colors"
                    >
                      {t('Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">{t('Phone')}</p>
                      <p className="text-sm text-gray-200">{customer.phone || t('Not provided')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">{t('Address')}</p>
                      <p className="text-sm text-gray-200">{customer.address || t('Not provided')}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-0.5">{t('Notes')}</p>
                    <p className="text-sm text-gray-300">{customer.notes || t('No notes')}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Login Credentials Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('Login Credentials')}</h3>

            {credentialsLoading ? (
              <LoadingSpinner size="sm" />
            ) : customer.user_id && credentials ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{t('Username')}</p>
                    <p className="text-sm font-mono text-gray-200">{credentials.username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{t('Password')}</p>
                    <p className="text-sm text-gray-400">••••••••</p>
                  </div>
                </div>

                {showPasswordForm ? (
                  <div className="space-y-3 p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">{t('New Password')}</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('Enter new password (min 6 chars)')}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdatePassword}
                        disabled={passwordSaving}
                        className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {passwordSaving ? t('Saving...') : t('Update Password')}
                      </button>
                      <button
                        onClick={() => { setShowPasswordForm(false); setNewPassword('') }}
                        className="px-3 py-1.5 rounded-lg text-sm bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 transition-colors"
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="px-3 py-1.5 rounded-lg text-sm bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 transition-colors"
                  >
                    {t('Change Password')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">{t('No login account linked to this customer.')}</p>

                {showCreateAccount ? (
                  <div className="space-y-3 p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">{t('Username')}</Label>
                      <Input
                        value={newAccountForm.username}
                        onChange={(e) => setNewAccountForm({ ...newAccountForm, username: e.target.value })}
                        placeholder={t('Enter username')}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">{t('Password')}</Label>
                      <Input
                        type="password"
                        value={newAccountForm.password}
                        onChange={(e) => setNewAccountForm({ ...newAccountForm, password: e.target.value })}
                        placeholder={t('Enter password (min 6 chars)')}
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateAccount}
                        disabled={accountCreating}
                        className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {accountCreating ? t('Creating...') : t('Create Account')}
                      </button>
                      <button
                        onClick={() => { setShowCreateAccount(false); setNewAccountForm({ username: '', password: '' }) }}
                        className="px-3 py-1.5 rounded-lg text-sm bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 transition-colors"
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateAccount(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    {t('Create Login Account')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs: Jobs | Evaluations | Strikes */}
        <div>
          {/* Tab Headers */}
          <div className="flex border-b border-white/10">
            {([
              { key: 'jobs' as const, label: t('Jobs'), count: jobs.length },
              { key: 'evaluations' as const, label: t('Evaluations'), count: evaluations.length },
              { key: 'strikes' as const, label: t('Strikes'), count: strikes.length },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Jobs Tab */}
          {activeTab === 'jobs' && (
            <div className="mt-4 space-y-3">
              {jobs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('No jobs linked to this customer')}</p>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {job.job_code}
                          </span>
                          <Badge className={getJobStatusBadge(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <p className="font-medium text-white">{job.title}</p>
                        {job.address && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.address}
                          </p>
                        )}
                        {job.is_recurring && (
                          <p className="text-xs text-gray-500">
                            {t('Recurring')}: {job.frequency_per_week}x/{t('week')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => router.push(`/employer/jobs/${job.id}/edit`)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 transition-colors"
                      >
                        {t('View')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Evaluations Tab */}
          {activeTab === 'evaluations' && (
            <div className="mt-4 space-y-3">
              {evaluations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('No evaluations submitted')}</p>
              ) : (
                evaluations.map((evaluation) => (
                  <div key={evaluation.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-bold text-white">{evaluation.rating}/5</span>
                      <span className="text-yellow-400">
                        {'★'.repeat(evaluation.rating)}{'☆'.repeat(5 - evaluation.rating)}
                      </span>
                    </div>
                    {evaluation.comment && (
                      <p className="text-sm text-gray-300">{evaluation.comment}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {format(new Date(evaluation.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Strikes Tab */}
          {activeTab === 'strikes' && (
            <div className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Dialog open={strikeDialogOpen} onOpenChange={setStrikeDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t('Add Strike')}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
                    <DialogHeader>
                      <DialogTitle className="text-white">{t('Add Strike')}</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        {t('Record a strike for')} {customer.full_name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-400">{t('Severity')}</Label>
                        <Select
                          value={strikeForm.severity}
                          onValueChange={(v) => setStrikeForm({ ...strikeForm, severity: v as typeof strikeForm.severity })}
                        >
                          <SelectTrigger className="bg-white/5 border-white/20 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-white/20">
                            <SelectItem value="MINOR" className="text-yellow-300 hover:bg-white/10">{t('Minor')}</SelectItem>
                            <SelectItem value="MAJOR" className="text-orange-300 hover:bg-white/10">{t('Major')}</SelectItem>
                            <SelectItem value="CRITICAL" className="text-red-300 hover:bg-white/10">{t('Critical')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-400">{t('Description')} *</Label>
                        <Input
                          value={strikeForm.description}
                          onChange={(e) => setStrikeForm({ ...strikeForm, description: e.target.value })}
                          placeholder={t('What happened?')}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-gray-400">{t('Notes (optional)')}</Label>
                        <Textarea
                          value={strikeForm.notes}
                          onChange={(e) => setStrikeForm({ ...strikeForm, notes: e.target.value })}
                          placeholder={t('Additional details...')}
                          rows={3}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setStrikeDialogOpen(false)}
                        className="px-4 py-2 rounded-lg text-sm bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 transition-colors"
                      >
                        {t('Cancel')}
                      </button>
                      <button
                        onClick={handleAddStrike}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {submitting ? t('Adding...') : t('Add Strike')}
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {strikes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('No strikes recorded')}</p>
              ) : (
                strikes.map((strike) => (
                  <div key={strike.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getSeverityBadge(strike.severity)}>
                        {strike.severity}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {format(new Date(strike.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white">{strike.description}</p>
                    {strike.notes && (
                      <p className="text-xs text-gray-400 mt-1">{strike.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
