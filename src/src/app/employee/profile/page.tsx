'use client'

import { useState, useEffect } from 'react'
import type { Employee } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DocumentUpload } from '@/components/employee/DocumentUpload'
import { AvailabilityEditor } from '@/components/employee/AvailabilityEditor'
import { Bell, BellOff, CheckCircle, LogOut } from 'lucide-react'
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
} from '@/lib/firebase/notifications'

export default function EmployeeProfilePage() {
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

  // Settings State
  const [pushEnabled, setPushEnabled] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [permissionStatus, setPermissionStatus] = useState<string>('default')
  const [requestingPermission, setRequestingPermission] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    loadEmployeeProfile()
    // Check notification permission on mount
    const status = getNotificationPermissionStatus()
    setPermissionStatus(status)
  }, [])

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
    } finally {
      setLoading(false)
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

      alert('Personal information updated successfully!')
      await loadEmployeeProfile()
    } catch (error) {
      console.error('Error saving personal info:', error)
      alert('Failed to save personal information')
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

      alert('Notes saved successfully!')
      await loadEmployeeProfile()
    } catch (error) {
      console.error('Error saving notes:', error)
      alert('Failed to save notes')
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
      alert('Please enter both password fields')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      alert('Password changed successfully!')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Error changing password:', error)
      alert('Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">Employee profile not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile & Settings</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="personal" className="text-xs sm:text-sm">
              Personal
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs sm:text-sm">
              Documents
            </TabsTrigger>
            <TabsTrigger value="availability" className="text-xs sm:text-sm">
              Availability
            </TabsTrigger>
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="personal" className="space-y-4">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, City, State ZIP"
                    rows={3}
                    disabled={saving}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleSavePersonalInfo}
                  disabled={saving || !fullName.trim() || !email.trim()}
                  className="w-full"
                >
                  {saving ? 'Saving...' : 'Save Personal Info'}
                </Button>
              </CardFooter>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes for Employer</CardTitle>
                <p className="text-sm text-gray-600">
                  Add any notes your employer should know
                </p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Allergies, special equipment needs, preferences..."
                  rows={4}
                  disabled={saving}
                />
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleSaveNotes}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? 'Saving...' : 'Save Notes'}
                </Button>
              </CardFooter>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {permissionStatus === 'granted' ? (
                        <Bell className="w-4 h-4 text-green-600" />
                      ) : (
                        <BellOff className="w-4 h-4 text-gray-400" />
                      )}
                      <div>
                        <Label htmlFor="push-notifications">Push Notifications</Label>
                        <p className="text-sm text-gray-600">
                          Receive alerts about jobs and messages
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
                    <p className="text-xs text-green-600 flex items-center gap-1 ml-6">
                      <CheckCircle className="w-3 h-3" />
                      Notifications enabled
                    </p>
                  )}
                  {permissionStatus === 'denied' && (
                    <p className="text-xs text-red-600 ml-6">
                      Notifications blocked. Enable in browser settings.
                    </p>
                  )}
                  {requestingPermission && (
                    <p className="text-xs text-blue-600 ml-6">
                      Requesting permission...
                    </p>
                  )}
                </div>

                {/* Logout */}
                <div className="pt-4 border-t">
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={saving}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleChangePassword}
                  disabled={saving || !newPassword || !confirmPassword}
                  className="w-full"
                >
                  {saving ? 'Changing...' : 'Change Password'}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <DocumentUpload
              employeeId={employee.id}
              currentDocumentUrl={employee.void_cheque_url}
              onUploadSuccess={(url) => {
                setEmployee(prev => prev ? { ...prev, void_cheque_url: url || null } : null)
              }}
            />
          </TabsContent>

          {/* Availability Tab */}
          <TabsContent value="availability">
            <AvailabilityEditor employeeId={employee.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
