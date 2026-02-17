'use client'

import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DocumentUpload } from '@/components/employee/DocumentUpload'
import { SpecificAvailabilityEditor } from '@/components/employee/SpecificAvailabilityEditor'
import { Bell, BellOff, CheckCircle, LogOut, GraduationCap, Star, ChevronDown } from 'lucide-react'
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
} from '@/lib/firebase/notifications'

export default function EmployeeProfilePage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('personal')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Personal Info State
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  // Training State
  const [trainingRecords, setTrainingRecords] = useState<{
    job_template_id: string
    is_trained: boolean
    can_coach: boolean
    notes: string | null
    trained_at: string | null
    job_template: { title: string; job_code: string } | null
  }[]>([])
  const [trainingLoading, setTrainingLoading] = useState(false)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)

  // Settings State
  const [pushEnabled, setPushEnabled] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [permissionStatus, setPermissionStatus] = useState<string>('default')
  const [requestingPermission, setRequestingPermission] = useState(false)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    loadEmployeeProfile()
    // Check notification permission on mount
    const status = getNotificationPermissionStatus()
    setPermissionStatus(status)
    return () => { isMountedRef.current = false }
  }, [])

  // Lazy-load training data when tab is selected
  useEffect(() => {
    if (activeTab === 'training' && trainingRecords.length === 0 && !trainingLoading) {
      loadTrainingData()
    }
  }, [activeTab])

  const loadEmployeeProfile = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      setEmployee(data)
      setFullName(data.full_name)
      setEmail(data.email)
      setPhone(data.phone || '')
      setAddress(data.address || '')
      setNotes(data.notes || '')
    } catch (error) {
      console.error('Error loading employee profile:', error)
      toast.error(t('Failed to load your profile'))
    } finally {
      setLoading(false)
    }
  }

  const loadTrainingData = async () => {
    setTrainingLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!emp) return

      const { data, error } = await supabase
        .from('employee_job_training')
        .select('job_template_id, is_trained, can_coach, notes, trained_at, job_template:job_templates(title, job_code)')
        .eq('employee_id', emp.id)

      if (error) throw error
      setTrainingRecords((data as unknown as typeof trainingRecords) || [])
    } catch (error) {
      console.error('Error loading training data:', error)
    } finally {
      setTrainingLoading(false)
    }
  }

  const handleSavePersonalInfo = async () => {
    if (!employee) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', employee.id)

      if (error) throw error

      toast.success(t('Personal information updated successfully!'))
      await loadEmployeeProfile()
    } catch (error) {
      console.error('Error saving personal info:', error)
      toast.error(t('Failed to save personal information'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!employee) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          notes: notes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', employee.id)

      if (error) throw error

      toast.success(t('Notes saved successfully!'))
      await loadEmployeeProfile()
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error(t('Failed to save notes'))
    } finally {
      setSaving(false)
    }
  }

  // Handle push notification toggle
  const handlePushToggle = async (checked: boolean) => {
    if (checked && permissionStatus !== 'granted') {
      setRequestingPermission(true)
      const token = await requestNotificationPermission()
      setRequestingPermission(false)

      if (token) {
        setPermissionStatus('granted')
        setPushEnabled(true)
      } else {
        setPermissionStatus(getNotificationPermissionStatus())
      }
    } else {
      setPushEnabled(checked)
    }
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error(t('Please enter both password fields'))
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('Passwords do not match'))
      return
    }

    if (newPassword.length < 6) {
      toast.error(t('Password must be at least 6 characters'))
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      toast.success(t('Password changed successfully!'))
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error(t('Failed to change password'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-md mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/3"></div>
            <div className="h-12 bg-white/10 rounded"></div>
            <div className="h-40 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <p className="text-gray-300">{t('Employee profile not found')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 pb-20">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">{t('Profile & Settings')}</h1>

        {/* Tab Selector */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'personal', label: 'Personal' },
            { id: 'documents', label: 'Documents' },
            { id: 'availability', label: 'Availability' },
            { id: 'training', label: 'Training' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg border-b-2 border-blue-400'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
              }`}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>

          {/* Personal Info Tab */}
          {activeTab === 'personal' && (
          <div className="space-y-4">
            {/* Personal Information */}
            <div className="bg-white/5 border border-white/10 rounded-xl">
              <div className="p-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">{t('Personal Information')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name" className="text-gray-300">{t('Full Name')}</Label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={saving}
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">{t('Email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={saving}
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-300">{t('Phone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    disabled={saving}
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-gray-300">{t('Address')}</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, City, State ZIP"
                    rows={3}
                    disabled={saving}
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-white/10">
                <Button
                  onClick={handleSavePersonalInfo}
                  disabled={saving || !fullName.trim() || !email.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {saving ? t('Saving...') : t('Save Personal Info')}
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white/5 border border-white/10 rounded-xl">
              <div className="p-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">{t('Notes for Employer')}</h3>
                <p className="text-sm text-gray-400">
                  {t('Add any notes your employer should know')}
                </p>
              </div>
              <div className="p-4">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Allergies, special equipment needs, preferences..."
                  rows={4}
                  disabled={saving}
                  className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="p-4 border-t border-white/10">
                <Button
                  onClick={handleSaveNotes}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {saving ? t('Saving...') : t('Save Notes')}
                </Button>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-white/5 border border-white/10 rounded-xl">
              <div className="p-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">{t('Settings')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {permissionStatus === 'granted' ? (
                        <Bell className="w-4 h-4 text-green-400" />
                      ) : (
                        <BellOff className="w-4 h-4 text-gray-400" />
                      )}
                      <div>
                        <Label htmlFor="push-notifications" className="text-white">{t('Push Notifications')}</Label>
                        <p className="text-sm text-gray-300">
                          {t('Receive alerts about jobs and messages')}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={pushEnabled}
                      onCheckedChange={handlePushToggle}
                      disabled={requestingPermission || permissionStatus === 'denied'}
                    />
                  </div>
                  {permissionStatus === 'granted' && (
                    <p className="text-xs text-green-400 flex items-center gap-1 ml-6">
                      <CheckCircle className="w-3 h-3" />
                      {t('Notifications enabled')}
                    </p>
                  )}
                  {permissionStatus === 'denied' && (
                    <p className="text-xs text-red-400 ml-6">
                      {t('Notifications blocked. Enable in browser settings.')}
                    </p>
                  )}
                  {requestingPermission && (
                    <p className="text-xs text-blue-400 ml-6">
                      {t('Requesting permission...')}
                    </p>
                  )}
                </div>

                {/* Logout */}
                <div className="pt-4 border-t border-white/20">
                  <Button
                    onClick={handleLogout}
                    className="w-full bg-white/10 text-white border border-white/20 hover:bg-white/20"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('Logout')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-white/5 border border-white/10 rounded-xl">
              <div className="p-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">{t('Change Password')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-gray-300">{t('New Password')}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('Enter new password')}
                    disabled={saving}
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-gray-300">{t('Confirm Password')}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('Confirm new password')}
                    disabled={saving}
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-white/10">
                <Button
                  onClick={handleChangePassword}
                  disabled={saving || !newPassword || !confirmPassword}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {saving ? t('Changing...') : t('Change Password')}
                </Button>
              </div>
            </div>
          </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <DocumentUpload
              employeeId={employee.id}
              currentDocumentUrl={employee.void_cheque_url}
              onUploadSuccess={(url) => {
                setEmployee(prev => prev ? { ...prev, void_cheque_url: url || null } : null)
              }}
            />
          )}

          {/* Availability Tab */}
          {activeTab === 'availability' && (
            <SpecificAvailabilityEditor employeeId={employee.id} />
          )}

          {/* Training Tab */}
          {activeTab === 'training' && (
            <TrainingTab
              trainingRecords={trainingRecords}
              trainingLoading={trainingLoading}
              expandedNoteId={expandedNoteId}
              setExpandedNoteId={setExpandedNoteId}
              t={t}
            />
          )}
      </div>
    </div>
  )
}

function TrainingTab({
  trainingRecords,
  trainingLoading,
  expandedNoteId,
  setExpandedNoteId,
  t,
}: {
  trainingRecords: {
    job_template_id: string
    is_trained: boolean
    can_coach: boolean
    notes: string | null
    trained_at: string | null
    job_template: { title: string; job_code: string } | null
  }[]
  trainingLoading: boolean
  expandedNoteId: string | null
  setExpandedNoteId: (id: string | null) => void
  t: (key: string) => string
}) {
  if (trainingLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white/5 rounded-xl border border-white/10 p-3 h-20" />
        ))}
      </div>
    )
  }

  if (trainingRecords.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 text-center">
        <GraduationCap className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">
          {t('No training records yet. Your employer will update your training status.')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {trainingRecords.map((record) => (
        <div key={record.job_template_id} className="bg-white/5 rounded-xl border border-white/10 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {record.job_template?.job_code || '---'}
                </span>
              </div>
              <p className="text-white font-medium text-sm truncate">
                {record.job_template?.title || t('Unknown Job')}
              </p>
              {record.trained_at && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('Trained')}: {new Date(record.trained_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1 items-end flex-shrink-0">
              {record.is_trained ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
                  <CheckCircle className="w-3 h-3" />
                  {t('Trained')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">
                  {t('Not Trained')}
                </span>
              )}
              {record.is_trained && record.can_coach && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Star className="w-3 h-3" />
                  {t('Can Coach')}
                </span>
              )}
            </div>
          </div>

          {record.notes && (
            <div className="mt-2">
              <button
                onClick={() => setExpandedNoteId(expandedNoteId === record.job_template_id ? null : record.job_template_id)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${expandedNoteId === record.job_template_id ? 'rotate-180' : ''}`} />
                {t('Notes')}
              </button>
              {expandedNoteId === record.job_template_id && (
                <p className="mt-1 text-xs text-gray-400 bg-white/5 rounded-lg p-2 border border-white/5">
                  {record.notes}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
