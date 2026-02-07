'use client'

/**
 * Employee Profile Page
 *
 * Displays detailed employee information including:
 * - Personal details (name, email, phone, address)
 * - Void cheque document link
 * - Editable notes field for employer
 * - Job history with session details
 * - Evaluations from customers
 * - Strikes system with severity levels (Minor/Major/Critical)
 *
 * Employer can:
 * - View all employee information
 * - Edit notes about the employee
 * - Add strikes with severity and description
 * - View job history and evaluations
 */

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Employee, Strike, Evaluation, JobSession } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
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
import { ArrowLeft, AlertTriangle, MapPin, Edit2 } from 'lucide-react'
import { cleanupStaleSessions } from '@/lib/jobs/cleanupStaleSessions'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useTranslation } from '@/lib/i18n/useTranslation'

// Extended JobSession type with joined job_template data
interface JobWithTemplate extends JobSession {
  job_template?: {
    title: string
    job_code: string
    address: string | null
  }
}

export default function EmployeeProfilePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const params = useParams()
  const employeeId = params.id as string
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [strikes, setStrikes] = useState<Strike[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [jobHistory, setJobHistory] = useState<JobWithTemplate[]>([])
  const [employerId, setEmployerId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'history' | 'evaluations' | 'strikes'>('history')

  // Performance metrics
  const [perfMetrics, setPerfMetrics] = useState<{
    totalCompleted: number
    avgRating: number | null
    onTimeRate: number | null
    jobsThisMonth: number
  }>({ totalCompleted: 0, avgRating: null, onTimeRate: null, jobsThisMonth: 0 })

  // Strike form state
  const [strikeDialogOpen, setStrikeDialogOpen] = useState(false)
  const [strikeForm, setStrikeForm] = useState({
    description: '',
    notes: '',
    severity: 'MINOR' as 'MINOR' | 'MAJOR' | 'CRITICAL',
  })
  const [submitting, setSubmitting] = useState(false)

  // Notes edit state
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [employerNotesValue, setEmployerNotesValue] = useState('')

  // Credentials state
  const [credentials, setCredentials] = useState<{ username: string } | null>(null)
  const [credentialsLoading, setCredentialsLoading] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [newAccountForm, setNewAccountForm] = useState({ username: '', password: '' })
  const [accountCreating, setAccountCreating] = useState(false)

  // Load all data when component mounts or employeeId changes
  useEffect(() => {
    loadData()
  }, [employeeId])

  /**
   * Loads employee data, strikes, evaluations, and job history
   * Uses Supabase joins to get related job template data
   */
  const loadData = async () => {
    setLoading(true)
    try {
      // Cleanup stale sessions before fetching
      await cleanupStaleSessions(supabase)

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

      // Load employee
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single()

      if (employeeError || !employeeData) {
        console.error('Employee not found:', employeeError)
        router.push('/employer/users')
        return
      }
      setEmployee(employeeData)
      setNotesValue(employeeData.notes || '')

      // Parse notes to separate registration info from employer notes
      if (employeeData.notes) {
        const employerNotesMarker = '\n--- EMPLOYER NOTES ---\n'
        if (employeeData.notes.includes(employerNotesMarker)) {
          const parts = employeeData.notes.split(employerNotesMarker)
          setEmployerNotesValue(parts[1] || '')
        }
      }

      // Load credentials if employee has user_id
      if (employeeData.user_id) {
        loadCredentials(employeeData.user_id)
      }

      // Load strikes for this employee (target_type = EMPLOYEE, target_id = employeeId)
      const { data: strikesData } = await supabase
        .from('strikes')
        .select('*')
        .eq('target_type', 'EMPLOYEE')
        .eq('target_id', employeeId)
        .order('created_at', { ascending: false })

      setStrikes(strikesData || [])

      // Load evaluations for this employee
      const { data: evalData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })

      setEvaluations(evalData || [])

      // Load job history (completed sessions)
      const { data: jobsData } = await supabase
        .from('job_sessions')
        .select(`
          *,
          job_template:job_templates(title, job_code, address)
        `)
        .eq('assigned_to', employeeId)
        .order('scheduled_date', { ascending: false })
        .limit(50)

      setJobHistory(jobsData || [])

      // Calculate performance metrics
      const allSessions = jobsData || []
      const completedStatuses = ['COMPLETED', 'EVALUATED']
      const totalCompleted = allSessions.filter(s => completedStatuses.includes(s.status)).length

      // On-time rate: sessions that are not MISSED or OVERDUE out of total non-cancelled
      const relevantSessions = allSessions.filter(s => s.status !== 'CANCELLED' && s.status !== 'REFUSED' && s.status !== 'OFFERED')
      const missedOrOverdue = allSessions.filter(s => s.status === 'MISSED' || s.status === 'OVERDUE').length
      const onTimeRate = relevantSessions.length > 0
        ? ((relevantSessions.length - missedOrOverdue) / relevantSessions.length) * 100
        : null

      // Jobs this month
      const now = new Date()
      const firstOfMonth = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
      const jobsThisMonth = allSessions.filter(s =>
        completedStatuses.includes(s.status) && s.scheduled_date && s.scheduled_date >= firstOfMonth
      ).length

      // Average rating from evaluations
      const avgRating = (evalData && evalData.length > 0)
        ? evalData.reduce((sum, e) => sum + e.rating, 0) / evalData.length
        : null

      setPerfMetrics({ totalCompleted, avgRating, onTimeRate, jobsThisMonth })
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Loads credentials for an employee with a linked auth account
   */
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

  /**
   * Updates password for an employee's auth account
   */
  const handleUpdatePassword = async () => {
    if (!employee?.user_id || !newPassword) return
    if (newPassword.length < 6) {
      toast.error(t('Password must be at least 6 characters'))
      return
    }

    setPasswordSaving(true)
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: employee.user_id, new_password: newPassword })
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

  /**
   * Creates a new auth account for an employee without one
   */
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
          full_name: employee?.full_name,
          role: 'employee'
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create account')

      // Link the auth user to the employee
      const { error: updateError } = await supabase
        .from('employees')
        .update({ user_id: result.user_id })
        .eq('id', employeeId)

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

  /**
   * Adds a new strike to the employee's record
   * Strike severities: MINOR, MAJOR, CRITICAL
   * Requires description, notes are optional
   */
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
          target_type: 'EMPLOYEE',
          target_id: employeeId,
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
      toast.error(t('Failed to add strike'))
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Saves employer notes about the employee
   * Preserves registration info and appends employer notes
   */
  const handleSaveNotes = async () => {
    try {
      // Get the registration info part (everything before employer notes marker)
      let registrationInfo = notesValue
      const employerNotesMarker = '\n--- EMPLOYER NOTES ---\n'

      if (notesValue.includes(employerNotesMarker)) {
        registrationInfo = notesValue.split(employerNotesMarker)[0]
      }

      // Combine registration info with new employer notes
      const combinedNotes = employerNotesValue.trim()
        ? `${registrationInfo}${employerNotesMarker}${employerNotesValue}`
        : registrationInfo

      const { error } = await supabase
        .from('employees')
        .update({ notes: combinedNotes || null })
        .eq('id', employeeId)

      if (error) throw error
      setEditingNotes(false)
      await loadData()
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error(t('Failed to save notes'))
    }
  }

  // Helper: Maps employee status to dark theme badge
  const getStatusBadge = (status: Employee['status']) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-300 border border-green-500/30'
      case 'PENDING': return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
      case 'INACTIVE': return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
      case 'BLOCKED': return 'bg-red-500/20 text-red-300 border border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  // Helper: Maps strike severity to dark theme badge
  const getSeverityBadge = (severity: Strike['severity']) => {
    switch (severity) {
      case 'MINOR': return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
      case 'MAJOR': return 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
      case 'CRITICAL': return 'bg-red-500/20 text-red-300 border border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  // Helper: Maps job session status to dark theme badge
  const getSessionStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500/20 text-green-300 border border-green-500/30'
      case 'EVALUATED': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
      case 'IN_PROGRESS': return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
      case 'APPROVED': return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
      case 'CANCELLED': return 'bg-red-500/20 text-red-300 border border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 flex items-center justify-center">
        <p className="text-gray-400">{t('Employee not found')}</p>
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
          <h1 className="text-2xl font-bold text-white">{t('Employee Profile')}</h1>
        </div>

        {/* Employee Info Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-white">{employee.full_name}</h2>
                  <Badge className={getStatusBadge(employee.status)}>
                    {employee.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400">{employee.email}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{t('Phone')}</p>
                  <p className="text-sm text-gray-200">{employee.phone || t('Not provided')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{t('Created')}</p>
                  <p className="text-sm text-gray-200">{format(new Date(employee.created_at), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{t('Address')}</p>
                  <p className="text-sm text-gray-200">{employee.address || t('Not provided')}</p>
                </div>
                {employee.activated_at && (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{t('Activated')}</p>
                    <p className="text-sm text-gray-200">{format(new Date(employee.activated_at), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>

              {/* Void Cheque */}
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{t('Void Cheque')}</p>
                {employee.void_cheque_url ? (
                  <a
                    href={employee.void_cheque_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm"
                  >
                    {t('View Document')}
                  </a>
                ) : (
                  <p className="text-sm text-gray-400">{t('Not uploaded')}</p>
                )}
              </div>

              {/* Registration Information */}
              {employee.notes && !employee.notes.startsWith('--- EMPLOYER NOTES ---') && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-semibold">{t('Registration Information')}</p>
                  <div className="space-y-2 p-4 bg-white/5 rounded-lg border border-white/10">
                    {(() => {
                      const employerNotesMarker = '\n--- EMPLOYER NOTES ---\n'
                      const registrationPart = employee.notes.includes(employerNotesMarker)
                        ? employee.notes.split(employerNotesMarker)[0]
                        : employee.notes

                      return registrationPart.split('\n').map((line, idx) => {
                        const parts = line.split(': ')
                        if (parts.length === 2) {
                          return (
                            <div key={idx} className="grid grid-cols-[160px_1fr] gap-3">
                              <span className="text-sm font-semibold text-gray-400">{parts[0]}:</span>
                              <span className="text-sm text-gray-200">{parts[1]}</span>
                            </div>
                          )
                        }
                        return null
                      })
                    })()}
                  </div>
                </div>
              )}

              {/* Employer Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 font-semibold">{t('Employer Notes')}</p>
                  {!editingNotes && (
                    <button
                      onClick={() => setEditingNotes(true)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-gray-300 hover:bg-white/10 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      {employerNotesValue ? t('Edit') : t('Add Notes')}
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={employerNotesValue}
                      onChange={(e) => setEmployerNotesValue(e.target.value)}
                      placeholder={t('Add private notes about this employee (only visible to employer)...')}
                      rows={4}
                      className="bg-white/5 border-white/20 text-white placeholder:text-gray-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNotes}
                        className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        {t('Save')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingNotes(false)
                          // Reset to saved value
                          if (employee.notes) {
                            const employerNotesMarker = '\n--- EMPLOYER NOTES ---\n'
                            if (employee.notes.includes(employerNotesMarker)) {
                              setEmployerNotesValue(employee.notes.split(employerNotesMarker)[1] || '')
                            } else {
                              setEmployerNotesValue('')
                            }
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20 transition-colors"
                      >
                        {t('Cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 p-3 bg-white/5 rounded-lg border border-white/10 min-h-[60px]">
                    {employerNotesValue || <span className="italic text-gray-500">{t('No employer notes added yet')}</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('Performance')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{perfMetrics.totalCompleted}</p>
                <p className="text-xs text-gray-400 mt-1">{t('Jobs Completed')}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">
                  {perfMetrics.avgRating !== null ? perfMetrics.avgRating.toFixed(1) : '-'}
                </p>
                <p className="text-xs text-gray-400 mt-1">{t('Avg Rating')}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">
                  {perfMetrics.onTimeRate !== null ? `${Math.round(perfMetrics.onTimeRate)}%` : '-'}
                </p>
                <p className="text-xs text-gray-400 mt-1">{t('On-time Rate')}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{perfMetrics.jobsThisMonth}</p>
                <p className="text-xs text-gray-400 mt-1">{t('This Month')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login Credentials Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-5">
            <h3 className="text-lg font-semibold text-white mb-4">{t('Login Credentials')}</h3>

            {credentialsLoading ? (
              <LoadingSpinner size="sm" />
            ) : employee.user_id && credentials ? (
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
                <p className="text-sm text-gray-400">{t('No login account linked to this employee.')}</p>

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

        {/* Tabs: Job History | Evaluations | Strikes */}
        <div>
          {/* Tab Headers */}
          <div className="flex border-b border-white/10">
            {([
              { key: 'history' as const, label: t('Job History'), count: jobHistory.length },
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

          {/* Job History Tab */}
          {activeTab === 'history' && (
            <div className="mt-4 space-y-3">
              {jobHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('No job history')}</p>
              ) : (
                jobHistory.map((job) => (
                  <div key={job.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {job.full_job_code}
                          </span>
                          <Badge className={getSessionStatusBadge(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <p className="font-medium text-white">{job.job_template?.title || t('Unknown Job')}</p>
                        {job.job_template?.address && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.job_template.address}
                          </p>
                        )}
                        {job.scheduled_date && (
                          <p className="text-xs text-gray-500">
                            {format(new Date(job.scheduled_date), 'MMM d, yyyy')}
                            {job.scheduled_time && ` at ${job.scheduled_time}`}
                          </p>
                        )}
                      </div>
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
                <p className="text-gray-500 text-center py-8">{t('No evaluations yet')}</p>
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
                        {t('Record a strike for')} {employee.full_name}
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
