'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface AnnouncementFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function AnnouncementForm({ onSuccess, onCancel }: AnnouncementFormProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || sending) return

    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'ANNOUNCEMENT',
          created_by: user.id
        })
        .select()
        .single()

      if (convError) throw convError

      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('user_id')
        .eq('status', 'ACTIVE')
        .not('user_id', 'is', null)

      if (empError) throw empError

      if (employees && employees.length > 0) {
        const participants = employees
          .filter(emp => emp.user_id !== null)
          .map(emp => ({
            conversation_id: conversation.id,
            user_id: emp.user_id as string,
            joined_at: new Date().toISOString()
          }))

        const { error: participantError } = await supabase
          .from('conversation_participants')
          .insert(participants)

        if (participantError) throw participantError
      }

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: content.trim(),
          is_system: false,
          sent_at: new Date().toISOString()
        })

      if (messageError) throw messageError

      if (employees && employees.length > 0) {
        const notifications = employees
          .filter(emp => emp.user_id !== null)
          .map(emp => ({
            user_id: emp.user_id as string,
            user_type: 'EMPLOYEE' as const,
            type: 'NEW_ANNOUNCEMENT',
            title: 'New Announcement',
            message: content.trim().substring(0, 100),
            related_id: conversation.id,
            is_read: false
          }))

        await supabase.from('notifications').insert(notifications)
      }

      setContent('')
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error sending announcement:', error)
      toast.error(t('Failed to send announcement'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">{t('New Announcement')}</h3>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="announcement" className="text-gray-300">{t('Message')}</Label>
            <Textarea
              id="announcement"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('Enter your announcement message...')}
              rows={6}
              disabled={sending}
              className="resize-none bg-white/5 border-white/20 text-white placeholder:text-gray-500"
            />
            <p className="text-xs text-gray-500">
              {t('This will be sent to all active employees')}
            </p>
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={sending}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              {t('Cancel')}
            </Button>
          )}
          <Button
            type="submit"
            disabled={sending || !content.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Send className="w-4 h-4 mr-1" />
            {sending ? t('Sending...') : t('Send Announcement')}
          </Button>
        </div>
      </form>
    </div>
  )
}
