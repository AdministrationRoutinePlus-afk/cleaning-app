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

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Employee, Strike, Evaluation, JobSession } from '@/types/database'
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
import LoadingSpinner from '@/components/LoadingSpinner'

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
  const params = useParams()
  const employeeId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [strikes, setStrikes] = useState<Strike[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [jobHistory, setJobHistory] = useState<JobWithTemplate[]>([])
  const [employerId, setEmployerId] = useState<string>('')

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
      alert('Password must be at least 6 characters')
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

      alert('Password updated successfully')
      setShowPasswordForm(false)
      setNewPassword('')
    } catch (error) {
      console.error('Error updating password:', error)
      alert(error instanceof Error ? error.message : 'Failed to update password')
    } finally {
      setPasswordSaving(false)
    }
  }

  /**
   * Creates a new auth account for an employee without one
   */
  const handleCreateAccount = async () => {
    if (!newAccountForm.username || !newAccountForm.password) {
      alert('Username and password are required')
      return
    }
    if (newAccountForm.password.length < 6) {
      alert('Password must be at least 6 characters')
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

      alert('Account created successfully')
      setShowCreateAccount(false)
      setNewAccountForm({ username: '', password: '' })
      await loadData()
    } catch (error) {
      console.error('Error creating account:', error)
      alert(error instanceof Error ? error.message : 'Failed to create account')
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
      alert('Please enter a description')
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
      alert('Failed to add strike')
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
      alert('Failed to save notes')
    }
  }

  // Helper: Maps employee status to badge color
  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500'
      case 'PENDING': return 'bg-yellow-500'
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

  // Helper: Maps job session status to badge color
  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500'
      case 'EVALUATED': return 'bg-blue-500'
      case 'IN_PROGRESS': return 'bg-yellow-500'
      case 'APPROVED': return 'bg-cyan-500'
      case 'CANCELLED': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-gray-500">Employee not found</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Employee Profile</h1>
        </div>

        {/* Employee Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{employee.full_name}</CardTitle>
                <p className="text-gray-600">{employee.email}</p>
              </div>
              <Badge className={getStatusColor(employee.status)}>
                {employee.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{employee.phone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">{format(new Date(employee.created_at), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{employee.address || 'Not provided'}</p>
              </div>
              {employee.activated_at && (
                <div>
                  <p className="text-sm text-gray-500">Activated</p>
                  <p className="font-medium">{format(new Date(employee.activated_at), 'MMM d, yyyy')}</p>
                </div>
              )}
            </div>

            {/* Void Cheque */}
            <div>
              <p className="text-sm text-gray-500">Void Cheque</p>
              {employee.void_cheque_url ? (
                <a
                  href={employee.void_cheque_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Document
                </a>
              ) : (
                <p className="text-gray-400">Not uploaded</p>
              )}
            </div>

            {/* Registration Information */}
            {employee.notes && !employee.notes.startsWith('--- EMPLOYER NOTES ---') && (
              <div>
                <p className="text-sm text-gray-500 mb-2 font-semibold">Registration Information</p>
                <div className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
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
                            <span className="text-sm font-semibold text-gray-700">{parts[0]}:</span>
                            <span className="text-sm text-gray-900">{parts[1]}</span>
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
                <p className="text-sm text-gray-500 font-semibold">Employer Notes</p>
                {!editingNotes && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                    {employerNotesValue ? 'Edit' : 'Add Notes'}
                  </Button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={employerNotesValue}
                    onChange={(e) => setEmployerNotesValue(e.target.value)}
                    placeholder="Add private notes about this employee (only visible to employer)..."
                    rows={4}
                    className="border-gray-300"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNotes}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => {
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
                    }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg border border-gray-200 min-h-[60px]">
                  {employerNotesValue || <span className="italic text-gray-400">No employer notes added yet</span>}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Login Credentials Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Login Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {credentialsLoading ? (
              <LoadingSpinner size="sm" />
            ) : employee.user_id && credentials ? (
              // Has account - show credentials
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="font-medium font-mono">{credentials.username}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Password</p>
                    <p className="font-medium text-gray-400">••••••••</p>
                  </div>
                </div>

                {showPasswordForm ? (
                  <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                    <Label>New Password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 chars)"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdatePassword} disabled={passwordSaving}>
                        {passwordSaving ? 'Saving...' : 'Update Password'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setShowPasswordForm(false)
                        setNewPassword('')
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                    Change Password
                  </Button>
                )}
              </div>
            ) : (
              // No account - show create option
              <div className="space-y-4">
                <p className="text-gray-500">No login account linked to this employee.</p>

                {showCreateAccount ? (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={newAccountForm.username}
                        onChange={(e) => setNewAccountForm({ ...newAccountForm, username: e.target.value })}
                        placeholder="Enter username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={newAccountForm.password}
                        onChange={(e) => setNewAccountForm({ ...newAccountForm, password: e.target.value })}
                        placeholder="Enter password (min 6 chars)"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreateAccount} disabled={accountCreating}>
                        {accountCreating ? 'Creating...' : 'Create Account'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setShowCreateAccount(false)
                        setNewAccountForm({ username: '', password: '' })
                      }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setShowCreateAccount(true)}>
                    Create Login Account
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for History, Evaluations, Strikes */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="history">Job History ({jobHistory.length})</TabsTrigger>
            <TabsTrigger value="evaluations">Evaluations ({evaluations.length})</TabsTrigger>
            <TabsTrigger value="strikes">Strikes ({strikes.length})</TabsTrigger>
          </TabsList>

          {/* Job History */}
          <TabsContent value="history" className="space-y-4 mt-4">
            {jobHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No job history</p>
            ) : (
              <div className="space-y-3">
                {jobHistory.map((job) => (
                  <Card key={job.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{job.job_template?.title || 'Unknown Job'}</p>
                          <p className="text-sm text-gray-500 font-mono">{job.full_job_code}</p>
                          {job.job_template?.address && (
                            <p className="text-sm text-gray-500">{job.job_template.address}</p>
                          )}
                          {job.scheduled_date && (
                            <p className="text-sm text-gray-500">
                              {format(new Date(job.scheduled_date), 'MMM d, yyyy')}
                              {job.scheduled_time && ` at ${job.scheduled_time}`}
                            </p>
                          )}
                        </div>
                        <Badge className={getSessionStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Evaluations */}
          <TabsContent value="evaluations" className="space-y-4 mt-4">
            {evaluations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No evaluations yet</p>
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
                      Record a strike for {employee.full_name}
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
