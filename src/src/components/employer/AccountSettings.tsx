'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface AccountSettingsProps {
  currentEmail: string
  onChangeEmail: (newEmail: string) => Promise<void>
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onLogout: () => Promise<void>
  onDeleteAccount: () => Promise<void>
}

export function AccountSettings({ currentEmail, onChangeEmail, onChangePassword, onLogout, onDeleteAccount }: AccountSettingsProps) {
  const { t } = useTranslation()
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  })
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const handleEmailChange = async () => {
    setEmailError('')
    setEmailSuccess('')

    if (!newEmail) {
      setEmailError(t('Email is required'))
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setEmailError(t('Please enter a valid email address'))
      return
    }

    if (newEmail === currentEmail) {
      setEmailError(t('New email must be different from current email'))
      return
    }

    setChangingEmail(true)
    try {
      await onChangeEmail(newEmail)
      setEmailSuccess(t('Verification email sent! Check your inbox to confirm the change.'))
      setNewEmail('')
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : t('Failed to change email'))
    } finally {
      setChangingEmail(false)
    }
  }

  const handlePasswordChange = async () => {
    setPasswordError('')

    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      setPasswordError(t('All fields are required'))
      return
    }

    if (passwordData.new !== passwordData.confirm) {
      setPasswordError(t('New passwords do not match'))
      return
    }

    if (passwordData.new.length < 6) {
      setPasswordError(t('Password must be at least 6 characters'))
      return
    }

    setChangingPassword(true)
    try {
      await onChangePassword(passwordData.current, passwordData.new)
      setPasswordData({ current: '', new: '', confirm: '' })
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t('Failed to change password'))
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Change Email */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-gray-400">{t('Change Email')}</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-gray-300">{t('Current Email')}</Label>
            <p className="text-sm text-gray-400 bg-white/5 p-2 rounded-lg border border-white/10">{currentEmail}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_email" className="text-gray-300">{t('New Email')}</Label>
            <Input
              id="new_email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t('Enter new email address')}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>
          {emailError && (
            <p className="text-sm text-red-400">{emailError}</p>
          )}
          {emailSuccess && (
            <p className="text-sm text-green-400">{emailSuccess}</p>
          )}
          <Button
            onClick={handleEmailChange}
            disabled={changingEmail}
            variant="outline"
            className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
          >
            {changingEmail ? t('Sending Verification...') : t('Change Email')}
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <h3 className="font-medium text-sm text-gray-400">{t('Change Password')}</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="current_password" className="text-gray-300">{t('Current Password')}</Label>
            <Input
              id="current_password"
              type="password"
              value={passwordData.current}
              onChange={(e) =>
                setPasswordData((prev) => ({ ...prev, current: e.target.value }))
              }
              placeholder={t('Enter current password')}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new_password" className="text-gray-300">{t('New Password')}</Label>
            <Input
              id="new_password"
              type="password"
              value={passwordData.new}
              onChange={(e) =>
                setPasswordData((prev) => ({ ...prev, new: e.target.value }))
              }
              placeholder={t('Enter new password')}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password" className="text-gray-300">{t('Confirm New Password')}</Label>
            <Input
              id="confirm_password"
              type="password"
              value={passwordData.confirm}
              onChange={(e) =>
                setPasswordData((prev) => ({ ...prev, confirm: e.target.value }))
              }
              placeholder={t('Confirm new password')}
              className="bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
          </div>
          {passwordError && (
            <p className="text-sm text-red-400">{passwordError}</p>
          )}
          <Button
            onClick={handlePasswordChange}
            disabled={changingPassword}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {changingPassword ? t('Changing Password...') : t('Change Password')}
          </Button>
        </div>
      </div>

      {/* Logout */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <h3 className="font-medium text-sm text-gray-400">{t('Session')}</h3>
        <Button
          onClick={onLogout}
          variant="outline"
          className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
        >
          {t('Logout')}
        </Button>
      </div>

      {/* Delete Account */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <h3 className="font-medium text-sm text-red-400">{t('Danger Zone')}</h3>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30">
              {t('Delete Account')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-white/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">{t('Are you absolutely sure?')}</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                {t('This action cannot be undone. This will permanently delete your account and remove all your data from our servers, including all job templates, employees, customers, and messages.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/10 border-white/30 text-white hover:bg-white/20">{t('Cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDeleteAccount}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {t('Yes, Delete My Account')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
